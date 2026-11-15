"""Day-spreading scheduler (M17 P2) — docs/contracts.md §4.8 optimised plan.

Replays the demand-driven plan over ``[start_date, end_date]`` on the §5.2.5
machinery (:mod:`src.collection.simulation`): per-series rates verbatim from
§5.2.3 :class:`~src.forecasting.days_to_full.SeriesDaysToFull` rows (never
recomputed), the v4 replay clock (each series' latest record <= ``start_date``,
caller-supplied ``prior_emptying_dates``; absent keys start empty at
``start_date``), fill = ``rate x days since last (simulated) emptying`` with
the emptying day as day 0 (fill resets). Series without a usable rate are
skipped with their §5.2.3 reason — never silently dropped.

§4.8 finalised rules (2026-11-15), implemented verbatim:

- Trigger: a series is **due** on day d when projected fill >=
  ``select_threshold_pct`` (§3.1 default 80 [demo assumption]).
- Daily capacity (flat-mode arithmetic, §4.4): ``stops_per_truck_day =
  floor((max_shift_minutes - 2 x fixed_travel_minutes -
  disposal_service_minutes) / (service_minutes + fixed_travel_minutes))``
  — §4.6 defaults give floor(430/15) = 28. ``service_minutes`` is the
  effective per-stop value (x ``containers_per_series``, §4.2 v4).
- Selection under capacity: serve due series by projected fill DESCENDING
  (ties: rate descending, then key ascending — deterministic). Capacity
  overflow defers the LEAST-urgent due series to the next day, EXCEPT
  series whose next-day projected fill (``fill + rate``) would exceed
  100 % — those are served the same day and raise that day's truck count
  (peak staffing). Overflow is never accepted.
- Counting: ``trucks_used(d) = ceil(stops_served(d) / stops_per_truck_day)``
  (0 on days without stops); ``truck_days = sum trucks_used``; cost =
  ``truck_days x cost_per_truck_day_eur`` [representative]. Planning
  staffing is UNBOUNDED — the 3x ``demo_truck`` solver cap (§4.6 [demo
  assumption]) does not apply here.
- Service level beside every cost figure (§6): the §5.2.4 metrics (overflow
  container-days share, share full/overfull at emptying, max end-of-day
  fill) plus deferral explainers (deferral events, longest wait).

Counted overflow container-days are 0 **by construction**, not an emergent
result (§4.8 "overflow is never accepted"): a deferral requires next-day
fill <= 100 %, and the overflow guard serves the rest the same day, so no
accepted end-of-day state exceeds 100 %; ``max_fill_pct`` is the emergent
closeness-to-limit measure. End-of-day fills are measured AFTER the service
reset, so a caller-seeded prior clock already past full never enters
``overflow_containers``/``max_fill_pct`` — it surfaces only in the
emptying-based metrics (``fills_at_emptying``,
``share_emptyings_full_or_overfull_pct``) on its first day, and the series
is served that same day (``fill > 100 => fill + rate > 100``).

All outputs are **[predicted — simulation on observed rates]**; the baseline
column is :func:`src.routing.observed_baseline.estimate_observed_trucks`
(the same labelled time model, §4.8). Calendar-year figures normalise by the
inclusive replay span (x 365/span, the P0 formula) — never by the §4.6
200-operating-days cost-rate input. Deterministic: pure function of inputs,
no solver, no RNG; the input order of ``series_estimates`` does not matter.
"""

from __future__ import annotations

import statistics
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

from src.analytics.schedule import WEEKDAY_NAMES
from src.collection.simulation import (
    FULL_FILL_PCT,
    ServiceMetrics,
    SimulationConfig,
    SimulationConfigError,
    SkippedSeries,
    _active_estimates,
)
from src.forecasting.days_to_full import SeriesDaysToFull
from src.routing.observed_baseline import WeekdayPattern

__all__ = [
    "SchedulerDayRecord",
    "SchedulerPlan",
    "effective_stop_service_minutes",
    "schedule_collection_days",
    "stops_per_truck_day",
]

SERIES_KEY = tuple[str, str]  # (location_id, material_type) — §5.2.5 prior mapping


@dataclass(frozen=True)
class _DueSeries:
    """A due series with its urgency inputs (fill desc, rate desc, key asc)."""

    location_id: str
    material_type: str
    fill_pct: float
    rate_pct_per_day: float

    @property
    def urgency_sort_key(self) -> tuple[float, float, str, str]:
        """§4.8 urgency order: fill desc, rate desc, key ascending."""
        return (-self.fill_pct, -self.rate_pct_per_day, self.location_id, self.material_type)


@dataclass(frozen=True)
class SchedulerDayRecord:
    """One scheduled day — §4.8 counting + §5.2.5-style daily detail.

    ``stops_due`` is the due count at day start; ``stops_served`` splits into
    the capacity slot (most urgent first) and ``overflow_guard_served``
    (next-day fill would exceed 100 % — served anyway, peak staffing);
    ``stops_deferred`` are due series pushed to the next day. All figures
    [predicted — simulation on observed rates].
    """

    date: date
    stops_due: int
    stops_served: int
    stops_deferred: int
    overflow_guard_served: int
    trucks_used: int
    overflow_containers: int  # container-days with end-of-day fill > 100
    cost_eur: float
    cumulative_cost_eur: float


