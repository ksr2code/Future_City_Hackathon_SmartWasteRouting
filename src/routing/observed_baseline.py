"""Observed-schedule truck estimate (M17 P1) — docs/contracts.md §4.8.

The status-quo baseline IS the observed emptying history itself (user
decision 2026-11-15): one row = one emptying record (§1.5), so per-date row
counts are visit counts, aggregated by the P0 audit
(:func:`src.analytics.schedule.compute_observed_schedule`). The
representative flat-mode time model turns each active day's visit count into
the trucks that day would have needed. **Amended 2026-11-15 (per-truck
overhead, implementer flag accepted):** ``trucks_needed`` is the smallest
integer ``t >= 1`` satisfying

    visits x service_minutes                  (per stop, x containers_per_series §4.2 v4)
    + (visits + 2t) x fixed_travel_minutes    (one leg per visit + depot start/end per truck)
    + t x disposal_service_minutes            (one disposal unload per truck)
    <= t x max_shift_minutes

i.e. ``visits x (service + travel) <= t x (max_shift - 2 x travel -
disposal)``. The inequality is linear in t, so for
``remaining := max_shift - 2 x fixed_travel - disposal > 0`` the smallest
solution is the closed-form ceiling
``max(1, ceil(visits x (service + travel) / remaining))`` — identical to the
greedy t = 1, 2, ... search the contract states (equivalence test included).
If ``remaining <= 0`` (the per-truck depot/disposal overhead alone exceeds a
shift) NO t exists: the day is reported **capacity-infeasible at these
times** — ``trucks_needed`` is ``None``, the day is excluded from
``truck_days_window`` and counted in ``capacity_infeasible_days`` — never
silently coerced.

Labels (§4.8, normative):
- Window totals (truck days, euros over the observed window) are
  **[observed x representative time model]** — observed visit counts through
  the labelled §4.6 time parameters.
- The calendar-year normalisation ``x DAYS_PER_YEAR / span_days`` (inclusive
  span, the P0 formula) EXTRAPOLATES beyond the observation window and is
  labelled **[predicted]**. It never uses the §4.6
  ``operating_days_per_year = 200`` cost-rate input — that rate belongs to
  the §4.3/§5.2.2 cost derivations, not to the observed baseline.
- Fleet estimate = the DISTRIBUTION of per-day ``trucks_needed`` over
  feasible active days (median vs peak) — a range, never a single claimed
  fleet size (the real fleet is unknown, docs/open_questions.md Q1). The 3x
  ``demo_truck`` solver input (§4.6 [demo assumption]) is a separate routing
  input and must stay visually separated from this estimate.

Deterministic: integer arithmetic only (integer ceil, no float rounding),
same readings in any order -> identical result. Empty dataset -> ValueError
(the baseline needs at least one emptying record).
"""

from __future__ import annotations

import statistics
from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from src.analytics.schedule import DAYS_PER_YEAR, WEEKDAY_NAMES, compute_observed_schedule
from src.collection.simulation import SimulationConfig
from src.data.schema import Dataset

__all__ = [
    "DayTruckNeed",
    "ObservedTruckEstimate",
    "WeekdayPattern",
    "day_workload_minutes",
    "estimate_observed_trucks",
    "shift_remaining_minutes",
    "trucks_needed",
]


@dataclass(frozen=True)
class DayTruckNeed:
    """One active day's workload and truck need — §4.8 truck-day accounting.

    ``trucks_needed`` is the smallest truck count whose combined shift
    capacity covers the day (``None`` iff capacity-infeasible at these
    times); ``day_workload_min`` is the resulting per-day workload
    (``visits x (service + travel) + trucks x (2 x travel + disposal)``),
    ``None`` iff infeasible.
    """

    date: date
    visits: int
    day_workload_min: int | None
    trucks_needed: int | None
    capacity_infeasible: bool


@dataclass(frozen=True)
class WeekdayPattern:
    """One weekday's activity pattern over feasible active days (Mon..Sun).

    Zero-visit occurrences of the weekday never count as active days (P0
    rule). ``mean_trucks`` is ``None`` iff the weekday has no feasible
    active days.
    """

    weekday: str  # Mon..Sun
    active_days: int
    mean_trucks: float | None  # mean trucks_needed over feasible active days


@dataclass(frozen=True)
class ObservedTruckEstimate:
    """§4.8 observed-schedule baseline over the dataset window.

    ``truck_days_window``/``cost_eur_window`` are [observed x representative
    time model] and sum FEASIBLE active days only;
    ``truck_days_calendar_year``/``cost_eur_calendar_year`` are the
    x365/span extrapolation [predicted] of that feasible sum.
    ``capacity_infeasible_days`` counts active days with no feasible truck
    count (reported honestly, §4.8). ``median_trucks``/``peak_trucks``
    describe the per-feasible-active-day distribution (a range, not a
    claimed fleet size); both are ``None`` iff no feasible active day
    exists.
    """

    date_min: date
    date_max: date
    span_days: int  # inclusive, matching src.analytics.schedule
    active_days: int  # distinct dates with >= 1 visit
    total_visits: int
    per_day: tuple[DayTruckNeed, ...]  # chronological
    capacity_infeasible_days: int  # active days where no t satisfies §4.8
    truck_days_window: int  # sum over feasible active days
    cost_eur_window: float
    truck_days_calendar_year: float  # [predicted]: x DAYS_PER_YEAR / span_days
    cost_eur_calendar_year: float  # [predicted]
    median_trucks: float | None  # median trucks_needed over feasible active days
    peak_trucks: int | None  # max trucks_needed over feasible active days
    weekdays: tuple[WeekdayPattern, ...]  # Mon..Sun


