"""M10 API orchestration — docs/contracts.md §5 (thin handlers call these).

No business logic lives here: every computation is delegated to the §1-§4
modules (``src.data.loader``, ``src.forecasting.*``, ``src.collection.policy``,
``src.routing.*``). This module only chains them, constructs the effective
configs from request overrides (validation errors propagate unchanged and are
mapped to 422 in ``src.api.main``, contract §5.3), keeps the single active
dataset in ``src.api.state``, and maps domain dataclasses to the §5.2 Pydantic
shapes.

Units per contract §4.1: litres, kilograms, metres, minutes, percent fill,
WGS84 degrees, km/h, kg/litre. Every demo value is labelled "[demo
assumption]" in responses — never presented as an observed fact.
"""

from __future__ import annotations

import tempfile
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

from src.api import schemas
from src.api.state import store
from src.collection.policy import (
    Candidate,
    PolicyConfig,
    SelectionResult,
    Skip,
    select_candidates,
)
from src.data.loader import load_glass_fill_csv
from src.data.schema import Dataset, LoadResult, ValidationError, ValidationWarning
from src.forecasting.baseline import BaselineMethod, ForecastRecord, forecast
from src.forecasting.features import build_feature_row, group_by_series
from src.forecasting.targets import EvaluationCase
from src.routing.demo_config import (
    DEMO_CONTAINER_VOLUME_LITRES,
    DEMO_DEPOT_ID,
    DEMO_DISPOSAL_ID,
    DEMO_DISPOSAL_SERVICE_MINUTES,
    DEMO_STOP_SERVICE_MINUTES,
    demo_depot,
    demo_disposal_site,
    demo_routing_config,
    demo_vehicle_type,
)
from src.routing.geography import (
    build_routing_problem,
    build_travel_matrix,
    synthetic_stop_coordinates,
)
from src.routing.schemas import (
    Depot,
    DisposalSite,
    RoutingConfig,
    Stop,
    VehicleType,
    stop_point_id,
)
from src.routing.solver import Route, RoutingSolution, solve

ASSUMPTION_LABEL = "[demo assumption]"


# --- Datasets (§5.1 POST /api/datasets, GET /api/summary, /api/containers) ---


def upload_dataset(content: bytes, source_name: str) -> LoadResult:
    """Validate uploaded CSV bytes via the §1 loader; store only when valid.

    The loader needs a file path, so bytes are spooled to a temporary file
    that is always removed. On validation errors the active dataset is left
    untouched (contract §5.3) and the caller reports the full error list.
    """
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as handle:
        handle.write(content)
        temp_path = Path(handle.name)
    try:
        result = load_glass_fill_csv(temp_path)
    finally:
        temp_path.unlink(missing_ok=True)
    if not result.errors:
        store.set(result.dataset, result.warnings, source_name)
    return result


def dataset_summary() -> schemas.DatasetSummaryResponse:
    """§5.2 DatasetSummary of the active dataset (n_errors always 0)."""
    summary = store.dataset.summary
    return schemas.DatasetSummaryResponse(
        n_rows=summary.n_rows,
        n_locations=summary.n_locations,
        n_series=summary.n_series,
        date_min=summary.date_min,
        date_max=summary.date_max,
        rows_per_material=dict(summary.rows_per_material),
        n_errors=0,
        n_warnings=len(store.warnings),
        source_name=store.source_name,
    )


def upload_response(result: LoadResult) -> schemas.DatasetUploadResponse:
    """Map a successful LoadResult to the §5.1 upload response shape."""
    summary = dataset_summary()
    return schemas.DatasetUploadResponse(
        n_rows=summary.n_rows,
        n_locations=summary.n_locations,
        n_series=summary.n_series,
        date_min=summary.date_min,
        date_max=summary.date_max,
        rows_per_material=summary.rows_per_material,
        n_errors=0,
        n_warnings=summary.n_warnings,
        source_name=summary.source_name,
        errors=[validation_error_item(error) for error in result.errors],
        warnings=[validation_warning_item(warning) for warning in result.warnings],
    )


def validation_error_item(error: ValidationError) -> schemas.ValidationErrorItem:
    """Map one §1.4 error to its §5.2 wire shape (shared with POST /datasets)."""
    return schemas.ValidationErrorItem(
        rule_id=error.rule_id,
        row_number=error.row_number,
        message=error.message,
        value=error.value,
    )


def validation_warning_item(warning: ValidationWarning) -> schemas.ValidationErrorItem:
    return schemas.ValidationErrorItem(
        rule_id=warning.rule_id,
        row_number=warning.row_number,
        message=warning.message,
        value=warning.value,
    )


