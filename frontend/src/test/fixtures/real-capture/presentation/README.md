# Presentation capture bundle (§6 v5) — verbatim API outputs

Precalculated captures for presentation mode. **Captured 2026-11-15** from the
live FastAPI backend (`:8003`-equivalent local uvicorn, commit state = M16
final) after `POST /api/datasets/demo` (the real challenge CSV,
11,701 rows / 449 locations / 1,338 series). These files are **observed HTTP
responses** — API outputs/aggregates only; no raw CSV rows and no host
coordinates JSON. Imported statically by `src/lib/presentationData.ts`, so a
missing file fails the build (never a runtime spinner) and a shape mismatch is
caught by the loader's validation (visible error slide, §6 v5).

Reproduce (backend running on `$PORT`, dataset loaded):

```sh
curl -s localhost:$PORT/api/summary                                    > summary.json
curl -s localhost:$PORT/api/comparison                                 > comparison.json
curl -s -X POST localhost:$PORT/api/scenarios -H 'Content-Type: application/json' -d '{}' > scenarios.json
curl -s localhost:$PORT/api/days-to-full                               > days_to_full.json
curl -s -X POST localhost:$PORT/api/candidates -H 'Content-Type: application/json' \
  -d '{"as_of_date":"2026-09-30","horizon_days":7,"method":"persistence"}' > candidates.json
```

The candidates request mirrors exactly what the component used to fetch live
(`as_of` = `summary.date_max`, `horizon_days` = `RECOMMENDATION_HORIZON_DAYS`
= 7, method `persistence`).

- `summary.json` — `GET /api/summary` 200: 11,701 rows, `date_max`
  2026-09-30, `fill_stats` 34.5 % / 10.2 % / 0.0 % at threshold 80.
- `comparison.json` — `GET /api/comparison` 200 (v4 shape): status-quo sweep
  454,623 m → optimised 70,175 m (identical ×5), total gain +384,448 m,
  anchor 26.9 %. **Value-identical to `../v4/comparison.json`** (captured
  2026-11-14) — solver determinism verified across days.
- `scenarios.json` — `POST /api/scenarios` 200 (defaults), §5.2.4+§5.2.6
  (**regenerated 2026-11-15 for v5**, M17-P2b): three strategies incl.
  `day_spread` (342 truck-days, 171,000 EUR, overflow 0.0 %, max fill
  88.9 %, peak 1 / typical 1.0 trucks/day) + top-level `observed_baseline`
  (523 truck-days, 261,500 EUR, median 2 / peak 5 trucks, 229/349 active
  days, 11,701 visits, 0 infeasible days); `fixed_frequency`/`demand_driven`
  rows and `observed_anchor` (26.9 %) byte-identical to the 2026-11-14 v4
  capture. Money story: baseline − day_spread = 90,500 EUR over the window
  (−34.6 %, derived) with better simulated service.
- `days_to_full.json` — `GET /api/days-to-full` 200 (§5.2.3 v2). Identical to
  `../v4/days_to_full.json`.
- `candidates.json` — `POST /api/candidates` 200: 458 selected / 880 skipped
  with reason codes; as_of 2026-09-30, target 2026-10-07. Contains
  anonymized challenge location IDs + prediction aggregates only.

Location IDs are anonymized challenge identifiers; no personal data. Bundle
total ≈ 730 KB raw (gzips to ≈ a tenth); acceptable for an offline
presentation bundle.
