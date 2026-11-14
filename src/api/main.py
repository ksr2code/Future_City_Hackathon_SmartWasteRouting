"""WasteRouting.AI API — M10 (docs/contracts.md §5).

Thin transport layer: routers from ``src.api.endpoints`` under the ``/api``
prefix, the M0 root ``/health``, and exception handlers mapping domain errors
to contract §5.3 responses (404 no dataset, 422 validation messages, 422 full
§1 error list on rejected uploads).

Run from the repository root:
    uvicorn src.api.main:app --reload
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from src.api.endpoints import router
from src.api.errors import ApiError
from src.api.state import NoDatasetError
from src.collection.policy import PolicyConfigError
from src.routing.schemas import RoutingSchemaError
from src.routing.solver import RoutingSolverError

app = FastAPI(title="WasteRouting.AI API")
app.include_router(router)


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe returning the service status payload (M0, kept)."""
    return {"status": "ok", "service": "wasterouting-api"}


@app.exception_handler(ApiError)
async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    """Transport errors with explicit payloads (e.g. rejected uploads, §5.3)."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(NoDatasetError)
async def no_dataset_handler(_request: Request, exc: NoDatasetError) -> JSONResponse:
    """No active dataset -> 404 (contract §5.3)."""
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(PolicyConfigError)
@app.exception_handler(RoutingSchemaError)
async def config_validation_handler(
    _request: Request, exc: PolicyConfigError | RoutingSchemaError
) -> JSONResponse:
    """Invalid §3.1/§4.6 overrides -> 422 with the domain validation message
    (contract §5.3: validated by constructing the config objects)."""
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(RoutingSolverError)
async def solver_error_handler(_request: Request, exc: RoutingSolverError) -> JSONResponse:
    """Solver statuses NOT_SOLVED/INVALID are internal bugs (M9 docstring),
    not user-facing routing outcomes -> 500 with the message."""
    return JSONResponse(status_code=500, content={"detail": str(exc)})


__all__ = ["app", "health"]