def containers() -> list[schemas.SeriesStatusResponse]:
    """§5.2 SeriesStatus per series, ordered by (location_id, material_type)."""
    grouped = group_by_series(store.dataset.readings)
    statuses: list[schemas.SeriesStatusResponse] = []
    for key in sorted(grouped):
        readings = sorted(grouped[key], key=lambda reading: reading.date)
        last = readings[-1]  # dates unique within a series (invariant I1)
        statuses.append(
            schemas.SeriesStatusResponse(
                location_id=last.location_id,
                material_type=last.material_type,
                n_readings=len(readings),
                last_date=last.date,
                last_fill_pct=last.fill_level_pct,
                last_is_overfull=last.is_overfull,
            )
        )
    return statuses


# --- Config defaults (§5.1 GET /api/config) ----------------------------------


def config_defaults() -> schemas.ConfigDefaultsResponse:
    """§4.6/§3.1 demo defaults plus every demo-assumption field name."""
    policy = PolicyConfig()
    routing = demo_routing_config()
    vehicle = demo_vehicle_type()
    defaults = schemas.ConfigDefaultsResponse(
        policy=schemas.PolicyDefaults(
            select_threshold_pct=policy.select_threshold_pct,
            uncertainty_buffer_pct=policy.uncertainty_buffer_pct,
            overfull_always_selected=policy.overfull_always_selected,
        ),
        routing=schemas.RoutingDefaults(
            container_volume_litres=DEMO_CONTAINER_VOLUME_LITRES,  # litres [demo assumption §4.6]
            densities_kg_per_litre=dict(routing.densities_kg_per_litre),
            vehicle_volume_capacity_litres=vehicle.volume_capacity_litres,
            vehicle_weight_capacity_kg=vehicle.weight_capacity_kg,
            vehicle_count_available=vehicle.count_available,
            stop_service_minutes=DEMO_STOP_SERVICE_MINUTES,
            disposal_service_minutes=DEMO_DISPOSAL_SERVICE_MINUTES,
            max_shift_minutes=routing.max_shift_minutes,
            avg_speed_kmh=routing.avg_speed_kmh,
            detour_factor=routing.detour_factor,
            solver_time_limit_s=routing.solver_time_limit_s,
        ),
        assumption_fields=[
            "select_threshold_pct",
            "uncertainty_buffer_pct",
            "overfull_always_selected",
            "horizon_days",
            *list(schemas.RoutingDefaults.model_fields),
        ],
    )
    return defaults


# --- Forecasts (§5.1 POST /api/forecasts) ------------------------------------


def run_forecasts(request: schemas.ForecastRequest) -> schemas.ForecastResponse:
    """Run the §2.3 baseline for every series with history at ``as_of_date``."""
    records = _forecast_batch(
        store.dataset,
        as_of=request.as_of_date,
        horizon_days=request.horizon_days,
        method=request.method,
    )
    return schemas.ForecastResponse(
        as_of_date=request.as_of_date,
        target_date=request.as_of_date + timedelta(days=request.horizon_days),
        method=request.method,
        forecasts=[_forecast_record_item(record) for record in records],
    )


def _forecast_batch(
    dataset: Dataset,
    as_of: date,
    horizon_days: int,
    method: BaselineMethod,
) -> list[ForecastRecord]:
    """One §2.2 record per series with at least one reading <= as_of.

    Inference targets (§2.1): target_date = as_of + horizon_days. Series with
    no history at as_of are omitted (they surface as `no_forecast` skips in
    the policy, §3.4); overfull-only histories yield no record (§2.3).
    """
    grouped = group_by_series(dataset.readings)
    target_date = as_of + timedelta(days=horizon_days)
    records: list[ForecastRecord] = []
    for key in sorted(grouped):
        features = build_feature_row(grouped[key], as_of)
        if features is None:
            continue
        case = EvaluationCase(
            location_id=key[0],
            material_type=key[1],
            as_of_date=as_of,
            target_date=target_date,
            horizon_days=horizon_days,
            truth_fill_pct=None,  # inference has no truth; baselines ignore it
            truth_is_overfull=False,
            features=features,
        )
        record = forecast(case, method)
        if record is not None:
            records.append(record)
    return records


