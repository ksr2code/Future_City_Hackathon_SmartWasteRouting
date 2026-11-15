"""Tests for the day-spreading scheduler (M17 P2) — §4.8 optimised plan.

Hand-checkable synthetic SeriesDaysToFull fixtures (rates set directly, as
§5.2.5 takes them verbatim — the rate derivation itself is tested in
tests/forecasting). Small-capacity configs make deferral/guard behaviour
observable with two or three series; every expected number is hand-computed
in comments. Real-CSV pins are skip-guarded (tests.helpers).
"""

from __future__ import annotations

import random
from datetime import date, timedelta

import pytest

from src.collection.simulation import SimulationConfig, SimulationConfigError
from src.forecasting.days_to_full import SeriesDaysToFull
from src.routing.day_scheduler import (
    effective_stop_service_minutes,
    schedule_collection_days,
    stops_per_truck_day,
)
from tests.helpers import require_real_csv_path

START = date(2026, 1, 1)  # a Thursday


def make_estimate(
    location_id: str = "SYNTHETIC-A",
    material_type: str = "brown",
    rate: float | None = 10.0,
    reason: str | None = None,
) -> SeriesDaysToFull:
    """A §5.2.3-shaped row with a hand-set rate (the scheduler never
    recomputes rates, so the other fields are inert filler)."""
    material = material_type  # MaterialType is a str literal alias
    return SeriesDaysToFull(
        location_id=location_id,
        material_type=material,  # type: ignore[arg-type]
        last_emptying_date=START,
        last_fill_pct=50,
        last_is_overfull=False,
        rate_pct_per_day=rate,
        median_interval_days=28.0 if rate is not None else None,
        days_to_full=None if reason else 1.0,
        predicted_full_date=None if reason else START,
        is_lower_bound=False,
        reason=reason,  # type: ignore[arg-type]
    )


SMALL_CAPACITY = SimulationConfig(max_shift_minutes=80)
# stops_per_truck_day = floor((80 - 2x10 - 30) / (5 + 10)) = floor(30/15) = 2
ONE_STOP_CAPACITY = SimulationConfig(max_shift_minutes=65)
# stops_per_truck_day = floor((65 - 2x10 - 30) / (5 + 10)) = floor(15/15) = 1


def run(
    estimates: list[SeriesDaysToFull],
    config: SimulationConfig,
    days: int,
    priors: dict[tuple[str, str], date] | None = None,
):
    return schedule_collection_days(
        estimates,
        config,
        START,
        START + timedelta(days=days - 1),
        prior_emptying_dates=priors or {},
    )


# ---------------------------------------------------------------------------
# stops_per_truck_day — the §4.8 capacity formula
# ---------------------------------------------------------------------------


def test_capacity_defaults_28() -> None:
    # floor((480 - 2x10 - 30) / (5 + 10)) = floor(430/15) = 28
    assert stops_per_truck_day(SimulationConfig()) == 28


def test_capacity_custom_config() -> None:
    assert stops_per_truck_day(SMALL_CAPACITY) == 2


def test_capacity_respects_containers_per_series() -> None:
    # effective service 2x5: floor((80 - 50) / (10 + 10)) = floor(30/20) = 1
    config = SimulationConfig(max_shift_minutes=80, containers_per_series=2)
    assert stops_per_truck_day(config) == 1
    assert effective_stop_service_minutes(config) == 10


def test_capacity_zero_raises() -> None:
    # shift 45 minus 50 overhead leaves nothing for even one stop.
    with pytest.raises(ValueError, match="stops_per_truck_day would be 0"):
        stops_per_truck_day(SimulationConfig(max_shift_minutes=45))


# ---------------------------------------------------------------------------
# validation — honest failures, never silent clamps
# ---------------------------------------------------------------------------


def test_end_before_start_raises() -> None:
    with pytest.raises(ValueError, match="before start_date"):
        schedule_collection_days(
            [make_estimate()],
            SimulationConfig(),
            START,
            START - timedelta(days=1),
            prior_emptying_dates={},
        )