@dataclass(frozen=True)
class SchedulerPlan:
    """Complete §4.8 optimised plan over the replay window [predicted].

    ``median_trucks``/``peak_trucks`` describe the per-ACTIVE-day truck
    distribution (``None`` iff no stops were served in the window);
    ``deferrals_total`` counts series-day deferral events and
    ``max_wait_days`` the longest span (days) a due series waited — the
    explainability counterpart of the cost figure (§6). Skipped series
    (no usable rate) are reported, never dropped.
    """

    start_date: date
    end_date: date
    replay_days: int  # inclusive span
    stops_per_truck_day: int  # echoed capacity derivation (§4.8 formula)
    days: tuple[SchedulerDayRecord, ...]  # chronological
    active_days: int  # days with >= 1 stop served
    stops_total: int
    truck_days: int
    cost_eur_total: float
    cost_eur_per_calendar_year: float  # [predicted]: x 365 / replay_days
    median_trucks: float | None
    peak_trucks: int | None
    weekdays: tuple[WeekdayPattern, ...]  # Mon..Sun, active days only
    service: ServiceMetrics  # §5.2.4 metrics — always beside cost (§6)
    skipped: list[SkippedSeries]
    deferrals_total: int
    max_wait_days: int | None  # None iff no deferral ever happened
    fills_at_emptying: tuple[float, ...]  # raw simulated fill at each emptying


def effective_stop_service_minutes(config: SimulationConfig) -> int:
    """Effective per-stop service minutes — §4.2 v4: ``containers_per_series``
    same-colour containers each pay their own emptying minutes."""
    return config.service_minutes_per_stop * config.containers_per_series


def stops_per_truck_day(config: SimulationConfig) -> int:
    """§4.8 daily capacity: ``floor((shift - 2xtravel - disposal) /
    (service + travel))`` (flat mode §4.4; §4.6 defaults -> 28).

    A capacity below 1 stop/day cannot schedule anything — honest
    ``ValueError`` instead of a silent always-deferring plan.
    """
    overhead = 2 * config.fixed_travel_minutes + config.disposal_service_minutes
    per_stop = effective_stop_service_minutes(config) + config.fixed_travel_minutes
    remaining = config.max_shift_minutes - overhead
    if remaining < per_stop:
        raise ValueError(
            "stops_per_truck_day would be 0: max_shift_minutes "
            f"({config.max_shift_minutes}) minus depot/disposal overhead "
            f"({overhead} min) leaves less than one stop ({per_stop} min); "
            "no schedule exists under this config"
        )
    return remaining // per_stop