def _forecast_record_item(record: ForecastRecord) -> schemas.ForecastRecordResponse:
    return schemas.ForecastRecordResponse(
        location_id=record.location_id,
        material_type=record.material_type,
        as_of_date=record.as_of_date,
        target_date=record.target_date,
        predicted_fill_pct=record.predicted_fill_pct,
        predicted_state=record.predicted_state,
        method=record.method,
        horizon_days=record.horizon_days,
    )


# --- Candidates (§5.1 POST /api/candidates) ----------------------------------


def run_candidates(request: schemas.CandidateRequest) -> schemas.SelectionResponse:
    """Forecast, then apply the §3 selection policy with the effective config."""
    records = _forecast_batch(
        store.dataset,
        as_of=request.as_of_date,
        horizon_days=request.horizon_days,
        method=request.method,
    )
    config = _effective_policy_config(request.policy_config)
    result = select_candidates(
        universe=group_by_series(store.dataset.readings).keys(),
        forecasts={(r.location_id, r.material_type): r for r in records},
        config=config,
    )
    return _selection_response(result)


def _effective_policy_config(
    overrides: schemas.PolicyConfigOverrides | None,
) -> PolicyConfig:
    """Construct PolicyConfig with the non-None overrides (§5.3 validation).

    The Pydantic override model already coerced and typed each field at the
    boundary; missing fields keep the §3.1 defaults from ``PolicyConfig``.
    """
    if overrides is None:
        return PolicyConfig()
    base = PolicyConfig()
    return PolicyConfig(
        select_threshold_pct=(
            base.select_threshold_pct
            if overrides.select_threshold_pct is None
            else overrides.select_threshold_pct
        ),
        uncertainty_buffer_pct=(
            base.uncertainty_buffer_pct
            if overrides.uncertainty_buffer_pct is None
            else overrides.uncertainty_buffer_pct
        ),
        overfull_always_selected=(
            base.overfull_always_selected
            if overrides.overfull_always_selected is None
            else overrides.overfull_always_selected
        ),
    )


def _selection_response(result: SelectionResult) -> schemas.SelectionResponse:
    return schemas.SelectionResponse(
        as_of_date=result.as_of_date,
        target_date=result.target_date,
        config=schemas.PolicyConfigEcho(
            select_threshold_pct=result.config.select_threshold_pct,
            uncertainty_buffer_pct=result.config.uncertainty_buffer_pct,
            overfull_always_selected=result.config.overfull_always_selected,
        ),
        selected=[_candidate_item(item) for item in result.selected],
        skipped=[_skip_item(item) for item in result.skipped],
    )


def _candidate_item(candidate: Candidate) -> schemas.CandidateResponse:
    return schemas.CandidateResponse(
        location_id=candidate.location_id,
        material_type=candidate.material_type,
        predicted_fill_pct=candidate.predicted_fill_pct,
        predicted_state=candidate.predicted_state,
        reason_code=candidate.reason_code,
        detail=candidate.detail,
    )


def _skip_item(skip: Skip) -> schemas.SkipResponse:
    """Map a §3.3 Skip with its explanation."""
    return schemas.SkipResponse(
        location_id=skip.location_id,
        material_type=skip.material_type,
        predicted_fill_pct=skip.predicted_fill_pct,
        predicted_state=skip.predicted_state,
        reason_code=skip.reason_code,
        detail=skip.detail,
    )


# --- Route (§5.1 POST /api/route) --------------------------------------------


def run_route(request: schemas.RouteRequest) -> schemas.RouteResponse:
    """Full pipeline: forecast -> policy -> synthetic geography -> matrix ->
    problem -> solve. Always returns selection + solution (§5.3).

    Invalid overrides raise the domain errors (PolicyConfigError/
    RoutingSchemaError) before any solving; ``main`` maps them to 422 with
    the validation message.
    """
    policy_config = _effective_policy_config(request.policy_config)
    routing = _effective_routing(request.routing_config)

    records = _forecast_batch(
        store.dataset,
        as_of=request.as_of_date,
        horizon_days=request.horizon_days,
        method=request.method,
    )
    selection = select_candidates(
        universe=group_by_series(store.dataset.readings).keys(),
        forecasts={(r.location_id, r.material_type): r for r in records},
        config=policy_config,
    )

    depot = demo_depot()
    disposal = routing.disposal
    coordinates = synthetic_stop_coordinates(
        ((c.location_id, c.material_type) for c in selection.selected),
        depot,
    )
    stops = [
        Stop(
            location_id=candidate.location_id,
            material_type=candidate.material_type,
            lat=coordinates[(candidate.location_id, candidate.material_type)][0],
            lon=coordinates[(candidate.location_id, candidate.material_type)][1],
            container_volume_litres=routing.container_volume_litres,
            predicted_fill_pct=candidate.predicted_fill_pct,
            service_minutes=routing.stop_service_minutes,
        )
        for candidate in selection.selected
    ]
    travel = build_travel_matrix(depot, [disposal], stops, routing.config)
    problem = build_routing_problem(
        selection.selected,
        depot,
        [disposal],
        [routing.vehicle],
        routing.container_volume_litres,
        routing.config,
        coordinates,
        travel,
        service_minutes_per_stop=routing.stop_service_minutes,
    )
    solution = solve(problem)

    return schemas.RouteResponse(
        selection=_selection_response(selection),
        solution=_solution_response(solution, disposal, depot),
        assumptions=_assumption_labels(request, routing),
    )


