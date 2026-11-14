"""Days-to-full estimates (M15) — docs/contracts.md §5.2.3.

For every series ``(location_id, material_type)`` the fill history is turned
into an estimated number of days until the container reaches 100 percent,
using only information in the readings (nothing about container volume,
emptying events or future behaviour exists in the data):

- ``rate_pct_per_day`` is the median over **consecutive numeric reading
  pairs with a positive delta** of ``Δfill_pct / Δdays``. Pairs are taken in
  date order; overfull readings break pairs (never coerced, contract §1.1)
  and drops — probable emptyings [observed: no collection events in the
  data] are excluded, never treated as negative accumulation. The positive
  rates are the subset of :func:`collect_numeric_rates_pct_per_day` with a
  value > 0 (a skipped non-positive gap cannot produce a positive rate).
- ``days_to_full = max(0, (100 - last numeric fill) / rate)``, rounded to
  1 decimal place (Python ``round``).

Reason codes — no estimate is ever fabricated:

- ``already_full``: the last reading is the overfull token or numeric 100 →
  ``days_to_full = 0.0`` exactly (a state fact, not an estimate). This is
  the one case where a ``reason`` is set **and** ``days_to_full`` is present,
  as pinned by contract §5.2.3; for every other reason ``days_to_full`` is
  ``None``.
- ``no_numeric_history``: fewer than 2 numeric readings → no rate possible.
- ``no_positive_rate``: numeric history exists but no increasing pair.

Precedence is ``already_full`` first (a full container needs no rate),
then ``no_numeric_history``, then ``no_positive_rate``.

Aggregate stats cover only series with a ``days_to_full`` value (including
``already_full`` zeros, which count towards ``series_with_estimate``); all
four aggregate days fields are ``None`` when no series has a value.

Deterministic: readings are sorted by date internally (stable sort; I1
guarantees unique dates within a series) and series are ordered by
``(location_id, material_type)``. Same input ⇒ identical output.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import date
from itertools import pairwise
from typing import Literal, TypeAlias

from src.data.schema import Dataset, MaterialType, ReadingRecord
from src.forecasting.features import (
    collect_numeric_rates_pct_per_day,
    group_by_series,
)

__all__ = [
    "DaysToFullReason",
    "DaysToFullResult",
    "DaysToFullStats",
    "SeriesDaysToFull",
    "build_days_to_full",
]

METHOD: Literal["median_positive_pair_rate"] = "median_positive_pair_rate"

DaysToFullReason: TypeAlias = Literal[
    "no_numeric_history",
    "no_positive_rate",
    "already_full",
]

REASON_NO_NUMERIC_HISTORY: DaysToFullReason = "no_numeric_history"
REASON_NO_POSITIVE_RATE: DaysToFullReason = "no_positive_rate"
REASON_ALREADY_FULL: DaysToFullReason = "already_full"

FULL_FILL_PCT = 100  # percent; numeric 100 is full, like the overfull token (loader range 0-100)


@dataclass(frozen=True)
class SeriesDaysToFull:
    """Days-to-full estimate of one series (contract §5.2.3).

    Units: ``last_fill_pct``/``rate_pct_per_day`` in percent and percentage
    points per day, ``days_to_full`` in days (1 d.p.). ``last_fill_pct`` is
    ``None`` exactly when ``last_is_overfull`` (invariant I3). ``days_to_full``
    is ``None`` exactly when ``reason`` is set and is not ``already_full``
    (``already_full`` keeps ``days_to_full = 0.0``).
    """

    location_id: str
    material_type: MaterialType
    last_date: date
    last_fill_pct: int | None  # percent; None iff the last reading is the overfull token
    last_is_overfull: bool
    rate_pct_per_day: float | None  # median positive consecutive-pair rate; None if no pair
    days_to_full: float | None  # days, 1 d.p.; None unless estimated or already_full
    reason: DaysToFullReason | None  # None iff days_to_full is an estimate


@dataclass(frozen=True)
class DaysToFullStats:
    """Aggregate stats over series with a ``days_to_full`` value (§5.2.3).

    Days fields are exact aggregates (not re-rounded) of the per-series
    1-d.p. values; all four are ``None`` when no series has a value.
    """

    series_total: int
    series_with_estimate: int
    median_days: float | None
    mean_days: float | None
    min_days: float | None
    max_days: float | None


@dataclass(frozen=True)
class DaysToFullResult:
    """Full days-to-full output (contract §5.2.3).

    ``method`` is fixed to the contract value; ``assumptions`` carries the
    required caveats with their provenance labels (observed gap is computed
    from this dataset, not hardcoded from the profile).
    """

    method: Literal["median_positive_pair_rate"]
    stats: DaysToFullStats
    series: list[SeriesDaysToFull]
    assumptions: list[str]


def _median_positive_rate_pct_per_day(readings: list[ReadingRecord]) -> float | None:
    """Median rate (pp/day) over consecutive numeric pairs with positive delta.

    Reuses the §2.2 pair logic (:func:`collect_numeric_rates_pct_per_day`):
    date-ordered pairs, overfull readings break pairs, gaps of 0 days are
    skipped (I1 makes them unreachable in valid data). Filtering the returned
    rates to > 0 is exactly "positive delta" because every kept pair has a
    strictly positive gap.
    """
    positive = [rate for rate in collect_numeric_rates_pct_per_day(readings) if rate > 0]
    return statistics.median(positive) if positive else None


def _observed_median_gap_days(dataset: Dataset) -> int | float | None:
    """Median gap in days between consecutive readings of a series (§14 grain).

    Same definition as docs/data_profile.md §14: a **pooled** median over ALL
    consecutive within-series gaps in date order (overfull rows included —
    gaps use dates, not fill values; 10,363 gaps for the real CSV = 11,701
    rows - 1,338 series first readings). Verified to reproduce the profile's
    28 d on the real CSV (2026-11-14); it is deliberately *not* the
    per-series median gap, which §14 reports separately (median 35 d).
    ``None`` when no series has a gap.
    """
    gaps: list[int] = []
    for _key, readings in sorted(group_by_series(dataset.readings).items()):
        ordered = sorted(readings, key=lambda reading: reading.date)
        gaps.extend(
            (current.date - previous.date).days
            for previous, current in pairwise(ordered)
            if current.date > previous.date
        )
    return statistics.median(gaps) if gaps else None


def _build_assumptions(dataset: Dataset) -> list[str]:
    """Contract §5.2.3 caveat labels, gap computed from the dataset itself."""
    assumptions = [
        "days_to_full values are predictions from fill history only [predicted]",
        "each estimate assumes a constant fill rate and no emptying between readings [assumption]",
    ]
    median_gap = _observed_median_gap_days(dataset)
    gap_label = (
        f"median reading gap {median_gap:g} d [observed]"
        if median_gap is not None
        else "reading gaps irregular; no median gap computable [observed]"
    )
    assumptions.append(gap_label)
    return assumptions


def _estimate_series(
    location_id: str,
    material_type: MaterialType,
    readings: list[ReadingRecord],
) -> SeriesDaysToFull:
    """One series' days-to-full row with contract §5.2.3 reason precedence."""
    ordered = sorted(readings, key=lambda reading: reading.date)
    last = ordered[-1]
    n_numeric = sum(1 for reading in ordered if reading.fill_level_pct is not None)
    rate = _median_positive_rate_pct_per_day(ordered)

    if last.is_overfull or last.fill_level_pct == FULL_FILL_PCT:
        reason: DaysToFullReason | None = REASON_ALREADY_FULL
        days_to_full: float | None = 0.0
    elif n_numeric < 2:
        reason = REASON_NO_NUMERIC_HISTORY
        days_to_full = None
    elif rate is None:
        reason = REASON_NO_POSITIVE_RATE
        days_to_full = None
    else:
        reason = None
        assert last.fill_level_pct is not None  # not overfull (I3), so numeric
        days_to_full = round(max(0.0, (FULL_FILL_PCT - last.fill_level_pct) / rate), 1)

    return SeriesDaysToFull(
        location_id=location_id,
        material_type=material_type,
        last_date=last.date,
        last_fill_pct=last.fill_level_pct,
        last_is_overfull=last.is_overfull,
        rate_pct_per_day=rate,
        days_to_full=days_to_full,
        reason=reason,
    )


def build_days_to_full(dataset: Dataset) -> DaysToFullResult:
    """Days-to-full for every series of a dataset (contract §5.2.3).

    Deterministic order and values; an empty dataset yields ``series_total``
    0 with all aggregate days fields ``None``.
    """
    series = [
        _estimate_series(location_id, material_type, readings)
        for (location_id, material_type), readings in sorted(
            group_by_series(dataset.readings).items()
        )
    ]
    days_values = [row.days_to_full for row in series if row.days_to_full is not None]
    stats = DaysToFullStats(
        series_total=len(series),
        series_with_estimate=len(days_values),
        median_days=float(statistics.median(days_values)) if days_values else None,
        mean_days=statistics.fmean(days_values) if days_values else None,
        min_days=min(days_values) if days_values else None,
        max_days=max(days_values) if days_values else None,
    )
    return DaysToFullResult(
        method=METHOD,
        stats=stats,
        series=series,
        assumptions=_build_assumptions(dataset),
    )