def test_prior_after_start_raises() -> None:
    with pytest.raises(SimulationConfigError, match="must be <= start_date"):
        run(
            [make_estimate()],
            SimulationConfig(),
            5,
            priors={("SYNTHETIC-A", "brown"): START + timedelta(days=1)},
        )


def test_duplicate_series_keys_raise() -> None:
    with pytest.raises(ValueError, match="duplicate series key"):
        run([make_estimate(), make_estimate()], SimulationConfig(), 5)


# ---------------------------------------------------------------------------
# hand-checked single-series replay (default capacity 28)
# ---------------------------------------------------------------------------


def test_single_series_due_and_refill_cycle() -> None:
    # rate 10 pp/day from an empty clock (day 1 = day 0 since emptying):
    # due on window day 9 (fill 80) and again 8 days later after reset.
    plan = run([make_estimate()], SimulationConfig(), days=17)
    served_days = [d.date for d in plan.days if d.stops_served > 0]
    assert served_days == [START + timedelta(days=8), START + timedelta(days=16)]
    assert plan.stops_total == 2
    assert plan.truck_days == 2
    assert plan.cost_eur_total == 1000.0
    # [predicted] x365/17: 1000 x 365/17 = 21470.59
    assert plan.cost_eur_per_calendar_year == 21470.59
    assert plan.service.max_fill_pct == 70.0
    assert plan.service.overflow_share_pct == 0.0
    assert plan.service.share_emptyings_full_or_overfull_pct == 0.0
    assert plan.active_days == 2
    assert plan.median_trucks == 1.0
    assert plan.peak_trucks == 1
    assert plan.deferrals_total == 0
    assert plan.max_wait_days is None
    # Window days 9 and 17 are Friday and Saturday.
    by_name = {w.weekday: w for w in plan.weekdays}
    assert by_name["Fri"].active_days == 1
    assert by_name["Sat"].active_days == 1
    assert by_name["Mon"].active_days == 0


def test_below_threshold_never_served() -> None:
    # rate 1 pp/day: fill reaches 15 in a 15-day window — never >= 80.
    plan = run([make_estimate(rate=1.0)], SimulationConfig(), days=15)
    assert plan.stops_total == 0
    assert plan.truck_days == 0
    assert plan.active_days == 0
    assert plan.median_trucks is None
    assert plan.peak_trucks is None
    assert plan.service.share_emptyings_full_or_overfull_pct is None
    assert plan.service.overflow_share_pct == 0.0  # container-days still counted
    assert plan.skipped == []


def test_prior_clock_makes_series_due_immediately() -> None:
    # prior emptying 4 days before the window: fill = 20x4 = 80 on day 1.
    priors = {("SYNTHETIC-A", "brown"): START - timedelta(days=4)}
    plan = run([make_estimate(rate=20.0)], SimulationConfig(), days=3, priors=priors)
    assert [d.stops_served for d in plan.days] == [1, 0, 0]
    assert plan.fills_at_emptying == (80.0,)


def test_seeded_overfull_fill_served_day_one_and_counted() -> None:
    # prior 10 days back at 20 pp/day -> fill 200 (> 100): served immediately,
    # counted as a full emptying; end-of-day fill resets to 0.
    priors = {("SYNTHETIC-A", "brown"): START - timedelta(days=10)}
    plan = run([make_estimate(rate=20.0)], SimulationConfig(), days=2, priors=priors)
    assert plan.fills_at_emptying == (200.0,)
    assert plan.service.share_emptyings_full_or_overfull_pct == 100.0
    # After the day-1 reset the only later end-of-day fill is day 2 = 20.0.
    assert plan.service.max_fill_pct == 20.0
    assert plan.service.overflow_share_pct == 0.0


# ---------------------------------------------------------------------------
# capacity, urgency order, deferral and the >100 % overflow guard
# ---------------------------------------------------------------------------