def schedule_collection_days(
    series_estimates: list[SeriesDaysToFull],
    config: SimulationConfig,
    start_date: date,
    end_date: date,
    *,
    prior_emptying_dates: dict[SERIES_KEY, date],
) -> SchedulerPlan:
    """§4.8 day-spreading replay over ``[start_date, end_date]``.

    Same clock contract as :func:`src.collection.simulation.simulate_strategy`
    (§5.2.5 v4 addendum): every mapped prior date must be <= ``start_date``
    (else :class:`SimulationConfigError` — honest failure, never a clamp);
    absent keys start empty at ``start_date``. Deterministic; input order of
    ``series_estimates`` does not matter (duplicate keys are a ``ValueError``).
    """
    if end_date < start_date:
        raise ValueError(f"end_date {end_date} is before start_date {start_date}")
    for key, prior_date in prior_emptying_dates.items():
        if prior_date > start_date:
            raise SimulationConfigError(
                f"prior_emptying_dates must be <= start_date {start_date}: {key} -> {prior_date}"
            )
    capacity = stops_per_truck_day(config)

    active, skipped = _active_estimates(series_estimates)
    seen: set[SERIES_KEY] = set()
    for estimate in active:
        key = (estimate.location_id, estimate.material_type)
        if key in seen:
            raise ValueError(f"duplicate series key in estimates: {key}")
        seen.add(key)

    # §5.2.5 v4 addendum clock: caller-supplied pre-window date when present,
    # else start_date (series starts empty).
    last_emptying: dict[SERIES_KEY, date] = {
        (estimate.location_id, estimate.material_type): prior_emptying_dates.get(
            (estimate.location_id, estimate.material_type), start_date
        )
        for estimate in active
    }
    rate_of: dict[SERIES_KEY, float] = {}
    for estimate in active:
        assert estimate.rate_pct_per_day is not None  # _active_estimates guarantees
        rate_of[(estimate.location_id, estimate.material_type)] = estimate.rate_pct_per_day
    pending_since: dict[SERIES_KEY, date] = {}  # first deferral day per waiting series

    days: list[SchedulerDayRecord] = []
    cumulative_cost = 0.0
    truck_days_total = 0
    stops_total = 0
    deferrals_total = 0
    max_wait_days: int | None = None
    fills_at_emptying: list[float] = []
    container_days = 0
    overflow_container_days = 0
    full_emptyings = 0
    max_fill: float | None = None

    day = start_date
    while day <= end_date:
        # 1) Due set: projected fill >= threshold (fill 0 + rate x days since).
        due: list[_DueSeries] = []
        for key, rate in rate_of.items():
            fill = max(0.0, rate * (day - last_emptying[key]).days)
            if fill >= config.select_threshold_pct:
                due.append(
                    _DueSeries(
                        location_id=key[0],
                        material_type=key[1],
                        fill_pct=fill,
                        rate_pct_per_day=rate,
                    )
                )
        due.sort(key=lambda item: item.urgency_sort_key)

        # 2) Capacity cut: the most urgent fit the day; the rest defer…
        within_capacity = due[:capacity]
        overflowed = due[capacity:]
        # …EXCEPT series whose next-day projected fill (fill + rate) would
        # exceed 100 % — served the same day (peak staffing, unbounded).
        guard_served = [
            item for item in overflowed if item.fill_pct + item.rate_pct_per_day > FULL_FILL_PCT
        ]
        deferred = [
            item for item in overflowed if item.fill_pct + item.rate_pct_per_day <= FULL_FILL_PCT
        ]
        served = within_capacity + guard_served

        # 3) Serve: reset clocks, record §5.2.4 emptying stats + waits.
        for item in served:
            key = (item.location_id, item.material_type)
            fills_at_emptying.append(item.fill_pct)
            if item.fill_pct >= FULL_FILL_PCT:
                full_emptyings += 1
            last_emptying[key] = day
            if key in pending_since:
                wait = (day - pending_since.pop(key)).days
                max_wait_days = wait if max_wait_days is None else max(max_wait_days, wait)
        for item in deferred:
            key = (item.location_id, item.material_type)
            deferrals_total += 1
            pending_since.setdefault(key, day)

        # 4) End-of-day service level over every active series (§5.2.4);
        # measured AFTER the service reset (step 3), so a seeded past-full
        # fill is reset before this and never counted here.
        overflow_today = 0
        for key, rate in rate_of.items():
            end_of_day_fill = max(0.0, rate * (day - last_emptying[key]).days)
            container_days += 1
            if end_of_day_fill > FULL_FILL_PCT:
                overflow_today += 1
                overflow_container_days += 1
            if max_fill is None or end_of_day_fill > max_fill:
                max_fill = end_of_day_fill

        # 5) §4.8 counting: trucks by stop capacity, unbounded staffing.
        trucks_today = (len(served) + capacity - 1) // capacity if served else 0
        truck_days_total += trucks_today
        stops_total += len(served)
        cost_today = round(trucks_today * config.cost_per_truck_day_eur, 2)
        cumulative_cost = round(cumulative_cost + cost_today, 2)
        days.append(
            SchedulerDayRecord(
                date=day,
                stops_due=len(due),
                stops_served=len(served),
                stops_deferred=len(deferred),
                overflow_guard_served=len(guard_served),
                trucks_used=trucks_today,
                overflow_containers=overflow_today,
                cost_eur=cost_today,
                cumulative_cost_eur=cumulative_cost,
            )
        )
        day = day + timedelta(days=1)

    replay_days = (end_date - start_date).days + 1
    active_day_records = [record for record in days if record.stops_served > 0]
    trucks_per_active_day = [record.trucks_used for record in active_day_records]
    by_weekday: dict[int, list[int]] = defaultdict(list)
    for record in active_day_records:
        by_weekday[record.date.weekday()].append(record.trucks_used)
    weekdays = tuple(
        WeekdayPattern(
            weekday=WEEKDAY_NAMES[w],
            active_days=len(by_weekday[w]),
            mean_trucks=(round(statistics.fmean(by_weekday[w]), 2) if by_weekday[w] else None),
        )
        for w in range(7)
    )
    service = ServiceMetrics(
        overflow_share_pct=(
            round(100.0 * overflow_container_days / container_days, 1) if container_days else None
        ),
        share_emptyings_full_or_overfull_pct=(
            round(100.0 * full_emptyings / len(fills_at_emptying), 1) if fills_at_emptying else None
        ),
        max_fill_pct=round(max_fill, 1) if max_fill is not None else None,
    )
    cost_eur_total = round(truck_days_total * config.cost_per_truck_day_eur, 2)
    return SchedulerPlan(
        start_date=start_date,
        end_date=end_date,
        replay_days=replay_days,
        stops_per_truck_day=capacity,
        days=tuple(days),
        active_days=len(active_day_records),
        stops_total=stops_total,
        truck_days=truck_days_total,
        cost_eur_total=cost_eur_total,
        cost_eur_per_calendar_year=round(cost_eur_total * 365.0 / replay_days, 2),
        median_trucks=(
            float(statistics.median(trucks_per_active_day)) if trucks_per_active_day else None
        ),
        peak_trucks=max(trucks_per_active_day) if trucks_per_active_day else None,
        weekdays=weekdays,
        service=service,
        skipped=skipped,
        deferrals_total=deferrals_total,
        max_wait_days=max_wait_days,
        fills_at_emptying=tuple(fills_at_emptying),
    )
