"""Tests for the observed-schedule truck estimate (M17 P1) — §4.8 baseline
(AMENDED 2026-11-15: per-truck depot legs + one disposal each).

Synthetic-fixture ids follow the M4 SYNTHETIC- convention; every expected
number is hand-computed in comments from the amended smallest-t inequality
``visits x (service + travel) <= t x (shift - 2 x travel - disposal)``
(§4.6 defaults: per-visit 15 min, per-truck overhead 50 min, remaining 430
min). Real-CSV pins are skip-guarded (tests.helpers) and trace to
docs/schedule_profile.md aggregates plus the P1 truck-day accounting.
"""

from __future__ import annotations

import copy
import random
from datetime import date, timedelta

import pytest

from src.collection.simulation import SimulationConfig
from src.data.schema import Dataset, DatasetSummary, MaterialType, ReadingRecord
from src.routing.observed_baseline import (
    DayTruckNeed,
    ObservedTruckEstimate,
    day_workload_minutes,
    estimate_observed_trucks,
    shift_remaining_minutes,
    trucks_needed,
)
from tests.helpers import require_real_csv_path

BASE_DATE = date(2026, 1, 5)  # a Monday


def make_reading(location_id: str, material_type: MaterialType, day: date) -> ReadingRecord:
    """One synthetic emptying record; fill content is irrelevant here."""
    return ReadingRecord(
        location_id=location_id,
        material_type=material_type,
        date=day,
        fill_level_pct=50,
        is_overfull=False,
    )


def make_dataset(readings: list[ReadingRecord]) -> Dataset:
    dates = [r.date for r in readings]
    return Dataset(
        readings=readings,
        summary=DatasetSummary(
            n_rows=len(readings),
            n_locations=len({r.location_id for r in readings}),
            n_series=len({(r.location_id, r.material_type) for r in readings}),
            date_min=min(dates),
            date_max=max(dates),
        ),
    )


def visits_on(day: date, n: int) -> list[ReadingRecord]:
    """``n`` visits on one date: n series x 1 material, unique keys (I1-safe)."""
    return [make_reading(f"SYNTHETIC-LOC-{i:03d}", "brown", day) for i in range(1, n + 1)]


# ---------------------------------------------------------------------------
# shift_remaining_minutes / day_workload_minutes — the amended §4.8 pieces
# ---------------------------------------------------------------------------


def test_shift_remaining_defaults() -> None:
    # 480 - 2x10 - 30 = 430 minutes of per-truck stop capacity.
    assert shift_remaining_minutes(SimulationConfig()) == 430


class TestDayWorkloadMinutes:
    def test_hand_checked_defaults(self) -> None:
        config = SimulationConfig()
        # 1 visit / 1 truck: 1x(5+10) + 1x(2x10+30) = 15 + 50 = 65
        assert day_workload_minutes(1, 1, config) == 65
        # 3 visits / 1 truck: 3x15 + 50 = 95
        assert day_workload_minutes(3, 1, config) == 95
        # 51 visits / 2 trucks: 51x15 + 2x50 = 765 + 100 = 865
        assert day_workload_minutes(51, 2, config) == 865

    def test_containers_per_series_multiplies_service(self) -> None:
        # §4.2 v4: each of N containers pays its own 5 emptying minutes:
        # 1 visit / 1 truck: 1x(2x5+10) + 50 = 20 + 50 = 70
        assert day_workload_minutes(1, 1, SimulationConfig(containers_per_series=2)) == 70

    def test_rejects_zero_visits_and_trucks(self) -> None:
        config = SimulationConfig()
        with pytest.raises(ValueError, match="visits must be >= 1"):
            day_workload_minutes(0, 1, config)
        with pytest.raises(ValueError, match="trucks must be >= 1"):
            day_workload_minutes(1, 0, config)


# ---------------------------------------------------------------------------
# trucks_needed — the amended smallest-t inequality (closed form)
# ---------------------------------------------------------------------------