def test_capacity_defers_least_urgent_by_key_ties() -> None:
    # Three equal-rate series due together on day 8 (fill 80 each): capacity
    # 2 serves the two key-smallest (A, B); C defers (next-day 90 <= 100).
    estimates = [
        make_estimate("SYNTHETIC-A"),
        make_estimate("SYNTHETIC-B"),
        make_estimate("SYNTHETIC-C"),
    ]
    plan = run(estimates, SMALL_CAPACITY, days=10)
    # Day 0 since emptying is window day 1, so fill hits 80 on Jan 9 (index 8).
    day1, day2 = plan.days[8], plan.days[9]
    assert day1.stops_due == 3 and day1.stops_served == 2 and day1.stops_deferred == 1
    assert day2.stops_served == 1  # C at fill 90
    assert plan.stops_total == 3
    assert plan.truck_days == 2  # 1 + 1 (never 2 trucks on a 2-capacity day)
    assert plan.deferrals_total == 1
    assert plan.max_wait_days == 1


def test_urgency_order_fill_descending_with_priors() -> None:
    # Priors stagger the clocks: on day 1 fills are A=80, B=100, C=90.
    # Capacity 2 serves B (100) and C (90); A defers and is served on day 2.
    priors = {
        ("SYNTHETIC-A", "brown"): START - timedelta(days=8),
        ("SYNTHETIC-B", "brown"): START - timedelta(days=10),
        ("SYNTHETIC-C", "brown"): START - timedelta(days=9),
    }
    estimates = [
        make_estimate("SYNTHETIC-A"),
        make_estimate("SYNTHETIC-B"),
        make_estimate("SYNTHETIC-C"),
    ]
    plan = run(estimates, SMALL_CAPACITY, days=3, priors=priors)
    assert [d.stops_served for d in plan.days] == [2, 1, 0]
    assert plan.fills_at_emptying == (100.0, 90.0, 90.0)
    assert plan.service.share_emptyings_full_or_overfull_pct == 33.3
    # End-of-day max: deferred A waits at fill 80 on Jan 1 (its 90 is the
    # day-2 fill at emptying, which resets to 0 the same day).
    assert plan.service.max_fill_pct == 80.0
    assert plan.deferrals_total == 1
    assert plan.max_wait_days == 1


def test_overflow_guard_serves_despite_capacity_peak_staffing() -> None:
    # rate 15, prior 6 days back: both series sit at fill 90 on day 1;
    # next-day fill 105 > 100 -> BOTH served though capacity is 1:
    # trucks_used = ceil(2/1) = 2 (peak staffing, unbounded).
    priors = {
        ("SYNTHETIC-A", "brown"): START - timedelta(days=6),
        ("SYNTHETIC-B", "brown"): START - timedelta(days=6),
    }
    estimates = [make_estimate("SYNTHETIC-A", rate=15.0), make_estimate("SYNTHETIC-B", rate=15.0)]
    plan = run(estimates, ONE_STOP_CAPACITY, days=2, priors=priors)
    day1 = plan.days[0]
    assert day1.stops_due == 2
    assert day1.stops_served == 2
    assert day1.overflow_guard_served == 1
    assert day1.trucks_used == 2
    assert plan.truck_days == 2
    assert plan.cost_eur_total == 1000.0
    assert plan.deferrals_total == 0
    assert plan.max_wait_days is None


def test_next_day_exactly_100_is_still_deferred() -> None:
    # Boundary: fill 80 + rate 20 = 100.0 — does NOT exceed 100, so the
    # second series defers and is served next day (fill 100).
    priors = {
        ("SYNTHETIC-A", "brown"): START - timedelta(days=4),
        ("SYNTHETIC-B", "brown"): START - timedelta(days=4),
    }
    estimates = [make_estimate("SYNTHETIC-A", rate=20.0), make_estimate("SYNTHETIC-B", rate=20.0)]
    plan = run(estimates, ONE_STOP_CAPACITY, days=2, priors=priors)
    assert plan.days[0].stops_served == 1
    assert plan.days[0].stops_deferred == 1
    assert plan.days[0].overflow_guard_served == 0
    assert plan.days[1].stops_served == 1
    assert plan.fills_at_emptying == (80.0, 100.0)
    assert plan.service.share_emptyings_full_or_overfull_pct == 50.0