def shift_remaining_minutes(config: SimulationConfig) -> int:
    """Per-truck shift capacity left after depot start/end legs and one
    disposal unload: ``max_shift - 2 x fixed_travel - disposal`` (minutes).

    ``<= 0`` means no truck can complete even the yard->yard overhead:
    every active day is capacity-infeasible at these times.
    """
    return (
        config.max_shift_minutes - 2 * config.fixed_travel_minutes - config.disposal_service_minutes
    )


def day_workload_minutes(visits: int, trucks: int, config: SimulationConfig) -> int:
    """§4.8 workload of ``visits`` emptying records spread over ``trucks``
    trucks (minutes): ``visits x (service + travel) + trucks x (2 x travel +
    disposal)``. Service minutes are the effective per-stop value
    (x ``containers_per_series``, §4.2 v4). Integer arithmetic throughout.
    """
    if visits < 1:
        raise ValueError(f"visits must be >= 1 (active day), got {visits}")
    if trucks < 1:
        raise ValueError(f"trucks must be >= 1, got {trucks}")
    per_visit = (
        config.service_minutes_per_stop * config.containers_per_series + config.fixed_travel_minutes
    )
    per_truck = 2 * config.fixed_travel_minutes + config.disposal_service_minutes
    return visits * per_visit + trucks * per_truck


def trucks_needed(visits: int, config: SimulationConfig) -> int | None:
    """§4.8 amended: smallest ``t >= 1`` with
    ``visits x (service + travel) <= t x (shift - 2 x travel - disposal)``.

    Returns ``None`` when no t satisfies the inequality (the per-truck
    depot/disposal overhead alone exceeds the shift) — capacity-infeasible,
    never coerced. Integer ceil, >= 1 on feasible days.
    """
    if visits < 1:
        raise ValueError(f"visits must be >= 1 (active day), got {visits}")
    remaining = shift_remaining_minutes(config)
    if remaining <= 0:
        return None
    per_visit = (
        config.service_minutes_per_stop * config.containers_per_series + config.fixed_travel_minutes
    )
    return max(1, (visits * per_visit + remaining - 1) // remaining)


def estimate_observed_trucks(dataset: Dataset, config: SimulationConfig) -> ObservedTruckEstimate:
    """§4.8 baseline: the observed schedule through the amended time model.

    Visits come verbatim from :func:`src.analytics.schedule.
    compute_observed_schedule` (P0); every active day (>= 1 visit) is turned
    into a :class:`DayTruckNeed`; capacity-infeasible days are counted, not
    coerced. Deterministic and order-independent.
    """
    schedule = compute_observed_schedule(dataset.readings)
    per_day: list[DayTruckNeed] = []
    for observed_day in schedule.per_date:
        trucks = trucks_needed(observed_day.visits, config)
        per_day.append(
            DayTruckNeed(
                date=observed_day.date,
                visits=observed_day.visits,
                day_workload_min=(
                    day_workload_minutes(observed_day.visits, trucks, config)
                    if trucks is not None
                    else None
                ),
                trucks_needed=trucks,
                capacity_infeasible=trucks is None,
            )
        )
    feasible_trucks = [day.trucks_needed for day in per_day if day.trucks_needed is not None]
    capacity_infeasible_days = sum(1 for day in per_day if day.capacity_infeasible)
    truck_days_window = sum(feasible_trucks)
    cost_eur_window = round(truck_days_window * config.cost_per_truck_day_eur, 2)
    year_factor = DAYS_PER_YEAR / schedule.span_days
    truck_days_calendar_year = round(truck_days_window * year_factor, 2)
    cost_eur_calendar_year = round(cost_eur_window * year_factor, 2)

    by_weekday: dict[int, list[int]] = defaultdict(list)
    for record in per_day:
        if record.trucks_needed is not None:
            by_weekday[record.date.weekday()].append(record.trucks_needed)
    weekdays = tuple(
        WeekdayPattern(
            weekday=WEEKDAY_NAMES[w],
            active_days=len(by_weekday[w]),
            mean_trucks=(round(statistics.fmean(by_weekday[w]), 2) if by_weekday[w] else None),
        )
        for w in range(7)
    )
    return ObservedTruckEstimate(
        date_min=schedule.date_min,
        date_max=schedule.date_max,
        span_days=schedule.span_days,
        active_days=schedule.active_days,
        total_visits=schedule.total_visits,
        per_day=tuple(per_day),
        capacity_infeasible_days=capacity_infeasible_days,
        truck_days_window=truck_days_window,
        cost_eur_window=cost_eur_window,
        truck_days_calendar_year=truck_days_calendar_year,
        cost_eur_calendar_year=cost_eur_calendar_year,
        median_trucks=(float(statistics.median(feasible_trucks)) if feasible_trucks else None),
        peak_trucks=max(feasible_trucks) if feasible_trucks else None,
        weekdays=weekdays,
    )
