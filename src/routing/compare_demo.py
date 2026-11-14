"""M12 demo comparison CLI — naive fixed-order vs OR-Tools optimised.

Runs both scenarios on the challenge dataset with the agreed §4.6 demo
pipeline and writes ``docs/demo_numbers.md``:

    python -m src.routing.compare_demo

Optimised scenario: the M10 ``run_route`` pipeline reused **exactly**
(``src.api.services``) — persistence forecast (§2.3), as_of 2026-09-30,
horizon_days 28 [demo assumption], default ``PolicyConfig`` (§3.1), synthetic
demo geography (§4.5) and §4.6 demo config, solved by
``src.routing.solver.solve``.

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
from datetime import date, datetime, timedelta
from pathlib import Path

from src.api import schemas as api_schemas
from src.api.services import run_route, upload_dataset
from src.data.schema import Dataset
from src.forecasting.baseline import METHOD_PERSISTENCE, ForecastRecord, forecast
from src.forecasting.features import SeriesKey, build_feature_row, group_by_series
from src.forecasting.targets import EvaluationCase
from src.routing.demo_config import (
    DEMO_CONTAINER_VOLUME_LITRES,
    DEMO_STOP_SERVICE_MINUTES,
    DEMO_VEHICLE_COUNT_AVAILABLE,
    demo_depot,
    demo_disposal_site,
    demo_routing_config,
    demo_vehicle_type,
)
from src.routing.fleet import FleetRecommendation
from src.routing.geography import build_travel_matrix, synthetic_stop_coordinates
from src.routing.naive import NaiveSolution, naive_fixed_order_simulation
from src.routing.schemas import RoutingProblem, Stop

DEFAULT_CSV_PATH = Path("data/raw/glass_fill_levels_anonymized_f.csv")
DEFAULT_OUTPUT_PATH = Path("docs/demo_numbers.md")
DEFAULT_AS_OF = date(2026, 9, 30)
DEFAULT_HORIZON_DAYS = 28  # [demo assumption] — observed median reading gap (§2.1)

DETOUR_NOTE = (
    'great-circle haversine x detour factor (§4.6) [demo assumption]; never "road '
    'distance" — no road network data exists [observed]'
)
GLS_NOTE = (
    "Optimised totals vary slightly run-to-run: GUIDED LOCAL SEARCH runs under the "
    "configured wall-clock solver time limit (contract §4.4 claims determinism as "
    "same status + same invariants, not bitwise). The naive simulation is fully "
    "deterministic."
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


def _naive_problem(
    dataset: Dataset, as_of: date, horizon_days: int
) -> tuple[RoutingProblem, list[SeriesKey]]:
    """Build the §4.6 demo routing problem over **all** dataset series.

    Persistence fills (§2.3) mirror the ``run_route`` forecast step exactly
    (leakage-safe features at as_of); series without a persistence value keep
    fill 0.0 and are returned separately so the simulation can label them.
    """
    grouped = group_by_series(dataset.readings)
    target_date = as_of + timedelta(days=horizon_days)
    fills: dict[SeriesKey, float] = {}
    no_forecast_keys: list[SeriesKey] = []
    for key in sorted(grouped):
        features = build_feature_row(grouped[key], as_of)
        record: ForecastRecord | None = None
        if features is not None:
            evaluation_case = EvaluationCase(
                location_id=key[0],
                material_type=key[1],
                as_of_date=as_of,
                target_date=target_date,
                horizon_days=horizon_days,
                truth_fill_pct=None,  # inference has no truth; baselines ignore it
                truth_is_overfull=False,
                features=features,
            )
            record = forecast(evaluation_case, METHOD_PERSISTENCE)
        if record is None:
            no_forecast_keys.append(key)
            fills[key] = 0.0
        else:
            fills[key] = record.predicted_fill_pct

    depot = demo_depot()
    disposal = demo_disposal_site()
    vehicle = demo_vehicle_type()
    config = demo_routing_config()
    coordinates = synthetic_stop_coordinates(fills.keys(), depot)
    stops = [
        Stop(
            location_id=key[0],
            material_type=key[1],
            lat=coordinates[key][0],
            lon=coordinates[key][1],
            container_volume_litres=DEMO_CONTAINER_VOLUME_LITRES,
            predicted_fill_pct=fills[key],
            service_minutes=DEMO_STOP_SERVICE_MINUTES,
        )
        for key in sorted(fills)
    ]
    travel = build_travel_matrix(depot, [disposal], stops, config)
    problem = RoutingProblem(
        depot=depot,
        disposal_sites=[disposal],
        stops=stops,
        vehicle_types=[vehicle],
        travel=travel,
        config=config,
    )
    return problem, no_forecast_keys


def run_comparison(
    csv_path: Path,
    output_path: Path,
    as_of: date = DEFAULT_AS_OF,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
) -> ComparisonResult:
    """Run both scenarios on ``csv_path`` and render the markdown document.

    The optimised scenario reuses the M10 pipeline untouched (upload →
    ``run_route``); the naive scenario shares the same demo config values and
    coordinate derivation over all series.
    """
    load_result = upload_dataset(csv_path.read_bytes(), csv_path.name)
    if load_result.errors:
        raise CompareDemoError(
            "dataset failed §1 validation with "
            f"{len(load_result.errors)} error(s); first: {load_result.errors[0]!r}"
        )
    summary = load_result.dataset.summary

    optimised = run_route(
        api_schemas.RouteRequest(
            as_of_date=as_of, horizon_days=horizon_days, method=METHOD_PERSISTENCE
        )
    )

    problem, no_forecast_keys = _naive_problem(load_result.dataset, as_of, horizon_days)
    naive = naive_fixed_order_simulation(problem, no_forecast_keys)

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
    return [
        "| metric | value |",
        "|---|---|",
        f"| status | {status} |",
        f"| total distance_m | {distance_m} (haversine_straight_line_derived) |",
        f"| total duration_min | {duration_min} |",
        f"| stops visited | {stops_served} / {stops_total} |",
        f"| vehicles available | {DEMO_VEHICLE_COUNT_AVAILABLE} x demo_truck "
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
        f"Reproducing command: `python -m src.routing.compare_demo` (writes `{output_path}`; "
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
    except (OSError, CompareDemoError) as error:
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