class TestTrucksNeeded:
    def test_hand_checked_defaults(self) -> None:
        config = SimulationConfig()
        # v=3: 3x15 = 45 <= 1x430 -> t = 1
        assert trucks_needed(3, config) == 1
        # v=51: t=1 needs 765 <= 430 (no); t=2: 765 <= 860 (yes) -> 2.
        # Workload check: 765 + 2x50 = 865 min <= 2x480 = 960; one truck:
        # 815 min > 480. Smallest t = 2.
        assert trucks_needed(51, config) == 2
        # v=95: t=3: 1425 <= 1290 (no); t=4: 1425 <= 1720 (yes) -> 4
        assert trucks_needed(95, config) == 4
        # v=127 (observed peak): t=4: 1905 <= 1720 (no); t=5: 1905 <= 2150 -> 5
        assert trucks_needed(127, config) == 5

    def test_at_least_one_on_active_days(self) -> None:
        assert trucks_needed(1, SimulationConfig()) == 1

    def test_integer_ceil_boundaries(self) -> None:
        # shift 95 -> remaining 45: 3x15 = 45 <= 1x45 -> exactly 1 truck.
        assert trucks_needed(3, SimulationConfig(max_shift_minutes=95)) == 1
        # shift 94 -> remaining 44: 45 > 44, so t=2 (145 min <= 2x94 = 188).
        assert trucks_needed(3, SimulationConfig(max_shift_minutes=94)) == 2

    def test_capacity_infeasible_when_overhead_exceeds_shift(self) -> None:
        # Per-truck overhead (50) alone exceeds a 45/50-minute shift: no t
        # satisfies the inequality -> None, never coerced to 1.
        assert trucks_needed(1, SimulationConfig(max_shift_minutes=45)) is None
        assert trucks_needed(3, SimulationConfig(max_shift_minutes=50)) is None

    def test_closed_form_equals_greedy_smallest_t_search(self) -> None:
        # The contract states "smallest integer t >= 1"; the module uses the
        # closed-form ceiling. Verify equivalence across the tie bands.
        config = SimulationConfig()
        remaining = shift_remaining_minutes(config)
        per_visit = config.service_minutes_per_stop + config.fixed_travel_minutes
        for visits in (1, 28, 29, 57, 58, 59, 60, 86, 100, 115, 127, 300):
            t = 1
            while visits * per_visit > t * remaining:
                t += 1
            assert trucks_needed(visits, config) == t


# ---------------------------------------------------------------------------
# estimate_observed_trucks — window aggregates on a hand-checked fixture
# ---------------------------------------------------------------------------


@pytest.fixture()
def small_estimate() -> ObservedTruckEstimate:
    """Monday: 51 visits (2 trucks), Wednesday: 3 visits (1 truck); span 3 d."""
    readings = visits_on(BASE_DATE, 51) + visits_on(BASE_DATE + timedelta(days=2), 3)
    return estimate_observed_trucks(make_dataset(readings), SimulationConfig())


