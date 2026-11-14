"""M12 demo comparison CLI — naive fixed-order vs OR-Tools optimised.

Runs both scenarios on the challenge dataset with the agreed §4.6 demo
pipeline and writes ``docs/demo_numbers.md``:

    python -m src.api.compare_demo

Lives in the API layer (AGENTS boundaries): both scenarios run in the shared
core ``src.api.services.run_comparison_scenarios`` — the M10 ``run_route``
pipeline reused **exactly** (persistence forecast §2.3, as_of 2026-09-30,
horizon_days 28 [demo assumption], default ``PolicyConfig`` §3.1, synthetic
demo geography §4.5 and §4.6 demo config, solved by ``src.routing.solver
.solve``) plus the naive scenario from ``src.routing.naive`` — which also
powers GET /api/comparison (§5.2.2). This module is CLI glue: upload, the
markdown rendering below, and argparse.

Naive scenario: the **same demo inputs** (same depot/disposal/vehicle/config
values, same synthetic-coordinate derivation) but over **ALL** dataset series
— no policy filter — simulated by ``src.routing.naive`` in fixed lexicographic
(location_id, material_type) order [demo assumption — the data has no area
field]. Series without a persistence value at as_of (§2.3) are still visited
and collect 0 L / 0 kg, labelled.

Every number in the generated document is labelled observed / predicted /
[demo assumption]; distances are haversine_straight_line_derived (detour
factor applied) and are **never** called road distance (contract §4.2, AGENTS
rule 9). Optimised totals vary slightly run-to-run — GLS under a wall-clock
solver time limit (contract §4.4); the naive simulation is fully
deterministic.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from src.api import schemas as api_schemas
from src.api.services import (
    COMPARISON_AS_OF_DEFAULT,
    COMPARISON_HORIZON_DAYS_DEFAULT,
    DEMO_CSV_PATH,
    GLS_NOTE,
    run_comparison_scenarios,
    upload_dataset,
)
from src.routing.demo_config import DEMO_VEHICLE_COUNT_AVAILABLE, demo_vehicle_type
from src.routing.fleet import FleetRecommendation
from src.routing.naive import NaiveSolution

# CLI-facing names for the single server-side/API shared constants (§5.1/§5.2.2);
# kept as module attributes so argparse defaults and external references
# (``compare_demo.DEFAULT_CSV_PATH`` etc.) stay stable.
DEFAULT_CSV_PATH = DEMO_CSV_PATH
DEFAULT_OUTPUT_PATH = Path("docs/demo_numbers.md")
DEFAULT_AS_OF = COMPARISON_AS_OF_DEFAULT
DEFAULT_HORIZON_DAYS = COMPARISON_HORIZON_DAYS_DEFAULT  # [demo assumption]

DETOUR_NOTE = (
    'great-circle haversine x detour factor (§4.6) [demo assumption]; never "road '
    'distance" — no road network data exists [observed]'
)


class CompareDemoError(RuntimeError):
    """Raised when the comparison inputs are unusable (dataset validation
    errors) — the CLI reports the full error list and exits non-zero."""


@dataclass(frozen=True)
class ComparisonResult:
    """Both scenario solutions plus the rendered markdown document."""

    csv_path: Path
    output_path: Path
    as_of: date
    horizon_days: int
    n_rows: int
    n_locations: int
    n_series: int
    date_min: date | None
    date_max: date | None
    naive: NaiveSolution
    optimised: api_schemas.RouteResponse
    markdown: str


def run_comparison(
    csv_path: Path,
    output_path: Path,
    as_of: date = DEFAULT_AS_OF,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
) -> ComparisonResult:
    """Run both scenarios on ``csv_path`` and render the markdown document.

    The scenarios run in the shared core ``services
    .run_comparison_scenarios`` (also powering GET /api/comparison, §5.2.2):
    the optimised scenario reuses the M10 pipeline untouched (upload →
    ``run_route`` on the active store dataset); the naive scenario shares the
    same demo config values and coordinate derivation over all series.
    """
    load_result = upload_dataset(csv_path.read_bytes(), csv_path.name)
    if load_result.errors:
        raise CompareDemoError(
            "dataset failed §1 validation with "
            f"{len(load_result.errors)} error(s); first: {load_result.errors[0]!r}"
        )
    summary = load_result.dataset.summary

    scenarios = run_comparison_scenarios(load_result.dataset, as_of, horizon_days)
    naive = scenarios.naive
    optimised = scenarios.optimised

    markdown = _render_markdown(
        csv_path=csv_path,
        output_path=output_path,
        as_of=as_of,
        horizon_days=horizon_days,
        n_rows=summary.n_rows,
        n_locations=summary.n_locations,
        n_series=summary.n_series,
        date_min=summary.date_min,
        date_max=summary.date_max,
        naive=naive,
        optimised=optimised,
    )
    return ComparisonResult(
        csv_path=csv_path,
        output_path=output_path,
        as_of=as_of,
        horizon_days=horizon_days,
        n_rows=summary.n_rows,
        n_locations=summary.n_locations,
        n_series=summary.n_series,
        date_min=summary.date_min,
        date_max=summary.date_max,
        naive=naive,
        optimised=optimised,
        markdown=markdown,
    )


def _fleet_line(recommendation: api_schemas.FleetRecommendationResponse) -> str:
    basis = recommendation.basis
    return (
        f"{recommendation.vehicle_type_id} x {recommendation.count} "
        f"(ceil_by_volume {basis.ceil_by_volume}, ceil_by_weight {basis.ceil_by_weight})"
    )


def _scenario_table(
    status: str,
    distance_m: int,
    duration_min: int,
    stops_served: int,
    stops_total: int,
    vehicles_used: int,
    collected_volume_litres: int,
    collected_weight_kg: int,
    unserved_count: int,
    fleet_recommendation: api_schemas.FleetRecommendationResponse,
) -> list[str]:
    """The shared §4.3-key metric rows for one scenario table."""
    vehicle = demo_vehicle_type()  # id/count from the §4.6 config, never literals
    return [
        "| metric | value |",
        "|---|---|",
        f"| status | {status} |",
        f"| total distance_m | {distance_m} (haversine_straight_line_derived) |",
        f"| total duration_min | {duration_min} |",
        f"| stops visited | {stops_served} / {stops_total} |",
        f"| vehicles available | {DEMO_VEHICLE_COUNT_AVAILABLE} x {vehicle.id} "
        "[demo assumption §4.6] |",
        f"| vehicles used | {vehicles_used} |",
        f"| collected volume litres | {collected_volume_litres} |",
        f"| collected weight kg | {collected_weight_kg} |",
        f"| unserved stops | {unserved_count} (each with a reason in the solution) |",
        f"| fleet recommendation | {_fleet_line(fleet_recommendation)} |",
    ]


def _render_markdown(
    csv_path: Path,
    output_path: Path,
    as_of: date,
    horizon_days: int,
    n_rows: int,
    n_locations: int,
    n_series: int,
    date_min: date | None,
    date_max: date | None,
    naive: NaiveSolution,
    optimised: api_schemas.RouteResponse,
) -> str:
    """Render both scenarios with labels, assumptions and provenance notes."""
    naive_totals = naive.totals
    optimised_solution = optimised.solution
    optimised_totals = optimised_solution.totals
    lines: list[str] = []
    add = lines.append

    add("# Demo numbers — naive fixed-order vs optimised (M12)")
    add("")
    add(
        f"Reproducing command: `python -m src.api.compare_demo` (writes `{output_path}`; "
        "optional overrides `--data PATH --output PATH --as-of YYYY-MM-DD --horizon N`)"
    )
    add("")
    add(
        f"Dataset: `{csv_path}` [observed] — {n_rows} rows, {n_locations} locations, "
        f"{n_series} series, {date_min}..{date_max}. Raw file immutable (AGENTS rule 4)."
    )
    add("")
    add(
        f"Prediction: as_of {as_of}, horizon_days {horizon_days} [demo assumption — the "
        "brief defines no horizon; the default is the observed median reading gap], "
        "method persistence (contract §2.3)."
    )
    add("")
    add(
        f"Distance provenance for BOTH scenarios: haversine_straight_line_derived — "
        f"{DETOUR_NOTE}. Synthetic stop coordinates derive from SHA-256 of series keys; "
        "the depot and disposal site are synthetic fixtures near Heilbronn."
    )
    add("")
    add("## Scenario A — naive fixed order (`naive_fixed_order`, no OR-Tools)")
    add("")
    add(
        "Visiting order: fixed lexicographic (location_id, material_type) [demo "
        "assumption — the data has no area field, so the order is not geographic]."
    )
    add("")
    lines.extend(
        _scenario_table(
            status=naive.status,
            distance_m=naive_totals.distance_m,
            duration_min=naive_totals.duration_min,
            stops_served=naive_totals.stops_served,
            stops_total=naive_totals.stops_total,
            vehicles_used=len(naive.routes),
            collected_volume_litres=naive_totals.collected_volume_litres,
            collected_weight_kg=naive_totals.collected_weight_kg,
            unserved_count=len(naive.unserved),
            fleet_recommendation=_fleet_response(naive.fleet_recommendation),
        )
    )
    add("")
    add(
        f"Stops with no persistence value at as_of: {len(naive.no_forecast_stop_keys)} — "
        "still visited, collect 0 L / 0 kg [demo assumption labelling; contract §2.3: "
        "no number is fabricated]."
    )
    add("")
    add(f"Shift overruns reported (contract §4.4): {len(naive.shift_violations)}")
    add("")
    add("## Scenario B — optimised (OR-Tools CVRP, `src.routing.solver.solve`)")
    add("")
    lines.extend(
        _scenario_table(
            status=optimised_solution.status,
            distance_m=optimised_totals.distance_m,
            duration_min=optimised_totals.duration_min,
            stops_served=optimised_totals.stops_served,
            stops_total=optimised_totals.stops_total,
            vehicles_used=len(optimised_solution.routes),
            collected_volume_litres=optimised_totals.collected_volume_litres,
            collected_weight_kg=optimised_totals.collected_weight_kg,
            unserved_count=len(optimised_solution.unserved),
            fleet_recommendation=optimised_solution.fleet_recommendation,
        )
    )
    add("")
    add(
        f"Selection (policy §3, default config): {len(optimised.selection.selected)} "
        f"selected / {len(optimised.selection.skipped)} skipped — the optimised "
        "scenario routes only selected candidates; the naive scenario visits all "
        f"{naive_totals.stops_total} series."
    )
    add("")
    add("## Assumptions (each labelled [demo assumption])")
    add("")
    add(
        "- Naive visiting order is fixed lexicographic (location_id, material_type) — "
        "the data has no area field [observed]."
    )
    add(
        "- Naive zero-fill rule: series without a persistence value at as_of are still "
        "visited and collect 0 L / 0 kg."
    )
    for assumption in optimised.assumptions:
        add(f"- {assumption}")
    add("")
    add("## Notes")
    add("")
    add(f"- {GLS_NOTE}")
    add(
        "- Unserved stops are never silently dropped (contract §4.4); the generated "
        "solution objects carry a deterministic reason per stop."
    )
    add("")
    return "\n".join(lines)


def _fleet_response(recommendation: FleetRecommendation) -> api_schemas.FleetRecommendationResponse:
    """Map the domain §4.3 fleet recommendation onto the §5.2 response shape
    (same mapping the API layer uses, so both scenario tables render alike)."""
    return api_schemas.FleetRecommendationResponse(
        vehicle_type_id=recommendation.vehicle_type_id,
        count=recommendation.count,
        basis=api_schemas.FleetBasisResponse(
            ceil_by_volume=recommendation.basis.ceil_by_volume,
            ceil_by_weight=recommendation.basis.ceil_by_weight,
        ),
    )


def main(argv: Sequence[str] | None = None) -> int:
    """CLI entry point: run both scenarios and write the markdown document."""
    parser = argparse.ArgumentParser(
        description="M12 demo comparison: naive fixed-order vs OR-Tools optimised."
    )
    parser.add_argument("--data", type=Path, default=DEFAULT_CSV_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--as-of", default=DEFAULT_AS_OF.isoformat())
    parser.add_argument("--horizon", type=int, default=DEFAULT_HORIZON_DAYS)
    arguments = parser.parse_args(argv)
    try:
        as_of = datetime.strptime(arguments.as_of, "%Y-%m-%d").date()
        result = run_comparison(
            arguments.data, arguments.output, as_of=as_of, horizon_days=arguments.horizon
        )
    except (OSError, ValueError, CompareDemoError) as error:
        # ValueError covers a malformed --as-of (strptime) and any downstream
        # validation error — reported cleanly on stderr, never a traceback.
        print(f"compare_demo failed: {error}", file=sys.stderr)
        return 2
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(result.markdown, encoding="utf-8")
    print(
        f"wrote {arguments.output} "
        f"(naive {result.naive.totals.stops_served}/"
        f"{result.naive.totals.stops_total} served, "
        f"optimised {result.optimised.solution.totals.stops_served}/"
        f"{result.optimised.solution.totals.stops_total} served)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
