# Real-capture fixtures (observed)

Verbatim HTTP responses captured **2026-11-14** from the live FastAPI backend
(uvicorn, M10 build) after uploading `data/raw/glass_fill_levels_anonymized_f.csv`.
These are **observed data**, not synthetic — they pin the real wire shapes:

- `upload.json` — `POST /api/datasets` 200. **Flat** `DatasetSummary` fields +
  `errors`/`warnings` lists (backend `DatasetUploadResponse(DatasetSummaryResponse)`,
  contracts §5.1 "DatasetSummary + errors/warnings"). There is **no nested
  `summary` key** — this fixture is the regression guard for the blank-page bug.
- `summary.json` — `GET /api/summary` 200.
- `containers.json` — `GET /api/containers` 200: all 1,338 series, including the
  **101 rows with `last_fill_pct: null` + `last_is_overfull: true`** (overfull is
  never coerced, §1.1).
- `config.json` — `GET /api/config` 200 (demo defaults + `assumption_fields`).
- `route.json` — `POST /api/route` 200 (as_of `2026-09-30`, defaults; capture
  2026-11-14): feasible, 3 routes / 43 served / **415 unserved with reasons**,
  totals 69,889 m / 601 min / 47,880 L / 23,940 kg, fleet rec `demo_truck` ×63,
  10 assumptions. Pins the real wire shapes: FLAT unserved entries
  (`{location_id, material_type, reason}` — no `stop_key`) and
  `load_progression` as `[volume_litres, weight_kg]` tuple arrays.

Location IDs are anonymized challenge identifiers; no personal data.
