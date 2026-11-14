"""Thin API route handlers — docs/contracts.md §5.1 (M10).

Handlers only validate transport input and delegate to ``src.api.services``;
all business logic lives in the §1-§4 modules. All paths mount under the
``/api`` prefix (root ``/health`` stays in ``main.py``).
"""

from __future__ import annotations

from fastapi import APIRouter, UploadFile

from src.api import schemas, services
from src.api.errors import ApiError

router = APIRouter(prefix="/api")

_UPLOAD_ERROR_MESSAGE = "dataset rejected: {n} validation error(s); active dataset unchanged"


@router.get("/health", response_model=dict[str, str])
async def health() -> dict[str, str]:
    """Liveness payload (same as the M0 root /health, §5.1)."""
    return {"status": "ok", "service": "wasterouting-api"}


@router.post("/datasets", response_model=schemas.DatasetUploadResponse)
async def upload_dataset(file: UploadFile) -> schemas.DatasetUploadResponse:
    """Upload + validate a fill-level CSV (§1); 422 with the full error list
    and the active dataset untouched when any row is invalid (§5.3)."""
    content = await file.read()
    source_name = file.filename or "uploaded.csv"
    result = services.upload_dataset(content, source_name)
    if result.errors:
        raise ApiError(
            status_code=422,
            detail={
                "message": _UPLOAD_ERROR_MESSAGE.format(n=len(result.errors)),
                "errors": [
                    services.validation_error_item(error).model_dump() for error in result.errors
                ],
            },
        )
    return services.upload_response(result)


@router.get("/summary", response_model=schemas.DatasetSummaryResponse)
async def summary() -> schemas.DatasetSummaryResponse:
    """§5.2 DatasetSummary of the active dataset; 404 without one."""
    return services.dataset_summary()


@router.get("/containers", response_model=list[schemas.SeriesStatusResponse])
async def containers() -> list[schemas.SeriesStatusResponse]:
    """§5.2 SeriesStatus list (sorted by location_id, material_type)."""
    return services.containers()


@router.get("/config", response_model=schemas.ConfigDefaultsResponse)
async def config() -> schemas.ConfigDefaultsResponse:
    """§4.6/§3.1 demo defaults + demo-assumption field names."""
    return services.config_defaults()


@router.post("/forecasts", response_model=schemas.ForecastResponse)
async def forecasts(request: schemas.ForecastRequest) -> schemas.ForecastResponse:
    """Run the §2.3 baseline for all series (§5.2 ForecastResponse)."""
    return services.run_forecasts(request)


@router.post("/candidates", response_model=schemas.SelectionResponse)
async def candidates(request: schemas.CandidateRequest) -> schemas.SelectionResponse:
    """Apply the §3 policy; config echo; explains every series (§3.4)."""
    return services.run_candidates(request)


@router.post("/route", response_model=schemas.RouteResponse)
async def route(request: schemas.RouteRequest) -> schemas.RouteResponse:
    """Pipeline forecast -> policy -> geography -> solve; always returns
    selection + solution, infeasible/timeout included (§5.3)."""
    return services.run_route(request)
