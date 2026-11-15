# Demo script — SmartWasteRouting (M19 — the Overview page IS the pitch)

Goal: a **3-minute walkthrough of the live Overview page**. There is no
separate presentation mode any more (user decision 2026-11-15; contracts §6
v5 bullet superseded): the story sections on Overview — fed by the **live
API** under normal loading/empty/error conventions — are the pitch. Every
chart keeps its [observed] / [predicted] / [demo assumption] labels, figures
come from API responses only, and cost is never shown without service (§6).
Numeric beats follow `docs/demo_numbers.md` (v5) — reproduce with
`.venv/bin/python -m src.api.compare_demo` + the live curls recorded there.

## Setup (backend must be running — the pitch is live)

```bash
uv venv --python 3.14 && uv pip install -e ".[dev]"
.venv/bin/uvicorn src.api.main:app --reload &        # :8000
npm --prefix frontend run dev &                      # http://localhost:5173 (proxies to :8000)
```

On Overview press **Load demo data** (server-side demo CSV, labelled
`demo:`) or upload `data/raw/glass_fill_levels_anonymized_f.csv`. The Vite
dev server answers on `localhost` (IPv6), not `127.0.0.1` [observed]. A
section whose API call has not landed yet shows loading/error states — never
a fabricated number; wait for the story sections to fill before pitching.

## The 3-minute walkthrough (top of page → down)

Timing ≈ 180 s; one sentence per beat, point at the chart.

1. **Key numbers (~20 s)** [observed]: **11,701 emptying records**
   (DE "Leerungsdaten"), 449 locations, 1,338 series,
   2025-10-17..2026-09-30; 34.5 % of records at/above 80 %, 10.2 % the
   literal `overfull` token (never coerced), 0.0 % empty. Say the semantics
   out loud: **one row = one emptying event** [representative-stated,
   written confirmation pending] — fill at emptying shows how full the
   container was when the schedule reached it, not how fast it fills.
2. **Tanks + Today's recommendation (~20 s)** — containers currently
   expected to need emptying vs wait, with example reasons (threshold 80 %
   + always-overfull [demo assumption]); 458 selected / 880 skipped at the
   default config [observed].
3. **Observed-visits timeline (story §1, ~25 s)** [observed, live
   `/api/simulation` `observed_days`]: 229 active days of the 349-day
   window as bars, median-51-visits line; peaks up to 127 visits/day. This
   is the status quo **counted, not simulated**.
4. **Fill curve + days-to-full histogram (story §2, ~25 s)** [predicted,
   `GET /api/days-to-full`]: per-series fill-at-emptying rates → median
   brown **121.95 d**, green **52.0 d**, white **38.05 d**; the histogram
   shows the spread; "at least" markers = censored lower bounds (66.5 % of
   estimates — real demand ≥ estimate). White/green fill far sooner.
5. **The trap (story §3, ~30 s — the answer to "why not just react?")**:
   truck-days chart, live `POST /api/scenarios` — `demand_driven` emptying
   on the 80 % trigger alone costs **1,040 truck-days / 520,000 EUR**,
   **more** than the fixed 28-day cycle (852 / 426,000 EUR [demo
   assumption, Q10]). Why: rate-synchronised series come due on the same
   days, so peak days need more trucks despite fewer total emptyings
   (9,993 stops). Same-day reaction clusters work; clustering costs money.
6. **Money story (story §4, the centrepiece, ~35 s — slow down)**: baseline
   card vs plan card [live `POST /api/scenarios` §5.2.6]: the observed
   schedule through the §4.8 time model costs **523 truck-days →
   261,500 EUR** [observed × representative time model]; the day-spreading
   plan **342 truck-days → 171,000 EUR** [predicted — simulation on
   observed rates]. **≈ 90,500 EUR lower (−34.6 %, derived from these live
   responses)** — **with better service, not worse**: plan overflow 0.0 %
   (max fill 88.9 %) vs the observed anchor 26.9 % of emptying records
   full/overfull [observed]. Land the sentence: *"about a third of the cost
   by spreading the same work across days — peaks flatten from 5 trucks to
   1 — not by cutting service."* Peak detail if asked: plan peak 1 truck/day,
   28 stops/truck-day, 29,401 deferrals (longest wait 29 d — surfaced,
   never dropped); observed schedule median 2 / peak 5 trucks.
7. **Outcomes strip (~15 s)**: cost **261,500 → 171,000 EUR** over the
   observed window, service badges beside it (anchor 26.9 % vs plan
   overflow 0.0 %) — cost and service together, §6.
8. **Four-step comparison card (~20 s)** [live `GET /api/comparison`]:
   ① status quo 28-d cycle 355,474 m (60/637); ② sweep-all 454,623 m
   (50/1,338); ③ selection effect 527,021 m (38/458) — negative gain
   −72,398 m, worded honestly; ④ optimised 70,175 m (34/458), routing gain
   +456,846 m, total +384,448 m. Like-for-like is the m/kg column
   (10.5 → 12.6 → 13.2 → 3.9). Flat 10-min mode: order cannot change
   duration (§4.4). Distances haversine-straight-line-derived — never road
   distance (Q12).

If the jury wants the route map / config editor / Scenarios sliders, that is
the optional appendix below — the pitch itself is the page scroll above.

## Optional live appendix (time and jury permitting)

