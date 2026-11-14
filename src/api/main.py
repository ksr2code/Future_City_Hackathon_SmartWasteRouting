"""Minimal FastAPI application for WasteRouting.AI (M0 skeleton).

Run from the repository root:
    uvicorn src.api.main:app --reload
"""

from fastapi import FastAPI

app = FastAPI(title="WasteRouting.AI API")


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe returning the service status payload."""
    return {"status": "ok", "service": "wasterouting-api"}