class TestEstimateObservedTrucks:
    def test_window_totals(self, small_estimate: ObservedTruckEstimate) -> None:
        assert small_estimate.span_days == 3
        assert small_estimate.active_days == 2
        assert small_estimate.total_visits == 54
        assert [d.visits for d in small_estimate.per_day] == [51, 3]
        assert [d.trucks_needed for d in small_estimate.per_day] == [2, 1]
        assert [d.day_workload_min for d in small_estimate.per_day] == [865, 95]
        assert all(not d.capacity_infeasible for d in small_estimate.per_day)
        assert small_estimate.capacity_infeasible_days == 0
        assert isinstance(small_estimate.per_day[0], DayTruckNeed)

    def test_truck_day_accounting(self, small_estimate: ObservedTruckEstimate) -> None:
        # 2 + 1 truck-days x 500 EUR [representative]
        assert small_estimate.truck_days_window == 3
        assert small_estimate.cost_eur_window == 1500.0

    def test_calendar_year_normalisation_predicted(self) -> None:
        # x 365/span (3) = x 121.666...: 3 -> 365.0 truck-days; 1500 -> 182500.0
        readings = visits_on(BASE_DATE, 51) + visits_on(BASE_DATE + timedelta(days=2), 3)
        estimate = estimate_observed_trucks(make_dataset(readings), SimulationConfig())
        assert estimate.truck_days_calendar_year == 365.0
        assert estimate.cost_eur_calendar_year == 182500.0

    def test_calendar_year_ignores_operating_days_cost_rate(self) -> None:
        # The §4.6 200-operating-days input must never enter this module.
        base = visits_on(BASE_DATE, 51)
        a = estimate_observed_trucks(
            make_dataset(base), SimulationConfig(operating_days_per_year=200)
        )
        b = estimate_observed_trucks(
            make_dataset(base), SimulationConfig(operating_days_per_year=1)
        )
        assert a.truck_days_calendar_year == b.truck_days_calendar_year
        assert a.cost_eur_calendar_year == b.cost_eur_calendar_year

    def test_fleet_distribution_median_peak(self, small_estimate: ObservedTruckEstimate) -> None:
        # median([2, 1]) = 1.5; peak = 2 — a range, never a single fleet size.
        assert small_estimate.median_trucks == 1.5
        assert small_estimate.peak_trucks == 2

    def test_weekday_pattern_active_days_only(self, small_estimate: ObservedTruckEstimate) -> None:
        by_name = {w.weekday: w for w in small_estimate.weekdays}
        assert by_name["Mon"].active_days == 1
        assert by_name["Mon"].mean_trucks == 2.0
        assert by_name["Wed"].active_days == 1
        assert by_name["Wed"].mean_trucks == 1.0
        # Tuesday has calendar occurrences but zero visits: never active.
        assert by_name["Tue"].active_days == 0
        assert by_name["Tue"].mean_trucks is None
        assert len(small_estimate.weekdays) == 7

    def test_all_days_capacity_infeasible_reported_not_coerced(self) -> None:
        # 50-minute shift: the 50-minute per-truck overhead alone already
        # equals the shift (remaining = 0) -> no t on ANY active day.
        readings = visits_on(BASE_DATE, 51) + visits_on(BASE_DATE + timedelta(days=2), 3)
        estimate = estimate_observed_trucks(
            make_dataset(readings), SimulationConfig(max_shift_minutes=50)
        )
        assert estimate.active_days == 2
        assert estimate.capacity_infeasible_days == 2
        assert all(d.capacity_infeasible for d in estimate.per_day)
        assert all(d.trucks_needed is None for d in estimate.per_day)
        assert all(d.day_workload_min is None for d in estimate.per_day)
        assert estimate.truck_days_window == 0
        assert estimate.cost_eur_window == 0.0
        assert estimate.median_trucks is None
        assert estimate.peak_trucks is None
        assert all(w.active_days == 0 and w.mean_trucks is None for w in estimate.weekdays)

    def test_empty_dataset_raises(self) -> None:
        with pytest.raises(ValueError, match="at least one reading"):
            estimate_observed_trucks(Dataset.empty(), SimulationConfig())

    def test_reading_order_independence(self) -> None:
        readings = visits_on(BASE_DATE, 51) + visits_on(BASE_DATE + timedelta(days=2), 3)
        shuffled = copy.deepcopy(readings)
        random.Random(7).shuffle(shuffled)
        assert estimate_observed_trucks(make_dataset(readings), SimulationConfig()) == (
            estimate_observed_trucks(make_dataset(shuffled), SimulationConfig())
        )

    def test_cost_follows_cost_per_truck_day(self) -> None:
        readings = visits_on(BASE_DATE, 51)
        estimate = estimate_observed_trucks(
            make_dataset(readings), SimulationConfig(cost_per_truck_day_eur=600.0)
        )
        assert estimate.truck_days_window == 2
        assert estimate.cost_eur_window == 1200.0


# ---------------------------------------------------------------------------
# Real-CSV pins (skip-guarded; traces to docs/schedule_profile.md)
# ---------------------------------------------------------------------------


class TestRealCsvPins:
    def test_baseline_matches_profile(self) -> None:
        csv_path = require_real_csv_path()
        from src.data.loader import load_glass_fill_csv

        result = load_glass_fill_csv(csv_path)
        assert not result.errors
        estimate = estimate_observed_trucks(result.dataset, SimulationConfig())
        # Window [observed x representative time model] (profile §1/§2):
        assert estimate.span_days == 349
        assert estimate.active_days == 229
        assert estimate.total_visits == 11_701
        # Amended §4.8 arithmetic (per-truck overhead): 523 truck-days.
        assert estimate.capacity_infeasible_days == 0
        assert estimate.truck_days_window == 523
        assert estimate.cost_eur_window == 261_500.0
        # Fleet estimate distribution: median 2 trucks per active day, peak 5.
        assert estimate.median_trucks == 2.0
        assert estimate.peak_trucks == 5
        # Per-day hand anchors at observed min/median/p90/max visit counts:
        per_day = {d.visits: d.trucks_needed for d in estimate.per_day}
        assert per_day[3] == 1
        assert per_day[51] == 2
        assert per_day[78] == 3
        assert per_day[127] == 5
        # Calendar-year normalisation x365/349 [predicted]:
        assert estimate.truck_days_calendar_year == 546.98
        assert estimate.cost_eur_calendar_year == 273_488.54
        # Weekday pattern (active days from profile §4):
        by_name = {w.weekday: w for w in estimate.weekdays}
        assert by_name["Mon"].active_days == 43
        assert by_name["Mon"].mean_trucks == 2.0
        assert by_name["Sun"].active_days == 6
        assert by_name["Wed"].mean_trucks == 2.52
