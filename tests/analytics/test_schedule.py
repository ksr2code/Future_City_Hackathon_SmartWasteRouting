"""Tests for the observed schedule audit (M17 P0) — src/analytics/schedule.py.

Logic is tested on SYNTHETIC- prefixed fixtures (isolated per M4 convention;
build_schedule_profile must REFUSE them). Real-CSV pins are skip-guarded via
tests.helpers.require_real_csv_path and assert only compact aggregates that
trace to docs/schedule_profile.md.
"""

from datetime import date, timedelta

import pytest

from src.analytics.schedule import (
    build_schedule_profile,
    compute_observed_schedule,
    per_date_visit_counts,
    per_series_visit_counts,
    percentile,
    span_days_inclusive,
    visits_per_year,
    weekday_stats,
)
from src.data.loader import load_glass_fill_csv
from src.data.schema import Dataset, DatasetSummary, MaterialType, ReadingRecord
from tests.helpers import require_real_csv_path

SYNTHETIC_PREFIX = "SYNTHETIC-"
BASE_DATE = date(2026, 1, 5)  # a Monday


def make_reading(
    location_id: str,
    material_type: MaterialType,
    day: date,
) -> ReadingRecord:
    """One synthetic emptying record; fill content is irrelevant to the audit."""
    return ReadingRecord(
        location_id=location_id,
        material_type=material_type,
        date=day,
        fill_level_pct=50,
        is_overfull=False,
    )


def make_dataset(readings: list[ReadingRecord]) -> Dataset:
    """Minimal dataset wrapper for the profile-builder guard test."""
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


@pytest.fixture()
def synthetic_readings() -> list[ReadingRecord]:
    """Three series: a busy Monday, two Mondays for median math, one Wednesday."""
    return [
        make_reading("SYNTHETIC-LOC-A", "brown", BASE_DATE),
        make_reading("SYNTHETIC-LOC-A", "brown", BASE_DATE),
        make_reading("SYNTHETIC-LOC-A", "brown", BASE_DATE),
        make_reading("SYNTHETIC-LOC-A", "green", BASE_DATE + timedelta(days=2)),
        make_reading("SYNTHETIC-LOC-B", "white", BASE_DATE),
        make_reading("SYNTHETIC-LOC-A", "brown", BASE_DATE + timedelta(days=7)),
    ]


class TestPerSeriesVisitCounts:
    def test_counts_aggregate_per_series(self, synthetic_readings: list[ReadingRecord]) -> None:
        counts = per_series_visit_counts(synthetic_readings)
        assert counts == {
            ("SYNTHETIC-LOC-A", "brown"): 4,
            ("SYNTHETIC-LOC-A", "green"): 1,
            ("SYNTHETIC-LOC-B", "white"): 1,
        }

    def test_empty_readings_give_empty_dict(self) -> None:
        assert per_series_visit_counts([]) == {}


class TestVisitsPerYear:
    def test_formula(self) -> None:
        # 10 visits over an inclusive 350-day span.
        assert visits_per_year(10, 350) == pytest.approx(10 * 365 / 350)

    def test_span_is_inclusive(self) -> None:
        assert span_days_inclusive(date(2026, 3, 1), date(2026, 3, 1)) == 1
        assert span_days_inclusive(date(2026, 3, 1), date(2026, 3, 10)) == 10
        # One visit on a single-day window annualises to a full year of that visit.
        assert visits_per_year(1, 1) == 365.0

    def test_rejects_non_positive_span(self) -> None:
        with pytest.raises(ValueError, match="span_days"):
            visits_per_year(1, 0)


class TestPerDateVisitCounts:
    def test_only_observed_dates_present(self, synthetic_readings: list[ReadingRecord]) -> None:
        counts = per_date_visit_counts(synthetic_readings)
        # BASE_DATE + 1 day has zero visits and must be ABSENT, not imputed as 0.
        assert counts == {
            BASE_DATE: 4,
            BASE_DATE + timedelta(days=2): 1,
            BASE_DATE + timedelta(days=7): 1,
        }