@dataclass(frozen=True)
class _EffectiveRouting:
    """Effective §4.6 routing inputs after applying request overrides."""

    config: RoutingConfig
    vehicle: VehicleType
    disposal: DisposalSite
    container_volume_litres: int
    stop_service_minutes: int


def _effective_routing(
    overrides: schemas.RoutingConfigOverrides | None,
) -> _EffectiveRouting:
    """Merge §4.6 defaults with overrides and validate by constructing the
    domain schemas (RoutingConfig/VehicleType/DisposalSite; §5.3 — their
    validation messages surface on 422).

    The Pydantic override model already coerced each field to its declared
    type at the boundary (``int | None``/``float | None``/``dict[MaterialType,
    float] | None``), so only typed values reach the constructors here.
    """
    base_config = demo_routing_config()
    base_vehicle = demo_vehicle_type()
    base_disposal = demo_disposal_site()
    if overrides is None:
        return _EffectiveRouting(
            config=base_config,
            vehicle=base_vehicle,
            disposal=base_disposal,
            container_volume_litres=DEMO_CONTAINER_VOLUME_LITRES,
            stop_service_minutes=DEMO_STOP_SERVICE_MINUTES,
        )
    config = RoutingConfig(
        max_shift_minutes=(
            overrides.max_shift_minutes
            if overrides.max_shift_minutes is not None
            else base_config.max_shift_minutes
        ),
        densities_kg_per_litre=(
            overrides.densities_kg_per_litre
            if overrides.densities_kg_per_litre is not None
            else dict(base_config.densities_kg_per_litre)
        ),
        detour_factor=(
            overrides.detour_factor
            if overrides.detour_factor is not None
            else base_config.detour_factor
        ),
        avg_speed_kmh=(
            overrides.avg_speed_kmh
            if overrides.avg_speed_kmh is not None
            else base_config.avg_speed_kmh
        ),
        solver_time_limit_s=(
            overrides.solver_time_limit_s
            if overrides.solver_time_limit_s is not None
            else base_config.solver_time_limit_s
        ),
    )
    vehicle = VehicleType(
        id=base_vehicle.id,
        name=base_vehicle.name,
        volume_capacity_litres=(
            overrides.vehicle_volume_capacity_litres
            if overrides.vehicle_volume_capacity_litres is not None
            else base_vehicle.volume_capacity_litres
        ),
        weight_capacity_kg=(
            overrides.vehicle_weight_capacity_kg
            if overrides.vehicle_weight_capacity_kg is not None
            else base_vehicle.weight_capacity_kg
        ),
        count_available=(
            overrides.vehicle_count_available
            if overrides.vehicle_count_available is not None
            else base_vehicle.count_available
        ),
    )
    disposal = DisposalSite(
        id=base_disposal.id,
        name=base_disposal.name,
        lat=base_disposal.lat,
        lon=base_disposal.lon,
        service_minutes=(
            overrides.disposal_service_minutes
            if overrides.disposal_service_minutes is not None
            else base_disposal.service_minutes
        ),
    )
    return _EffectiveRouting(
        config=config,
        vehicle=vehicle,
        disposal=disposal,
        container_volume_litres=(
            overrides.container_volume_litres
            if overrides.container_volume_litres is not None
            else DEMO_CONTAINER_VOLUME_LITRES
        ),
        stop_service_minutes=(
            overrides.stop_service_minutes
            if overrides.stop_service_minutes is not None
            else DEMO_STOP_SERVICE_MINUTES
        ),
    )


