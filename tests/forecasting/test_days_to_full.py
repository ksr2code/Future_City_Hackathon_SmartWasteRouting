"""Days-to-full tests — hand-computed contract §5.2.3 behaviour.

All fixtures are synthetic (SYNTHETIC- ids) and constructed from
:class:`ReadingRecord` directly; the fixture summary is derived from the
readings so no counter is fabricated.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from src.analytics.spatial import require_real_ids
from src.data.loader import load_glass_fill_csv
from src.data.schema import Dataset, DatasetSummary, MaterialType, ReadingRecord
from src.forecasting.days_to_full import (
    DaysToFullResult,
    build_days_to_full,
)
from src.forecasting.features import collect_numeric_rates_pct_per_day
from tests.helpers import require_real_csv_path

BASE_DATE = date(2026, 1, 1)


def make_reading(
    location_id: str,
    material_type: MaterialType,
    day_offset: int,
    fill_pct: int | None,
    *,
    overfull: bool = False,
) -> ReadingRecord:
    """One synthetic reading; ``fill_pct`` must be None exactly when overfull (I3)."""
    return ReadingRecord(
        location_id=location_id,
        material_type=material_type,
        date=BASE_DATE + timedelta(days=day_offset),
        fill_level_pct=None if overfull else fill_pct,
        is_overfull=overfull,
    )


def make_dataset(readings: list[ReadingRecord]) -> Dataset:
    """Dataset whose summary counters are derived from the readings themselves."""
    return Dataset(
        readings=readings,
        summary=DatasetSummary(
            n_rows=len(readings),
            n_locations=len({reading.location_id for reading in readings}),
            n_series=len({(r.location_id, r.material_type) for r in readings}),
            date_min=min((reading.date for reading in readings), default=None),
            date_max=max((reading.date for reading in readings), default=None),
            rows_per_material={
                material: sum(1 for reading in readings if reading.material_type == material)
                for material in ("brown", "green", "white")
            },
        ),
    )


def happy_path_readings(location_id: str = "SYNTHETIC-df-a") -> list[ReadingRecord]:
    """40 % @d0, 70 % @d30 (+1.0/d), 76 % @d64 (+6/34 ≈ 0.17647/d)."""
    return [
        make_reading(location_id, "brown", 0, 40),
        make_reading(location_id, "brown", 30, 70),
        make_reading(location_id, "brown", 64, 76),
    ]


class TestHappyPath:
    def test_hand_computed_estimate(self) -> None:
        result = build_days_to_full(make_dataset(happy_path_readings()))
        assert result.method == "median_positive_pair_rate"
        assert len(result.series) == 1
        row = result.series[0]
        expected_rate = (30 / 30 + 6 / 34) / 2
        assert row.rate_pct_per_day is not None
        assert row.rate_pct_per_day == pytest.approx(expected_rate)
        # median positive rate ≈ 0.588235 pp/day → (100 - 76)/rate = 40.8 d
        assert row.days_to_full == 40.8
        assert row.reason is None
        assert row.last_date == BASE_DATE + timedelta(days=64)
        assert row.last_fill_pct == 76
        assert row.last_is_overfull is False

    def test_stats_single_series(self) -> None:
        stats = build_days_to_full(make_dataset(happy_path_readings())).stats
        assert stats.series_total == 1
        assert stats.series_with_estimate == 1
        assert stats.median_days == 40.8
        assert stats.mean_days == 40.8
        assert stats.min_days == 40.8
        assert stats.max_days == 40.8


class TestAlreadyFull:
    def test_overfull_last_reading(self) -> None:
        readings = [
            make_reading("SYNTHETIC-df-b", "green", 0, 30),
            make_reading("SYNTHETIC-df-b", "green", 28, 55),
            make_reading("SYNTHETIC-df-b", "green", 56, None, overfull=True),
        ]
        row = build_days_to_full(make_dataset(readings)).series[0]
        assert row.reason == "already_full"
        assert row.days_to_full == 0.0
        assert row.last_fill_pct is None
        assert row.last_is_overfull is True
        assert row.last_date == BASE_DATE + timedelta(days=56)
        # positive history pairs still yield a reported rate (informational only)
        assert row.rate_pct_per_day == pytest.approx(25 / 28)

    def test_numeric_100_is_already_full(self) -> None:
        readings = [
            make_reading("SYNTHETIC-df-c", "white", 0, 50),
            make_reading("SYNTHETIC-df-c", "white", 30, 100),
        ]
        row = build_days_to_full(make_dataset(readings)).series[0]
        assert row.reason == "already_full"
        assert row.days_to_full == 0.0
        assert row.last_fill_pct == 100
        assert row.last_is_overfull is False

    def test_overfull_last_beats_no_numeric_history(self) -> None:
        # Precedence pinned per module docstring: the state fact (overfull now)
        # wins over the rate-history defect (here: < 2 numeric readings).
        readings = [
            make_reading("SYNTHETIC-df-d", "brown", 0, 50),
            make_reading("SYNTHETIC-df-d", "brown", 20, None, overfull=True),
        ]
        row = build_days_to_full(make_dataset(readings)).series[0]
        assert row.reason == "already_full"
        assert row.days_to_full == 0.0
        assert row.rate_pct_per_day is None  # overfull breaks the only pair


class TestNoEstimate:
    def test_single_numeric_reading_is_no_numeric_history(self) -> None:
        readings = [make_reading("SYNTHETIC-df-e", "brown", 0, 60)]
        row = build_days_to_full(make_dataset(readings)).series[0]
        assert row.reason == "no_numeric_history"
        assert row.days_to_full is None
        assert row.rate_pct_per_day is None
        assert row.last_fill_pct == 60

    def test_two_numeric_readings_but_only_overfull_between(self) -> None:
        # 2 numeric readings, but no *consecutive numeric* pair exists.
        readings = [
            make_reading("SYNTHETIC-df-f", "brown", 0, 20),
            make_reading("SYNTHETIC-df-f", "brown", 10, None, overfull=True),
            make_reading("SYNTHETIC-df-f", "brown", 20, 25),
        ]
        row = build_days_to_full(make_dataset(readings)).series[0]
        assert row.reason == "no_positive_rate"
        assert row.days_to_full is None
        assert row.rate_pct_per_day is None

    def test_all_decreasing_pairs_is_no_positive_rate(self) -> None:
        readings = [
            make_reading("SYNTHETIC-df-g", "brown", 0, 80),
            make_reading("SYNTHETIC-df-g", "brown", 30, 60),
            make_reading("SYNTHETIC-df-g", "brown", 70, 40),
        ]
        row = build_days_to_full(make_dataset(readings)).series[0]
        assert row.reason == "no_positive_rate"
        assert row.days_to_full is None
        assert row.rate_pct_per_day is None
        assert row.last_fill_pct == 40


class TestRateRules:
    def test_drops_excluded_never_negative_accumulation(self) -> None:
        # 60 → 30 (drop, -1.5/d) is excluded; 30 → 90 (+3.0/d) is the only
        # positive pair. The drop never drags the median negative.
        readings = [
            make_reading("SYNTHETIC-df-h", "brown", 0, 60),
            make_reading("SYNTHETIC-df-h", "brown", 20, 30),
            make_reading("SYNTHETIC-df-h", "brown", 40, 90),
        ]
        row = build_days_to_full(make_dataset(readings)).series[0]
        assert row.reason is None
        assert row.rate_pct_per_day == 3.0
        assert row.days_to_full == 3.3  # (100 - 90)/3.0 = 3.333… → 1 d.p.

    def test_equal_date_gap_excluded_from_rate(self) -> None:
        # The +1 % pair at Δdays = 0 is skipped (division by zero days);
        # the +2 %/20 d pair is the only positive rate.
        readings = [
            make_reading("SYNTHETIC-df-i", "green", 0, 50),
            make_reading("SYNTHETIC-df-i", "green", 0, 51),
            make_reading("SYNTHETIC-df-i", "green", 20, 53),
        ]
        row = build_days_to_full(make_dataset(readings)).series[0]
        assert row.rate_pct_per_day == pytest.approx(2 / 20)
        assert row.days_to_full == 470.0  # (100 - 53)/0.1
        assert row.reason is None

    def test_only_increasing_pair_at_zero_days_is_no_positive_rate(self) -> None:
        readings = [
            make_reading("SYNTHETIC-df-j", "white", 0, 40),
            make_reading("SYNTHETIC-df-j", "white", 0, 41),
            make_reading("SYNTHETIC-df-j", "white", 10, 30),
        ]
        row = build_days_to_full(make_dataset(readings)).series[0]
        assert row.reason == "no_positive_rate"
        assert row.days_to_full is None
        assert row.rate_pct_per_day is None

    def test_rate_helper_pair_semantics_unchanged(self) -> None:
        # The positive-rate subset comes from the §2.2 helper: reuse, not duplication.
        rates = collect_numeric_rates_pct_per_day(happy_path_readings())
        assert rates == pytest.approx([1.0, 6 / 34])


class TestAggregatesAndOrder:
    def test_stats_over_mixed_series(self) -> None:
        readings = [
            *happy_path_readings("SYNTHETIC-df-k"),  # 40.8 d
            make_reading("SYNTHETIC-df-l", "green", 0, 30),
            make_reading("SYNTHETIC-df-l", "green", 28, 100),  # already_full → 0.0
            make_reading("SYNTHETIC-df-m", "white", 0, 80),
            make_reading("SYNTHETIC-df-m", "white", 30, 60),  # no_positive_rate
        ]
        result = build_days_to_full(make_dataset(readings))
        assert result.stats.series_total == 3
        assert result.stats.series_with_estimate == 2
        assert result.stats.median_days == 20.4  # (0.0 + 40.8)/2
        assert result.stats.mean_days == 20.4
        assert result.stats.min_days == 0.0
        assert result.stats.max_days == 40.8

    def test_no_estimates_all_stats_null(self) -> None:
        readings = [
            make_reading("SYNTHETIC-df-n", "brown", 0, 60),
            make_reading("SYNTHETIC-df-n", "brown", 30, 40),
        ]
        stats = build_days_to_full(make_dataset(readings)).stats
        assert stats.series_total == 1
        assert stats.series_with_estimate == 0
        assert stats.median_days is None
        assert stats.mean_days is None
        assert stats.min_days is None
        assert stats.max_days is None

    def test_empty_dataset(self) -> None:
        result = build_days_to_full(Dataset.empty())
        assert result.method == "median_positive_pair_rate"
        assert result.series == []
        assert result.stats.series_total == 0
        assert result.stats.series_with_estimate == 0
        assert result.stats.median_days is None
        assert result.stats.mean_days is None
        assert result.stats.min_days is None
        assert result.stats.max_days is None

    def test_series_sorted_by_location_then_material(self) -> None:
        readings = [
            make_reading("SYNTHETIC-df-z", "brown", 0, 50),
            make_reading("SYNTHETIC-df-a", "green", 0, 50),
        ]
        keys = [
            (row.location_id, row.material_type)
            for row in build_days_to_full(make_dataset(readings)).series
        ]
        assert keys == [("SYNTHETIC-df-a", "green"), ("SYNTHETIC-df-z", "brown")]


class TestDeterminism:
    def test_same_input_same_output(self) -> None:
        shuffled = list(reversed(happy_path_readings()))  # unsorted input rows
        first: DaysToFullResult = build_days_to_full(make_dataset(happy_path_readings()))
        second: DaysToFullResult = build_days_to_full(make_dataset(shuffled))
        assert first == second  # includes series order, stats and assumptions

    def test_unsorted_input_same_per_series_values(self) -> None:
        shuffled = [
            make_reading("SYNTHETIC-df-o", "brown", 64, 76),
            make_reading("SYNTHETIC-df-o", "brown", 0, 40),
            make_reading("SYNTHETIC-df-o", "brown", 30, 70),
        ]
        row = build_days_to_full(make_dataset(shuffled)).series[0]
        assert row.days_to_full == 40.8
        assert row.last_date == BASE_DATE + timedelta(days=64)


class TestAssumptions:
    def test_caveat_labels_present_with_observed_gap(self) -> None:
        result = build_days_to_full(
            make_dataset(
                [
                    make_reading("SYNTHETIC-df-p", "brown", 0, 40),
                    make_reading("SYNTHETIC-df-p", "brown", 30, 70),
                ]
            )
        )
        assert result.assumptions == [
            "days_to_full values are predictions from fill history only [predicted]",
            # exact string, split only for line length (implicit concatenation)
            "each estimate assumes a constant fill rate "
            "and no emptying between readings [assumption]",
            "median reading gap 30 d [observed]",
        ]

    def test_gap_label_without_gaps(self) -> None:
        readings = [make_reading("SYNTHETIC-df-q", "brown", 0, 50)]
        assumptions = build_days_to_full(make_dataset(readings)).assumptions
        assert assumptions[-1] == "reading gaps irregular; no median gap computable [observed]"


class TestRealCsvGapPin:
    def test_pooled_median_gap_matches_profile_14(self) -> None:
        # Reconciles the assumption label with docs/data_profile.md §14: the
        # pooled median over all consecutive within-series gaps is 28 d on the
        # real CSV (10,363 gaps = 11,701 rows - 1,338 series first readings).
        # This is the §14 definition, not the per-series median (35 d).
        result = load_glass_fill_csv(require_real_csv_path())
        assert not result.errors, f"real CSV must load cleanly: {result.errors[:3]}"
        require_real_ids(result.dataset.readings)
        assumptions = build_days_to_full(result.dataset).assumptions
        assert assumptions[-1] == "median reading gap 28 d [observed]"
