"""POST /api/scenarios §5.2.6 additions — day_spread strategy + observed_baseline.

Synthetic fixtures (labelled ``loc-`` ids, never real data). Hand-reckoned
pins; arithmetic in comments. Engines under test: the §4.8 day-spreading
scheduler (``src.routing.day_scheduler``) and the §4.8 observed-schedule
estimate (``src.routing.observed_baseline``), wired in
``src.api.services.run_scenarios`` (orchestration only — no business logic
in handlers).

The observed_baseline is computed over the OBSERVED dataset window (its
``calendar_days`` is the annualisation divisor), independent of
``simulation_days`` — the status-quo column beside the replayed strategies
(§5.2.6).
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api.conftest import upload_csv

# One series, rate 7.5 pp/day (§5.2.3 median of the two consecutive
# candidates 20 % / 4 d = 5.0 and 40 % / 4 d = 10.0). Observed window
# 2026-01-01..2026-01-09 = 9 days; records on 01-01, 01-05, 01-09 -> 3
# active days / 3 visits. Replay window defaults to the observed window
# (9 days); the series clock starts 01-01 (its prior record IS 01-01).
RATED_CSV = """Location_id,material_type,date,fill_level_perc
loc-s,green,2026-01-01,0
loc-s,green,2026-01-05,20
loc-s,green,2026-01-09,40
"""

# Four distinct series, all four visits on ONE date -> one active day with
# 4 visits over a 1-day observed window. Single records -> no rates -> the
# replay strategies/day_spread have nothing to schedule (skipped with their
# §5.2.3 reason), so this isolates the baseline arithmetic.
CONCENTRATED_CSV = """Location_id,material_type,date,fill_level_perc
loc-1,green,2026-02-01,10
loc-2,green,2026-02-01,20
loc-3,brown,2026-02-01,30
loc-4,white,2026-02-01,40
"""

STRATEGY_ORDER = ["fixed_frequency", "demand_driven", "day_spread"]

DAY_SPREAD_ONLY_FIELDS = {
    "peak_trucks_per_day",
    "typical_trucks_per_day",
    "stops_per_truck_day",
    "deferrals_total",
    "max_deferral_days",
}
"""§5.2.6 extras — present ONLY on the day_spread row (§5.2.4 rows keep
their pinned shape; the union models keep them out of the JSON)."""


def _post_scenarios(client: TestClient, body: dict) -> dict:
    response = client.post("/api/scenarios", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_ordering_and_strategy_row_shapes(client: TestClient) -> None:
    """§5.2.6: fixed order fixed_frequency -> demand_driven -> day_spread;
    only the day_spread row carries the scheduler extras; every row keeps
    the §5.2.4 cost+service fields."""
    upload_csv(client, RATED_CSV)
    body = _post_scenarios(client, {})
    assert [strategy["id"] for strategy in body["strategies"]] == STRATEGY_ORDER
    for strategy in body["strategies"][:2]:
        assert DAY_SPREAD_ONLY_FIELDS.isdisjoint(strategy)
    spread = body["strategies"][2]
    assert DAY_SPREAD_ONLY_FIELDS.issubset(spread)
    # §5.2.4 fields shared by all three rows (same keys, same order prefix).
    assert list(spread)[:6] == [
        "id",
        "truck_days",
        "stops_total",
        "cost_eur_total",
        "cost_eur_per_year",
        "service",
    ]
    assert spread["service"]["basis"] == "simulated"


def test_observed_baseline_arithmetic_hand_reckoned(client: TestClient) -> None:
    """Baseline over the observed window: 3 visits / 3 active days / 9
    calendar days. Per §4.8 per-truck arithmetic each 1-visit day needs
    ceil(1 x (5 + 10) / (480 - 2 x 10 - 30)) = max(1, ceil(15/430)) = 1
    truck -> truck_days 3, cost 3 x 500 = 1500.0; per-year predicted =
    round(1500 x 365/9, 2) = 60833.33 [predicted extrapolation]."""
    upload_csv(client, RATED_CSV)
    body = _post_scenarios(client, {})
    baseline = body["observed_baseline"]
    assert baseline["basis"] == "observed_emptying_records"
    assert baseline["active_days"] == 3
    assert baseline["calendar_days"] == 9
    assert baseline["visits_total"] == 3
    assert baseline["truck_days"] == 3
    assert baseline["cost_eur_total"] == 1500.0
    assert baseline["cost_eur_per_year_predicted"] == 60833.33
    assert baseline["median_trucks_per_active_day"] == 1.0
    assert baseline["peak_trucks"] == 1
    # See the module-coupling note on the 422 test below: every config that
    # would push a day past feasibility is rejected earlier by the scheduler
    # gate, so a computed response always has 0 here.
    assert baseline["capacity_infeasible_days"] == 0

    # Default threshold 80: due iff 7.5 pp/day x days >= 80 (>= 11 days) —
    # the 9-day replay tops out at 8 x 7.5 = 60 < 80 -> day_spread honest zeros.
    spread = body["strategies"][2]
    assert spread["stops_total"] == 0
    assert spread["truck_days"] == 0
    assert spread["cost_eur_total"] == 0.0
    assert spread["peak_trucks_per_day"] is None
    assert spread["typical_trucks_per_day"] is None

    # §5.2.6 labels, verbatim (ASCII x per architect ruling).
    assert any(
        label.startswith("[observed x representative time model] observed_baseline:")
        for label in body["assumptions"]
    )
    assert any(
        label.startswith("[predicted — simulation on observed rates] day_spread:")
        for label in body["assumptions"]
    )


def test_threshold_override_moves_day_spread(client: TestClient) -> None:
    """select_threshold_pct=10, rate 7.5 pp/day -> due iff days >= 2:
    01-03, 01-05, 01-07, 01-09 (fill 15.0 each) -> 4 stops, 1 truck per
    active day -> 4 truck-days, cost 2000.0, per-year
    round(2000/9 x 200, 2) = 44444.44. stops_per_truck_day =
    floor(430/15) = 28; no deferrals (4 << 28)."""
    upload_csv(client, RATED_CSV)
    body = _post_scenarios(client, {"policy_config": {"select_threshold_pct": 10}})
    spread = body["strategies"][2]
    assert spread["id"] == "day_spread"
    assert spread["stops_total"] == 4
    assert spread["truck_days"] == 4
    assert spread["cost_eur_total"] == 2000.0
    assert spread["cost_eur_per_year"] == 44444.44
    assert spread["peak_trucks_per_day"] == 1
    assert spread["typical_trucks_per_day"] == 1.0
    assert spread["stops_per_truck_day"] == 28
    assert spread["deferrals_total"] == 0
    assert spread["max_deferral_days"] is None
    # Due days reset to 0 -> max END-OF-DAY fill is the day-after 7.5
    # (also 01-02 pre-threshold); 0 of 4 emptyings full/overfull; no
    # container-day above 100.
    assert spread["service"] == {
        "basis": "simulated",
        "overflow_share_pct": 0.0,
        "share_emptyings_full_or_overfull_pct": 0.0,
        "max_fill_pct": 7.5,
    }
    # The threshold override must NOT move the observed baseline (its visits
    # are the observed history, not threshold-driven).
    assert body["observed_baseline"]["truck_days"] == 3
    assert body["observed_baseline"]["cost_eur_total"] == 1500.0


def test_shift_override_moves_baseline_truck_arithmetic(client: TestClient) -> None:
    """max_shift_minutes=100 -> remaining = 100 - 2x10 - 30 = 50 min/truck;
    the 4-visit day needs ceil(4 x 15 / 50) = 2 trucks (default 480 gives
    ceil(60/430) = 1) -> truck_days 2, cost 1000.0, per-year
    round(1000 x 365/1, 2) = 365000.0. Service/shift knobs apply to the
    baseline time model (§5.2.6). The replay rows stay zero: single-record
    series have no rate -> skipped, reported (§4.4)."""
    upload_csv(client, CONCENTRATED_CSV)
    default = _post_scenarios(client, {})
    assert default["observed_baseline"]["truck_days"] == 1
    assert default["observed_baseline"]["cost_eur_total"] == 500.0
    assert default["observed_baseline"]["cost_eur_per_year_predicted"] == 182500.0
    assert default["observed_baseline"]["median_trucks_per_active_day"] == 1.0
    assert default["observed_baseline"]["peak_trucks"] == 1

    overridden = _post_scenarios(client, {"routing_config": {"max_shift_minutes": 100}})
    baseline = overridden["observed_baseline"]
    assert baseline["active_days"] == 1
    assert baseline["calendar_days"] == 1
    assert baseline["visits_total"] == 4
    assert baseline["truck_days"] == 2
    assert baseline["cost_eur_total"] == 1000.0
    assert baseline["cost_eur_per_year_predicted"] == 365000.0
    assert baseline["median_trucks_per_active_day"] == 2.0
    assert baseline["peak_trucks"] == 2
    # The replay rows are unaffected by the baseline's observed visit counts.
    assert overridden["strategies"][2]["stops_total"] == 0
    assert overridden["skipped_series"] == [
        {"location_id": location_id, "material_type": material, "reason": "not_enough_records"}
        for location_id, material in [
            ("loc-1", "green"),
            ("loc-2", "green"),
            ("loc-3", "brown"),
            ("loc-4", "white"),
        ]
    ]


def test_infeasible_shift_config_is_422_before_baseline(client: TestClient) -> None:
    """Coupling note (documented honestly): the baseline is capacity-
    infeasible exactly when max_shift - 2 x travel - disposal <= 0, which is
    also the scheduler's stops_per_truck_day = 0 regime — the shared-config
    gate rejects the request with 422 (the scheduler's domain message, §5.3)
    BEFORE any partial response, so a computed observed_baseline always has
    capacity_infeasible_days == 0."""
    upload_csv(client, CONCENTRATED_CSV)
    response = client.post("/api/scenarios", json={"routing_config": {"max_shift_minutes": 25}})
    assert response.status_code == 422, response.text
    assert "stops_per_truck_day would be 0" in response.json()["detail"]