# ---------------------------------------------------------------------------
# skipped series (§5.2.3 reasons — never silently dropped)
# ---------------------------------------------------------------------------


def test_unusable_rates_are_reported_as_skipped() -> None:
    plan = run(
        [make_estimate(rate=None, reason="zero_rate"), make_estimate("SYNTHETIC-B")],
        SimulationConfig(),
        days=10,
    )
    assert [s.location_id for s in plan.skipped] == ["SYNTHETIC-A"]
    assert plan.skipped[0].reason == "zero_rate"
    assert plan.stops_total == 1  # only SYNTHETIC-B is ever served


# ---------------------------------------------------------------------------
# determinism — pure function, no RNG, input-order independent (§4.8)
# ---------------------------------------------------------------------------


def test_determinism_same_and_shuffled_inputs() -> None:
    estimates = [
        make_estimate("SYNTHETIC-A", "brown"),
        make_estimate("SYNTHETIC-B", "green"),
        make_estimate("SYNTHETIC-C", "white", rate=12.0),
    ]
    priors = {("SYNTHETIC-A", "brown"): START - timedelta(days=3)}
    plan_a = run(estimates, SMALL_CAPACITY, days=30, priors=priors)
    plan_b = run(estimates, SMALL_CAPACITY, days=30, priors=priors)
    assert plan_a == plan_b
    shuffled = list(estimates)
    random.Random(11).shuffle(shuffled)
    assert run(shuffled, SMALL_CAPACITY, days=30, priors=priors) == plan_a


# ---------------------------------------------------------------------------
# Real-CSV pins (skip-guarded; aggregates from the live 2026-11-15 run)
# ---------------------------------------------------------------------------


def test_real_csv_plan_pins() -> None:
    csv_path = require_real_csv_path()
    from src.collection.simulation import SimulationConfig as Config
    from src.data.loader import load_glass_fill_csv
    from src.forecasting.days_to_full import build_days_to_full
    from src.forecasting.features import group_by_series

    result = load_glass_fill_csv(csv_path)
    assert not result.errors
    dataset = result.dataset
    config = Config()
    date_min = min(r.date for r in dataset.readings)
    date_max = max(r.date for r in dataset.readings)
    priors: dict[tuple[str, str], date] = {}
    for key, readings in group_by_series(dataset.readings).items():
        prior = max((r.date for r in readings if r.date <= date_min), default=None)
        if prior is not None:
            priors[key] = prior
    plan = schedule_collection_days(
        build_days_to_full(dataset).series,
        config,
        date_min,
        date_max,
        prior_emptying_dates=priors,
    )
    assert plan.stops_per_truck_day == 28
    assert plan.active_days == 342
    assert plan.stops_total == 9_237
    assert plan.truck_days == 342
    assert plan.cost_eur_total == 171_000.0
    assert plan.cost_eur_per_calendar_year == 178_839.54
    assert plan.median_trucks == 1.0
    assert plan.peak_trucks == 1
    # Service beside cost (§6): the guard prevents all overflow by design.
    assert plan.service.overflow_share_pct == 0.0
    assert plan.service.share_emptyings_full_or_overfull_pct == 0.0
    assert plan.service.max_fill_pct == 88.9
    assert len(plan.skipped) == 35
    assert plan.deferrals_total == 29_401
    assert plan.max_wait_days == 29
    # Determinism on real data: same inputs -> identical plan.
    replay = schedule_collection_days(
        build_days_to_full(dataset).series,
        config,
        date_min,
        date_max,
        prior_emptying_dates=priors,
    )
    assert replay == plan