class TestWeekdayStats:
    def test_active_days_vs_calendar_days(self, synthetic_readings: list[ReadingRecord]) -> None:
        stats = {w.weekday: w for w in weekday_stats(synthetic_readings)}
        # Span BASE_DATE .. BASE_DATE+7: Monday occurs twice, every other weekday once.
        assert stats["Mon"].calendar_days == 2
        assert stats["Tue"].calendar_days == 1
        assert stats["Sun"].calendar_days == 1
        # Monday is active on both its calendar days; Tuesday never sees a visit.
        assert stats["Mon"].active_days == 2
        assert stats["Tue"].active_days == 0
        # Tuesday statistics stay None — zero days are never fabricated as service.
        assert stats["Tue"].mean_visits_per_active_day is None
        assert stats["Tue"].median_visits_per_active_day is None
        assert stats["Tue"].max_visits_per_active_day is None
        assert stats["Tue"].total_visits == 0

    def test_statistics_normalise_over_active_days_only(
        self, synthetic_readings: list[ReadingRecord]
    ) -> None:
        stats = {w.weekday: w for w in weekday_stats(synthetic_readings)}
        monday = stats["Mon"]
        assert monday.total_visits == 5  # 3 (A brown) + 1 (B white) + 1 (A brown)
        assert monday.active_days == 2
        assert monday.mean_visits_per_active_day == pytest.approx(2.5)  # [4, 1]
        assert monday.median_visits_per_active_day == pytest.approx(2.5)
        assert monday.max_visits_per_active_day == 4

    def test_visit_shares_sum_to_one(self, synthetic_readings: list[ReadingRecord]) -> None:
        stats = weekday_stats(synthetic_readings)
        assert sum(w.visit_share for w in stats) == pytest.approx(1.0)

    def test_empty_readings_rejected(self) -> None:
        with pytest.raises(ValueError, match="at least one reading"):
            weekday_stats([])


class TestComputeObservedSchedule:
    def test_order_independence(self, synthetic_readings: list[ReadingRecord]) -> None:
        schedule_a = compute_observed_schedule(synthetic_readings)
        schedule_b = compute_observed_schedule(list(reversed(synthetic_readings)))
        assert schedule_a == schedule_b

    def test_aggregates(self, synthetic_readings: list[ReadingRecord]) -> None:
        schedule = compute_observed_schedule(synthetic_readings)
        assert (schedule.date_min, schedule.date_max) == (
            BASE_DATE,
            BASE_DATE + timedelta(days=7),
        )
        assert schedule.span_days == 8  # inclusive
        assert schedule.active_days == 3
        assert schedule.total_visits == 6
        assert len(schedule.per_series) == 3
        # Series sorted by (location_id, material rank brown < green < white).
        assert [(s.location_id, s.material_type) for s in schedule.per_series] == [
            ("SYNTHETIC-LOC-A", "brown"),
            ("SYNTHETIC-LOC-A", "green"),
            ("SYNTHETIC-LOC-B", "white"),
        ]
        assert [s.visits for s in schedule.per_series] == [4, 1, 1]
        # Annualisation uses the inclusive span.
        assert schedule.per_series[0].visits_per_year == pytest.approx(4 * 365 / 8)
        # Dates chronological.
        assert [d.date for d in schedule.per_date] == [
            BASE_DATE,
            BASE_DATE + timedelta(days=2),
            BASE_DATE + timedelta(days=7),
        ]
        assert [d.visits for d in schedule.per_date] == [4, 1, 1]

    def test_single_date_dataset(self) -> None:
        schedule = compute_observed_schedule(
            [make_reading("SYNTHETIC-LOC-A", "brown", date(2026, 2, 1))]
        )
        assert schedule.span_days == 1
        assert schedule.active_days == 1
        assert schedule.per_series[0].visits_per_year == 365.0

    def test_empty_readings_rejected(self) -> None:
        with pytest.raises(ValueError, match="at least one reading"):
            compute_observed_schedule([])


class TestPercentile:
    def test_linear_interpolation(self) -> None:
        values = [1.0, 2.0, 3.0, 4.0]
        assert percentile(values, 0.0) == 1.0
        assert percentile(values, 0.5) == 2.5
        assert percentile(values, 1.0) == 4.0
        assert percentile(values, 0.25) == pytest.approx(1.75)

    def test_empty_values(self) -> None:
        assert percentile([], 0.5) is None

    def test_rejects_out_of_range_q(self) -> None:
        with pytest.raises(ValueError, match=r"q must be in \[0, 1\]"):
            percentile([1.0], 1.5)


