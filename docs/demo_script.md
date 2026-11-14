# Demo script — SmartWasteRouting (M13–M15, v3 parameters)

Goal: a 5-minute reproducible end-to-end story on real challenge data with
every assumption visibly labelled. Numeric beats follow the generated v3
comparison in `docs/demo_numbers.md` (reproduce:
`.venv/bin/python -m src.api.compare_demo`).

## Setup (pre-demo, from clean checkout)

```bash
uv venv --python 3.14 && uv pip install -e ".[dev]"
npm --prefix frontend install
.venv/bin/uvicorn src.api.main:app --reload &        # :8000
npm --prefix frontend run dev &                      # http://localhost:5173 (proxies to :8000)
```

Note: the Vite dev server answers on `localhost` (IPv6); in a terminal use
`curl http://localhost:5173/health`, not `127.0.0.1` [observed 2026-11-14].

## Beats

1. **Load data** — on Overview, press **Load demo data** (server-side demo
   CSV, labelled `demo:`) or drag `data/raw/glass_fill_levels_anonymized_f.csv`
   into the upload panel. KPIs appear [observed]: 11,701 readings, 449
   locations, 1,338 series, 2025-10-17..2026-09-30; 34.5 % of readings
   at/above 80 %, 10.2 % the `overfull` token (never coerced), 0.0 % empty.
   Word these as *readings* — the data has no collection/emptying events.
2. **Before/after card (three-step comparison story)** — from
   `GET /api/comparison` on v3 representative parameters
   (`docs/demo_numbers.md`): ① status-quo sweep `naive_sweep_all`
   454,623 m, 50/1,338 served; ② selection effect `naive_sweep_selected`
   527,021 m, 38/458 — **negative selection gain −72,398 m, worded honestly
   ("did not pay off")**; ③ optimised `ortools` 70,175 m, 34/458, routing
   gain +456,846 m, total +384,448 m. Point at the m-per-kg column
   (10.1 → 10.6 → 3.1) as the like-for-like view; never equate raw
   distances. Cost beats, all [predicted] derivations — never invoiced:
   each scenario 1,500 EUR/day (3 trucks × 500 EUR/truck-day
   [representative]) / 300,000 EUR/year (× 200 operating days
   [representative]); fleet budget 99 × `demo_truck` = 49,500 EUR/day /
   9,900,000 EUR/year, covering full demand incl. unserved stops.
   Technical details: determinism `identical` ×5 (70,175 m each).
3. **Containers, forecasts & days-to-full** — pick as_of 2026-09-30
   (horizon 28 [demo assumption: the observed median reading gap]);
   persistence baseline; honest evaluation: test MAE 22.76 pp [predicted,
   chronological split]. Then open the days-to-full view
   (`GET /api/days-to-full` — the representative's reporting wish):
   1,213/1,338 series with an estimate, median 48.3 d, mean 113.0 d,
   min 0, max 2,120 d [predicted]; say the caveats out loud: constant
   fill rate, no emptying assumed between readings, median reading gap
   28 d [observed] — indicative, not a schedule.
4. **Candidates** — threshold 80 + overfull rule [demo assumption]; 458
   selected / 880 skipped [observed; unchanged by v3] with reason badges;
   tweak the threshold live in the config editor to show adaptivity.
5. **Route** — map with numbered stops, depot/disposal icons; status
   `feasible`, 3 routes, 34 of 458 served / 424 unserved **each with a
   reason**, 70,175 m / 580 min, 45,000 L / 22,500 kg; fleet
   recommendation 99 × `demo_truck` (basis: 99 by volume, 60 by weight);
   scenario cost 1,500 EUR/day [predicted] (`docs/demo_numbers.md`,
   ortools scenario). The v3 physics behind it are all labelled: 3,000 L
   containers, 5 min emptying, 10 min per leg incl. depot/disposal
   (interpretation, Q4), 8 h shift [representative]; equal-third
   compartments, densities, fleet specs [demo assumption]. Banner:
   "synthetic demo geography — straight-line derived distances, NOT road
   distances" (`haversine_straight_line_derived`).
6. **Honesty slide** — observed vs predicted vs [representative] /
   [demo assumption] legend (`docs/contracts.md`). Split the host inputs:
   **answered verbally 14 Nov 2026** → [representative]: 3 m³ containers;
   5 min emptying; 10 min between containers; 8 h shift; 500 EUR/day,
   5 days/week, 200 days/year; one vehicle type serves all materials,
   collected separated. **Still open** (`docs/open_questions.md` Q1–Q8):
   truck capacity + fleet count (Q1), densities (Q2), compartment layout
   (Q3), is the 10 min flat/average and does it cover depot/disposal legs
   (Q4), per-container vs per-location emptying (Q5), real coordinates
   (Q6), road-network matrix (Q7), disposal unload duration (Q8).

## Rules

- Never present straight-line-derived distances as road distances.
- Never present defaults as facts: [representative] values came verbally
  from the host; [demo assumption] values are placeholders — the config
  panel keeps the per-field source labels visible; overrides never
  re-label a value as fact.
- Negative gains are shown as negative (e.g. selection −72,398 m), never
  spun.
- Never present cost figures as invoiced amounts — they are [predicted]
  derivations from the [representative] cost parameters.
- If the solver returns infeasible/timeout, show the unserved reasons —
  that is the product working as designed. A fired wall-clock safety cap
  means status `timeout` and the run is explicitly not reproducible.
- Unserved stops are never silently dropped.

## Fallback

- If upload fails: **Load demo data** (same server-side CSV, labelled).
- If a live solve is slow: the fixed solution budget (200 [demo
  assumption]) stops the solver deterministically; the 30 s wall-clock cap
  is a safety net that would show as an honest `timeout`.