- **Scenarios tab** — sliders (cycle 28 d [Q10], containers per series
  [Q11], truck-day cost, shift, vehicle volume) driving the same live
  engine: `fixed_frequency` 15,636 emptyings / 852 truck-days / 426,000 EUR
  with 2.4 % overflow container-days and 14.4 % simulated emptyings
  at/overfull; `demand_driven` 9,993 / 1,040 / 520,000 EUR, zero overflow
  but more expensive; `day_spread` 9,237 / 342 / **171,000 EUR**, zero
  overflow. Baseline card beside them: 229/349 active days, 11,701 visits,
  523 truck-days / 261,500 EUR, 0 capacity-infeasible days. Timeline
  mega-day note: ~12 synchronised days of ~1,303 emptyings are a labelled
  replay artefact of the §5.2.5 initialisation rule, not observed
  behaviour.
- **Route map** — `POST /api/route` (as-of 2026-09-30, horizon 28
  [demo assumption — observed median emptying interval]): status
  `feasible`, 3 routes, 34 of 458 served / 424 unserved **each with a
  reason**, 70,175 m / 580 min, 45,000 L / 18,000 kg, fleet recommendation
  99 × `demo_truck` (basis 99 by volume / 48 by weight — a solver input for
  the modelled scenario, **not** a fleet claim; the fleet evidence is the
  observed median 2 / peak 5), cost 1,500 EUR/day [predicted] beside the
  26.9 % anchor. Physics all labelled: 3,000 L containers, 5 min emptying
  [representative]; 10 min per leg incl. depot/disposal (interpretation,
  Q4); 8 h shift [representative]; equal-third compartments, fleet specs
  [demo assumption]; density 0.40 kg/L [literature — AVV 20 01 02].
- **Config editor** — every default tagged
  [representative]/[literature]/[demo assumption]; tweak a slider live to
  show nothing is hardcoded.

## Q&A preparation (labelled answers, no improvisation)

- **"How many trucks does the city need?"** — a range from the observed
  schedule: median 2, peak 5 trucks on active days [observed ×
  representative time model, §4.8]; the plan flattens the peak to 1
  truck/day. The 3 × `demo_truck` solver input is a separate labelled demo
  assumption (Q1 — real fleet unknown).
- **"Are these road kilometres?"** — no: haversine straight-line × 1.4
  detour [demo assumption]; real-road routing is blocked until the host's
  109 site IDs can be joined to the 449 data locations (Q12).
- **"Is the money real?"** — derived [predicted] products of the
  [representative] 500 EUR/truck-day rate; never invoiced amounts. The
  −34.6 % compares same-window totals of observed schedule vs plan, from
  the live API responses.
- **"Why does demand-driven cost more?"** — the trap chart: emptying purely
  on the 80 % trigger synchronises series (rate-synchronised containers
  come due together), so peak days need more trucks; day-spreading keeps
  the trigger but defers within capacity (28 stops/truck-day), flattening
  peaks instead of paying for them.
- **"Why does the plan visit fewer stops (9,237) than the observed 11,701?"**
  — it empties when projected fill ≥ 80 % instead of on the observed
  calendar; series that would overflow are served anyway (max fill 88.9 %,
  overflow 0.0 %), and every deferral is counted, never dropped.
- **"What is still assumed?"** — `docs/open_questions.md` Q1–Q12: truck
  capacity/fleet (Q1), measured densities (Q2), compartments (Q3), leg
  coverage of the 10 min (Q4), per-container vs per-location (Q5), real
  coordinates (Q6), road matrix (Q7), disposal unload (Q8), second key
  graph (Q9), the real forward schedule (Q10 — the observed history is the
  status-quo proxy), same-colour duplicates (Q11), site↔series mapping
  (Q12).

## Rules

- The pitch is **live**: sections read API responses under normal
  loading/empty/error conventions — a missing/failed call shows its error
  state, never a fabricated number and never a stale capture presented as
  current (§6 v5 superseded bullet).
- Every chart keeps its data-basis labels; cost is never shown without its
  service level (§6).
- Never present straight-line-derived distances as road distances.
- Never present defaults as facts: [representative] values came verbally
  from the host; [literature] values cite their source; [demo assumption]
  values are placeholders — the config panel keeps the per-field source
  labels visible; overrides never re-label a value as fact.
- Human wording is "emptying records" / "Leerungsdaten" — never
  "readings"/"measurements"/"sensor" (JSON field names keep the historical
  `readings` tokens).
- Negative or inconvenient results are shown as they are (e.g. the
  selection gain −72,398 m, demand-driven costing more than fixed) — never
  spun.
- Never present cost figures as invoiced amounts — they are [predicted]
  derivations from the [representative] cost parameters.
- If the solver returns infeasible/timeout, show the unserved reasons —
  that is the product working as designed. A fired wall-clock safety cap
  means status `timeout` and the run is explicitly not reproducible.
- Unserved stops are never silently dropped.

## Fallback

- If the backend is down, the pitch cannot run — say so honestly; the app
  shows error states, not fabricated numbers. Restart uvicorn and reload.
- If a live solve is slow: the fixed solution budget (200 [demo
  assumption]) stops the solver deterministically; the 30 s wall-clock cap
  is a safety net that would show as an honest `timeout`.
- If upload fails: **Load demo data** (same server-side CSV, labelled).
