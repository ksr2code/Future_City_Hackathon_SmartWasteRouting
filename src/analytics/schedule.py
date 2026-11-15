"""Observed service schedule audit (M17 P0) — docs/contracts.md §4.8.

Derives the OBSERVED service schedule from the canonical dataset: one row =
one emptying record (contract §1.5), so row counts are visit counts. Every
figure produced here is [observed]; the only derived transform is the
annualisation ``visits_per_year = visits x 365 / span_days`` with ``span_days``
counted inclusively — a formula stated here, not a claim of fixed-frequency
service (the fixed-28-day cycle lives only in §5.2.4 [demo assumption]).

Zero-visit calendar days are NEVER treated as service days: ``active_days``
(distinct dates carrying ≥1 visit) is reported separately from calendar-day
occurrences of each weekday, and weekday means/medians/maxima normalise over
active days only.

Stdlib only; deterministic ordering everywhere (series sorted by
(location_id, material), dates chronological, weekdays Mon..Sun). The
markdown profile builder refuses synthetic-fixture ids so a fixture run can
never overwrite docs/schedule_profile.md with synthetic numbers.
"""

from __future__ import annotations

import statistics
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import TypeAlias

from src.analytics.spatial import require_real_ids
from src.data.loader import load_glass_fill_csv
from src.data.schema import MATERIALS, Dataset, MaterialType, ReadingRecord

WEEKDAY_NAMES: tuple[str, ...] = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
SERIES_KEY: TypeAlias = tuple[str, MaterialType]
"""One container series = (location_id, material_type) — contract §1.1."""

DAYS_PER_YEAR: int = 365
"""Annualisation divisor for visits_per_year (stated formula, §4.8)."""

DEFAULT_CSV = Path("data/raw/glass_fill_levels_anonymized_f.csv")
DEFAULT_PROFILE_PATH = Path("docs/schedule_profile.md")

_MATERIAL_RANK: dict[str, int] = {m: i for i, m in enumerate(MATERIALS)}


@dataclass(frozen=True)
class SeriesVisits:
    """Visit count and annualised rate for one series [observed x formula]."""

    location_id: str
    material_type: MaterialType
    visits: int  # emptying records for this series in the window
    visits_per_year: float  # visits x 365 / span_days (inclusive span)


@dataclass(frozen=True)
class DayVisits:
    """Visits on one observed date. Zero-visit dates are absent by design."""

    date: date
    visits: int


@dataclass(frozen=True)
class WeekdayVisits:
    """Per-weekday visit profile over the inclusive span.

    active_days counts distinct observed dates; calendar_days counts that
    weekday's occurrences in [date_min, date_max]. Statistics over active
    days only — zero-visit days never dilute or masquerade as service days.
    """

    weekday: str  # Mon..Sun
    active_days: int
    calendar_days: int
    total_visits: int
    mean_visits_per_active_day: float | None  # None when active_days == 0
    median_visits_per_active_day: float | None  # None when active_days == 0
    max_visits_per_active_day: int | None  # None when active_days == 0
    visit_share: float  # total_visits / grand total


@dataclass(frozen=True)
class ObservedSchedule:
    """Complete observed schedule over the dataset window [observed]."""

    date_min: date
    date_max: date
    span_days: int  # inclusive: (date_max - date_min).days + 1
    active_days: int  # distinct dates with ≥1 visit
    total_visits: int
    per_series: tuple[SeriesVisits, ...]  # sorted (location_id, material)
    per_date: tuple[DayVisits, ...]  # chronological
    weekdays: tuple[WeekdayVisits, ...]  # Mon..Sun

    def series_visits_per_year(self) -> list[float]:
        """All per-series visits/year values, ascending (for distributions)."""
        return sorted(s.visits_per_year for s in self.per_series)


def span_days_inclusive(date_min: date, date_max: date) -> int:
    """Inclusive day count between two dates (single day → 1)."""
    return (date_max - date_min).days + 1