def _solution_response(
    solution: RoutingSolution,
    disposal: DisposalSite,
    depot: Depot,
) -> schemas.RoutingSolutionResponse:
    return schemas.RoutingSolutionResponse(
        status=solution.status,
        objective_value=solution.objective_value,
        routes=[_route_item(route, disposal, depot) for route in solution.routes],
        unserved=[
            schemas.UnservedStopResponse(
                location_id=stop.stop_key[0],
                material_type=stop.stop_key[1],
                reason=stop.reason,
            )
            for stop in solution.unserved
        ],
        totals=schemas.SolutionTotalsResponse(
            distance_m=solution.totals.distance_m,
            duration_min=solution.totals.duration_min,
            collected_volume_litres=solution.totals.collected_volume_litres,
            collected_weight_kg=solution.totals.collected_weight_kg,
            stops_served=solution.totals.stops_served,
            stops_total=solution.totals.stops_total,
        ),
        fleet_recommendation=schemas.FleetRecommendationResponse(
            vehicle_type_id=solution.fleet_recommendation.vehicle_type_id,
            count=solution.fleet_recommendation.count,
            basis=schemas.FleetBasisResponse(
                ceil_by_volume=solution.fleet_recommendation.basis.ceil_by_volume,
                ceil_by_weight=solution.fleet_recommendation.basis.ceil_by_weight,
            ),
        ),
        distance_provenance=solution.distance_provenance,
    )


def _route_item(
    route: Route,
    disposal: DisposalSite,
    depot: Depot,
) -> schemas.RouteResponseItem:
    nodes: list[schemas.SequenceNode] = []
    for node in route.sequence:
        if isinstance(node, Stop):
            nodes.append(
                schemas.StopNode(
                    node_type="stop",
                    location_id=node.location_id,
                    material_type=node.material_type,
                    lat=node.lat,
                    lon=node.lon,
                    container_volume_litres=node.container_volume_litres,
                    predicted_fill_pct=node.predicted_fill_pct,
                    service_minutes=node.service_minutes,
                    point_id=stop_point_id(node),
                )
            )
        elif isinstance(node, DisposalSite):
            nodes.append(
                schemas.DisposalNode(
                    node_type="disposal",
                    id=node.id,
                    name=node.name,
                    lat=node.lat,
                    lon=node.lon,
                    service_minutes=node.service_minutes,
                )
            )
        else:
            nodes.append(
                schemas.DepotNode(
                    node_type="depot",
                    id=depot.id,
                    name=depot.name,
                    lat=node.lat,
                    lon=node.lon,
                )
            )
    return schemas.RouteResponseItem(
        vehicle_type_id=route.vehicle_type_id,
        sequence=nodes,
        load_progression=route.load_progression,
        distance_m=route.distance_m,
        duration_minutes=route.duration_minutes,
    )


def _assumption_labels(
    request: schemas.RouteRequest,
    routing: _EffectiveRouting,
) -> list[str]:
    """Labelled assumption strings for the §5.2 RouteResponse (§5.3)."""
    config = routing.config
    return [
        f"{ASSUMPTION_LABEL} forecast horizon_days={request.horizon_days} "
        "(brief defines no horizon; default is the observed median reading gap)",
        f"{ASSUMPTION_LABEL} synthetic stop coordinates derived from SHA-256 of "
        "series keys — no real coordinates exist in the data; distances are "
        "haversine_straight_line_derived, not road distance",
        f"{ASSUMPTION_LABEL} synthetic depot '{DEMO_DEPOT_ID}' and disposal site "
        f"'{DEMO_DISPOSAL_ID}' near Heilbronn",
        f"{ASSUMPTION_LABEL} container_volume_litres={routing.container_volume_litres}",
        f"{ASSUMPTION_LABEL} densities_kg_per_litre="
        + ", ".join(
            f"{material}={density}" for material, density in config.densities_kg_per_litre.items()
        )
        + " kg/litre",
        f"{ASSUMPTION_LABEL} vehicle '{routing.vehicle.id}': "
        f"{routing.vehicle.volume_capacity_litres} L / "
        f"{routing.vehicle.weight_capacity_kg} kg x "
        f"{routing.vehicle.count_available} available",
        f"{ASSUMPTION_LABEL} stop_service_minutes={routing.stop_service_minutes}, "
        f"disposal_service_minutes={routing.disposal.service_minutes}",
        f"{ASSUMPTION_LABEL} max_shift_minutes={config.max_shift_minutes}",
        f"{ASSUMPTION_LABEL} avg_speed_kmh={config.avg_speed_kmh}, "
        f"detour_factor={config.detour_factor} (matrix derivation)",
        f"{ASSUMPTION_LABEL} solver_time_limit_s={config.solver_time_limit_s}",
    ]
