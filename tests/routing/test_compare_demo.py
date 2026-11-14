"""Compare-demo CLI tests (M12) — docs/contracts.md §4.6/§5.3, §4.2 labels.

Runs both scenarios on a small **synthetic** CSV (SYNTHETIC-prefixed ids,
hand-authored — never real data) and pins the generated document's structure,
labels and arithmetic. The optimised scenario runs the real M10 pipeline
including the OR-Tools solve (~5 s wall-clock time limit), so the shared
fixture runs `run_comparison` once per module; optimised totals are only
asserted within that single run (GLS may vary between runs, §4.4).
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from src.routing.compare_demo import ComparisonResult, main, run_comparison

AS_OF = date(2026, 9, 30)

CSV_ROWS = """Location_id,material_type,date,fill_level_perc
SYN-CMP-1,brown,2026-08-15,60
SYN-CMP-1,brown,2026-09-15,90
SYN-CMP-2,green,2026-08-20,40
SYN-CMP-2,green,2026-09-10,80
SYN-CMP-3,white,2026-08-25,overfull
SYN-CMP-3,white,2026-09-05,overfull
SYN-CMP-4,brown,2026-09-12,20
"""

# Hand-computed expectations (container 1900 L, density 0.5 kg/l [demo §4.6]):
# persistence fills at as_of: CMP-1 90 -> 1710 L / 855 kg, CMP-2 80 -> 1520 L /
# 760 kg, CMP-4 20 -> 380 L / 190 kg, CMP-3 no persistence -> 0 L / 0 kg.
EXPECTED_NAIVE_LITRES = 1710 + 1520 + 0 + 380  # 3610
EXPECTED_NAIVE_KG = 855 + 760 + 0 + 190  # 1805


@pytest.fixture(scope="module")
def comparison(tmp_path_factory: pytest.TempPathFactory) -> ComparisonResult:
    csv_path = tmp_path_factory.mktemp("data") / "synthetic_compare.csv"
    csv_path.write_text(CSV_ROWS, encoding="utf-8")
    output_path = csv_path.parent / "demo_numbers.md"
    return run_comparison(csv_path, output_path, as_of=AS_OF, horizon_days=28)


# ---------------------------------------------------------------------------
# Naive scenario arithmetic (hand-checked on the synthetic dataset)
# ---------------------------------------------------------------------------


def test_naive_visits_all_four_series(comparison: ComparisonResult) -> None:
    naive = comparison.naive
    assert naive.method == "naive_fixed_order"
    assert naive.status == "complete"
    assert naive.totals.stops_total == 4
    assert naive.totals.stops_served == 4
    assert naive.unserved == []
    assert naive.shift_violations == []
    assert len(naive.routes) == 1  # all four fit one demo truck within the shift


def test_naive_collected_quantities_match_hand_check(comparison: ComparisonResult) -> None:
    assert comparison.naive.totals.collected_volume_litres == EXPECTED_NAIVE_LITRES
    assert comparison.naive.totals.collected_weight_kg == EXPECTED_NAIVE_KG


def test_no_persistence_series_visited_with_zero_and_labelled(
    comparison: ComparisonResult,
) -> None:
    assert comparison.naive.no_forecast_stop_keys == [("SYN-CMP-3", "white")]


def test_naive_totals_reconcile_and_provenance_labelled(
    comparison: ComparisonResult,
) -> None:
    naive = comparison.naive
    assert naive.totals.stops_served + len(naive.unserved) == naive.totals.stops_total
    assert naive.distance_provenance == "haversine_straight_line_derived"
    # Fleet recommendation covers the full demand: ceil(3610/12000)=1,
    # ceil(1805/10000)=1 (demo_truck §4.6).
    assert naive.fleet_recommendation.vehicle_type_id == "demo_truck"
    assert naive.fleet_recommendation.count == 1
    assert naive.fleet_recommendation.basis.ceil_by_volume == 1
    assert naive.fleet_recommendation.basis.ceil_by_weight == 1


# ---------------------------------------------------------------------------
# Optimised scenario — the run_route pipeline, unchanged
# ---------------------------------------------------------------------------


def test_optimised_selection_and_solution(comparison: ComparisonResult) -> None:
    optimised = comparison.optimised
    assert len(optimised.selection.selected) == 2  # 90 and 80 >= threshold 80
    assert len(optimised.selection.skipped) == 2  # no_forecast + below_threshold
    solution = optimised.solution
    assert solution.status in ("optimal", "feasible")
    assert solution.totals.stops_total == 2
    assert solution.totals.stops_served == 2
    assert solution.unserved == []
    assert solution.distance_provenance == "haversine_straight_line_derived"


# ---------------------------------------------------------------------------
# Generated document — structure, labels, arithmetic
# ---------------------------------------------------------------------------


def test_document_labels_and_structure(comparison: ComparisonResult) -> None:
    markdown = comparison.markdown
    assert "# Demo numbers" in markdown
    assert "## Scenario A" in markdown
    assert "## Scenario B" in markdown
    assert "naive_fixed_order" in markdown
    assert "haversine_straight_line_derived" in markdown
    assert 'never "road distance"' in markdown  # AGENTS rule 9 / contract §4.2
    assert "[demo assumption]" in markdown
    assert "detour factor" in markdown
    assert "python -m src.routing.compare_demo" in markdown
    assert "run-to-run" in markdown  # GLS wall-clock note
    assert "0 L / 0 kg" in markdown  # zero-fill labelling


def test_document_numbers_match_solutions(comparison: ComparisonResult) -> None:
    markdown = comparison.markdown
    naive = comparison.naive
    optimised = comparison.optimised
    # The document is rendered from the very solution objects under test.
    assert str(naive.totals.distance_m) in markdown
    assert str(optimised.solution.totals.distance_m) in markdown
    assert str(EXPECTED_NAIVE_LITRES) in markdown
    assert str(EXPECTED_NAIVE_KG) in markdown
    assert "demo_truck x 1 (ceil_by_volume 1, ceil_by_weight 1)" in markdown
    assert str(len(optimised.selection.selected)) in markdown
    assert str(len(optimised.selection.skipped)) in markdown


def test_solution_totals_equal_sum_of_routes(comparison: ComparisonResult) -> None:
    naive_distance = sum(route.distance_m for route in comparison.naive.routes)
    assert comparison.naive.totals.distance_m == naive_distance
    optimised_distance = sum(route.distance_m for route in comparison.optimised.solution.routes)
    assert comparison.optimised.solution.totals.distance_m == optimised_distance


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def test_main_exit_zero_writes_document(
    tmp_path: Path, tmp_path_factory: pytest.TempPathFactory
) -> None:
    csv_path = tmp_path_factory.mktemp("cli") / "synthetic_compare.csv"
    csv_path.write_text(CSV_ROWS, encoding="utf-8")
    output_path = csv_path.parent / "nested" / "demo_numbers.md"
    exit_code = main(
        [
            "--data",
            str(csv_path),
            "--output",
            str(output_path),
            "--as-of",
            AS_OF.isoformat(),
            "--horizon",
            "28",
        ]
    )
    assert exit_code == 0
    assert output_path.exists()
    assert "Scenario A" in output_path.read_text(encoding="utf-8")
