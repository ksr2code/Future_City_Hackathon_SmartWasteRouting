# Demo script — WasteRouting.AI (M12, DRAFT pending M10/M11 review)

Goal: a 5-minute reproducible end-to-end story on real challenge data with
every assumption visibly labelled.

## Setup (pre-demo, from clean checkout)

```bash
uv sync                          # backend deps
npm --prefix frontend install    # frontend deps
uvicorn src.api.main:app --reload &        # :8000
npm --prefix frontend run dev &            # :5173 (proxies to :8000)
```

## Beats

1. **Upload** — drag `data/raw/glass_fill_levels_anonymized_f.csv` into the
   upload panel. KPIs appear: 11,701 readings, 449 locations, 1,338 series,
   date range, per-material counts [observed].
2. **Patterns** — one insight slide each from `docs/eda_report.md`: 0 readings
   on all 11 BW holidays; weekday vs weekend rhythm; overfull share peak
   Mar-2026 (0.376) [observed].
3. **Forecast** — pick an as_of date, run persistence baseline; explain
   honest evaluation: test MAE 22.76 pp [predicted], chronological split.
4. **Candidates** — threshold 80 + overfull rule; show selected vs skipped
   with reason badges; tweak threshold live (config editor) to show
   adaptivity [demo assumption].
5. **Route** — solve; map with routes, depot/disposal icons, unserved list
   with reasons; fleet recommendation from total weight+volume (brief §4).
   Banner: "synthetic demo geography — straight-line derived distances,
   NOT road distances".
6. **Honesty slide** — what is observed vs predicted vs demo assumption
   (contracts.md status legend); open host questions (§4.5).

## Rules

- Never present straight-line distances as road distances.
- Never present demo defaults (fleet, density, volumes, service times,
  shift) as facts — the config panel keeps [demo assumption] labels.
- If solver returns infeasible/timeout, show the unserved reasons — that is
  the product working as designed.

## Fallback

- If upload fails: pre-loaded fixture CSV (labelled).
- If live solve is slow: solver_time_limit_s stays 5 [demo assumption].
