# Milestone tracker

Status: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `DONE`. DONE requires evidence.

| Milestone | Status | Owner | Evidence | Blocker / next action |
|---|---|---|---|---|
| M0 — Repository/environment | DONE | architect | Local (2026-11-14, Python 3.14.8/uv 0.13.1/Node 26.13.0): `ruff check .` → all passed; `mypy src` (strict) → 0 issues, 7 files; `pytest` → 4/4 passed; `npm run build` (tsc --noEmit + vite) → exit 0; `npm test` (vitest) → 3/3 passed; uvicorn + Vite dev smoke: proxied `/health` returned `{"status":"ok","service":"wasterouting-api"}`. TDD red-green held for /health, fetchHealth, App. | CI workflow authored but not yet executed on GitHub (no push). Next: M1. |
| M1 — Source audit/data contract | DONE | data-engineer | `docs/data_profile.md` (18 sections; every fact marked observed + reproducing command; 10 open questions, no guessed semantics). Code: `src/data/profile_glass_fill.py` (read-only, typed) + 11 tests. Architect review (2026-11-14): re-ran `.venv/bin/pytest tests/data` → 11/11 passed; `ruff check .` → clean; `mypy src` → 0 issues; independent awk spot-checks confirmed key-duplicates=0, 441 tri-material locations, overfull=1192. | PreZero.pdf unaudited; host questions pending (reading semantics, overfull meaning, Location_id granularity). Next: M2. |
| M2 — Ingestion/canonical data | DONE | data-engineer | `src/data/schema.py` + `src/data/loader.py` implement contracts.md §1 (R1–R7, I1–I3; overfull never coerced; errors ⇒ `Dataset.empty()` + full error list; stdlib only). Tests: 11 loader (labelled fixtures per rule + real-CSV regression pinning 11,701/449/1,338/1,192) + 7 schema. Architect review (2026-11-14): `.venv/bin/pytest` → 32/32 passed; `ruff check .` clean; `mypy src` → 0 issues (10 files); raw CSV untouched. 3 contract clarifications folded into docs/contracts.md. | Next: M3 (+M4 same pass); host questions §13.1–13.4 still open. |
| M3 — Exploratory analysis | NOT_STARTED | data-engineer | | |
| M4 — Spatial/container analysis | NOT_STARTED | data-engineer | | |
| M5 — Forecast baseline/features | NOT_STARTED | ml-engineer | | |
| M6 — ML/evaluation | NOT_STARTED | ml-engineer | | |
| M7 — Collection policy | NOT_STARTED | optimization-engineer | | |
| M8 — Geography/fleet inputs | NOT_STARTED | optimization-engineer | | |
| M9 — Route optimisation | NOT_STARTED | optimization-engineer | | |
| M10 — API | NOT_STARTED | backend-engineer | | |
| M11 — Frontend | NOT_STARTED | frontend-engineer | | |
| M12 — Integration/demo | NOT_STARTED | architect | | |
| M13 — QA/docs/handover | NOT_STARTED | qa-engineer | | |