def visits_per_year(visits: int, span_days: int) -> float:
    """Annualise a visit count over the inclusive span (stated formula §4.8)."""
    if span_days <= 0:
        raise ValueError(f"span_days must be >= 1, got {span_days}")
    return visits * DAYS_PER_YEAR / span_days


def per_series_visit_counts(readings: list[ReadingRecord]) -> dict[SERIES_KEY, int]:
    """Visit counts per series key (location_id, material_type) [observed]."""
    counts: Counter[SERIES_KEY] = Counter()
    for r in readings:
        counts[(r.location_id, r.material_type)] += 1
    return dict(counts)


def per_date_visit_counts(readings: list[ReadingRecord]) -> dict[date, int]:
    """Visit counts per observed date; zero-visit dates are absent [observed]."""
    counts: Counter[date] = Counter()
    for r in readings:
        counts[r.date] += 1
    return dict(counts)


def weekday_stats(readings: list[ReadingRecord]) -> tuple[WeekdayVisits, ...]:
    """Weekday visit profile over the span, active days only [observed]."""
    if not readings:
        raise ValueError("weekday_stats requires at least one reading")
    dates = [r.date for r in readings]
    date_min, date_max = min(dates), max(dates)
    per_date = per_date_visit_counts(readings)

    by_weekday_visits: list[list[int]] = [[] for _ in range(7)]
    for day, visits in per_date.items():
        by_weekday_visits[day.weekday()].append(visits)

    total_visits = len(readings)
    stats: list[WeekdayVisits] = []
    for w in range(7):
        day_counts = sorted(by_weekday_visits[w])
        active = len(day_counts)
        total = sum(day_counts)
        stats.append(
            WeekdayVisits(
                weekday=WEEKDAY_NAMES[w],
                active_days=active,
                calendar_days=_count_weekday_occurrences(date_min, date_max, w),
                total_visits=total,
                mean_visits_per_active_day=(total / active) if active else None,
                median_visits_per_active_day=(
                    float(statistics.median(day_counts)) if active else None
                ),
                max_visits_per_active_day=max(day_counts) if active else None,
                visit_share=total / total_visits,
            )
        )
    return tuple(stats)


def compute_observed_schedule(readings: list[ReadingRecord]) -> ObservedSchedule:
    """Aggregate the full observed schedule from readings [observed].

    Deterministic: identical input rows in any order yield an identical result.
    """
    if not readings:
        raise ValueError("compute_observed_schedule requires at least one reading")
    dates = [r.date for r in readings]
    date_min, date_max = min(dates), max(dates)
    span = span_days_inclusive(date_min, date_max)

    per_series = tuple(
        SeriesVisits(
            location_id=location_id,
            material_type=material,
            visits=count,
            visits_per_year=visits_per_year(count, span),
        )
        for location_id, material, count in sorted(
            ((key[0], key[1], count) for key, count in per_series_visit_counts(readings).items()),
            key=lambda item: (item[0], _MATERIAL_RANK[item[1]]),
        )
    )
    per_date = tuple(
        DayVisits(date=day, visits=count)
        for day, count in sorted(per_date_visit_counts(readings).items())
    )
    return ObservedSchedule(
        date_min=date_min,
        date_max=date_max,
        span_days=span,
        active_days=len(per_date),
        total_visits=len(readings),
        per_series=per_series,
        per_date=per_date,
        weekdays=weekday_stats(readings),
    )


def percentile(sorted_values: list[float], q: float) -> float | None:
    """Linear-interpolation percentile of ascending values (q in [0, 1])."""
    if not sorted_values:
        return None
    if not 0.0 <= q <= 1.0:
        raise ValueError(f"q must be in [0, 1], got {q}")
    position = q * (len(sorted_values) - 1)
    lower = int(position)
    upper = min(lower + 1, len(sorted_values) - 1)
    fraction = position - lower
    return sorted_values[lower] + fraction * (sorted_values[upper] - sorted_values[lower])