class TestSyntheticGuard:
    def test_profile_builder_refuses_synthetic_ids(
        self, synthetic_readings: list[ReadingRecord]
    ) -> None:
        with pytest.raises(ValueError, match="SYNTHETIC"):
            build_schedule_profile(make_dataset(synthetic_readings))


@pytest.fixture(scope="module")
def real_schedule():
    """Real-CSV observed schedule loaded once; skips when the CSV is absent."""
    loaded = load_glass_fill_csv(require_real_csv_path())
    assert not loaded.errors, f"real CSV must load cleanly: {loaded.errors[:3]}"
    return compute_observed_schedule(loaded.dataset.readings)


class TestRealCsvPins:
    """Compact [observed] pins — docs/schedule_profile.md (M17 P0)."""

    def test_window_and_totals(self, real_schedule) -> None:
        assert real_schedule.date_min == date(2025, 10, 17)
        assert real_schedule.date_max == date(2026, 9, 30)
        assert real_schedule.span_days == 349
        assert real_schedule.total_visits == 11701  # data_profile §17
        assert len(real_schedule.per_series) == 1338  # §7
        assert real_schedule.active_days == 229
        assert real_schedule.span_days - real_schedule.active_days == 120  # zero-visit days

    def test_per_day_distribution(self, real_schedule) -> None:
        day_counts = sorted(float(d.visits) for d in real_schedule.per_date)
        assert day_counts[0] == 3.0
        assert day_counts[-1] == 127.0
        assert percentile(day_counts, 0.5) == 51.0
        assert percentile(day_counts, 0.9) == pytest.approx(78.0)
        assert real_schedule.total_visits / real_schedule.active_days == pytest.approx(
            51.0961, abs=1e-3
        )

    def test_per_series_visits_per_year(self, real_schedule) -> None:
        rates = real_schedule.series_visits_per_year()
        assert len(rates) == 1338
        assert rates[0] == pytest.approx(1.0458, abs=1e-3)  # single-visit series
        assert rates[-1] == pytest.approx(38.6963, abs=1e-3)
        assert percentile(rates, 0.5) == pytest.approx(8.3668, abs=1e-3)
        assert percentile(rates, 0.1) == pytest.approx(3.1375, abs=1e-3)
        assert percentile(rates, 0.9) == pytest.approx(15.6877, abs=1e-3)
        # Bucket table edges (<6, 6-<13, 13-<26, 26-<52, >=52).
        edges = ((0.0, 6.0), (6.0, 13.0), (13.0, 26.0), (26.0, 52.0), (52.0, float("inf")))
        buckets = [sum(1 for r in rates if lo <= r < hi) for lo, hi in edges]
        assert buckets == [397, 668, 258, 15, 0]

    def test_weekday_profile(self, real_schedule) -> None:
        stats = {w.weekday: w for w in real_schedule.weekdays}
        order = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
        # 349 days = 49 full weeks + 6 remainder days (Fri..Wed) → Thu occurs 49x.
        assert [stats[d].calendar_days for d in order] == [50, 50, 50, 49, 50, 50, 50]
        assert [stats[d].active_days for d in order] == [43, 42, 44, 42, 41, 11, 6]
        assert stats["Mon"].total_visits == 1959
        assert stats["Mon"].mean_visits_per_active_day == pytest.approx(45.5581, abs=1e-3)
        assert stats["Mon"].median_visits_per_active_day == 45.0
        assert stats["Wed"].max_visits_per_active_day == 127
        assert stats["Sat"].total_visits == 444
        assert stats["Sat"].mean_visits_per_active_day == pytest.approx(40.3636, abs=1e-3)
        assert stats["Sun"].total_visits == 21
        assert stats["Sun"].max_visits_per_active_day == 6
        assert sum(w.visit_share for w in real_schedule.weekdays) == pytest.approx(1.0)

    def test_profile_markdown_renders(self, real_schedule) -> None:
        loaded = load_glass_fill_csv(require_real_csv_path())
        markdown = build_schedule_profile(loaded.dataset)
        assert markdown.startswith("# Observed service schedule profile (M17 P0)")
        assert "[observed]" in markdown
        assert "python -m src.analytics.schedule" in markdown
        assert "229" in markdown  # active days appear in the rendered profile