def build_schedule_profile(dataset: Dataset) -> str:
    """Render docs/schedule_profile.md content from a loaded dataset.

    Refuses synthetic-fixture ids: this file documents the REAL observed
    schedule (M17 §4.8); fixtures live only in tests.
    """
    require_real_ids(dataset.readings)
    schedule = compute_observed_schedule(dataset.readings)
    return _render_markdown(schedule)


# --- rendering helpers -----------------------------------------------------


_VISITS_PER_YEAR_BUCKETS: tuple[tuple[str, float, float], ...] = (
    ("< 6", 0.0, 6.0),
    ("6 - < 13", 6.0, 13.0),
    ("13 - < 26", 13.0, 26.0),
    ("26 - < 52", 26.0, 52.0),
    ("≥ 52", 52.0, float("inf")),
)


def _render_markdown(schedule: ObservedSchedule) -> str:
    lines: list[str] = []
    zero_visit_days = schedule.span_days - schedule.active_days
    rates = schedule.series_visits_per_year()

    lines.append("# Observed service schedule profile (M17 P0)")
    lines.append("")
    lines.append(
        "Source: `data/raw/glass_fill_levels_anonymized_f.csv` loaded through the"
        " canonical loader (`src/data/loader.py`, contracts §1). One row = one"
        " emptying record (§1.5), so row counts are visit counts. Every figure is"
        " [observed] unless marked otherwise; the only derived transform is"
        " `visits_per_year = visits x 365 / span_days` (span inclusive) — a stated"
        " formula, **not** a fixed-frequency service claim. Zero-visit calendar"
        " days are never counted as service days."
    )
    lines.append("")
    lines.append("Reproduce: `.venv/bin/python -m src.analytics.schedule`")
    lines.append("")

    lines.append("## 1. Window (observed)")
    lines.append("")
    lines.append(
        f"- Span: {schedule.date_min.isoformat()} .. {schedule.date_max.isoformat()}"
        f" = **{schedule.span_days} days** (inclusive)"
    )
    lines.append(f"- Total visits (emptying records): **{schedule.total_visits:,}**")
    lines.append(
        f"- Active days (≥1 visit): **{schedule.active_days}**"
        f" ({schedule.active_days / schedule.span_days:.1%} of span)"
    )
    lines.append(f"- Zero-visit days in span: {zero_visit_days} — never treated as service days")
    lines.append(f"- Series (location x material): {len(schedule.per_series)}")
    lines.append("")

    lines.append("## 2. Per-day visits on active days (observed)")
    lines.append("")
    day_counts = sorted(float(d.visits) for d in schedule.per_date)
    lines.append("| statistic | visits/day |")
    lines.append("|---|---|")
    for label, q in (("p10", 0.10), ("median", 0.50), ("p90", 0.90), ("p99", 0.99)):
        value = percentile(day_counts, q)
        lines.append(f"| {label} | {value:.1f} |" if value is not None else f"| {label} | — |")
    assert day_counts  # compute_observed_schedule guarantees non-empty
    lines.append(f"| min | {day_counts[0]:.0f} |")
    lines.append(f"| max | {day_counts[-1]:.0f} |")
    lines.append(f"| mean | {schedule.total_visits / schedule.active_days:.1f} |")
    lines.append("")
    lines.append("Most common per-day visit counts (top 8):")
    lines.append("")
    lines.append("| visits that day | days | share of active days |")
    lines.append("|---|---|---|")
    for count, days in Counter(d.visits for d in schedule.per_date).most_common(8):
        lines.append(f"| {count} | {days} | {days / schedule.active_days:.1%} |")
    lines.append("")

    lines.append("## 3. Per-series visits/year (observed x stated formula)")
    lines.append("")
    lines.append(f"Distribution of `visits x 365 / {schedule.span_days}` over {len(rates)} series:")
    lines.append("")
    lines.append("| statistic | visits/year |")
    lines.append("|---|---|")
    for label, q in (("p10", 0.10), ("p25", 0.25), ("median", 0.50), ("p75", 0.75), ("p90", 0.90)):
        value = percentile(rates, q)
        lines.append(f"| {label} | {value:.2f} |" if value is not None else f"| {label} | — |")
    lines.append(f"| min | {rates[0]:.2f} |")
    lines.append(f"| max | {rates[-1]:.2f} |")
    lines.append("")
    median_rate = percentile(rates, 0.5)
    assert median_rate is not None  # compute_observed_schedule guarantees non-empty
    lines.append(
        "Note: this per-series median"
        f" ({median_rate:.2f} visits/year ≈ one visit every ~{DAYS_PER_YEAR / median_rate:.0f}"
        " days for the typical series) differs from the 28-day median of pooled"
        " consecutive-visit gaps (data_profile §14): busy series contribute many"
        " short gaps to the pooled figure. Both are [observed], different weights."
    )
    lines.append("")
    lines.append("| visits/year bucket | series | share |")
    lines.append("|---|---|---|")
    for label, low, high in _VISITS_PER_YEAR_BUCKETS:
        n = sum(1 for r in rates if low <= r < high)
        lines.append(f"| {label} | {n} | {n / len(rates):.1%} |")
    lines.append("")

    lines.append("## 4. Weekday profile (observed; active days only)")
    lines.append("")
    lines.append("calendar_days = occurrences of that weekday in the span;")
    lines.append("statistics normalise over active days only — zero-visit days excluded.")
    lines.append("")
    lines.append(
        "| weekday | active days | calendar days | mean visits (active) |"
        " median | max | visit share |"
    )
    lines.append("|---|---|---|---|---|---|---|")
    for w in schedule.weekdays:
        mean = (
            "—" if w.mean_visits_per_active_day is None else f"{w.mean_visits_per_active_day:.1f}"
        )
        median = (
            "—"
            if w.median_visits_per_active_day is None
            else f"{w.median_visits_per_active_day:.0f}"
        )
        maximum = "—" if w.max_visits_per_active_day is None else str(w.max_visits_per_active_day)
        lines.append(
            f"| {w.weekday} | {w.active_days} | {w.calendar_days} | {mean} |"
            f" {median} | {maximum} | {w.visit_share:.1%} |"
        )
    lines.append("")
    lines.append(
        "Interpretation (kept separate from observation): emptying activity"
        " concentrates on weekdays; weekend figures describe only the dates that"
        " actually carry records — no zero-day imputation is applied."
    )
    lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> None:
    """Load the real CSV, write docs/schedule_profile.md, print one summary."""
    args = sys.argv[1:] if argv is None else argv
    csv_path = Path(args[0]) if args else DEFAULT_CSV
    out_path = Path(args[1]) if len(args) > 1 else DEFAULT_PROFILE_PATH
    result = load_glass_fill_csv(csv_path)
    if result.errors:
        raise SystemExit(f"{csv_path}: {len(result.errors)} validation errors; aborting")
    markdown = build_schedule_profile(result.dataset)
    out_path.write_text(markdown, encoding="utf-8")
    schedule = compute_observed_schedule(result.dataset.readings)
    print(
        f"wrote {out_path}: span {schedule.span_days} d, active days"
        f" {schedule.active_days}, visits {schedule.total_visits},"
        f" median visits/year {percentile(schedule.series_visits_per_year(), 0.5):.2f}"
    )


def _count_weekday_occurrences(start: date, end: date, weekday: int) -> int:
    """Occurrences of one ISO weekday (Mon=0..Sun=6) in [start, end] inclusive."""
    total_weeks, remainder = divmod((end - start).days + 1, 7)
    count = total_weeks
    if (weekday - start.weekday()) % 7 < remainder:
        count += 1
    return count


if __name__ == "__main__":
    main()
