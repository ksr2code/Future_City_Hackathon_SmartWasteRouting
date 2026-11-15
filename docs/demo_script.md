# Demo script — SmartWasteRouting (M17, v5 — 3-minute pitch)

Goal: a **3-minute** pitch that runs **offline from bundled captures** (§6 v5:
precalculated from the real dataset, captured 2026-11-15, zero live network
calls) with the **money story as the centrepiece** — cost always shown with
its service level (§6). Every number below is in `docs/demo_numbers.md` /
`docs/schedule_profile.md` and traces to the live runs recorded there.

## Mode A — the pitch (default; no backend, no network)

The presentation mode reads **committed verbatim API captures**
(`frontend/src/test/fixtures/real-capture/presentation/` — summary,
comparison, scenarios, days-to-full, candidates, all captured 2026-11-15),
bundled at build time. It renders a visible error on a missing/invalid
capture — never a spinner, never a fabricated number.

```bash
npm --prefix frontend install
npm --prefix frontend run dev        # http://localhost:5173 — no API server needed
```

Open the app, press **Presentation mode** (6 slides, ←/→, Esc, guarded
fullscreen). Every slide says its basis: "precalculated from real data
(captured 2026-11-15)" — never "live".

### Timing plan (≈180 s total, ~30 s per slide)

| slide | title | say (seconds 0–30 each) |
|---|---|---|
| 1 | Why we are here | The city empties 1,338 glass-container series at 449 locations; the data shows **when** containers were emptied and **how full** they were — we forecast demand and plan the schedule. |
| 2 | Observed today | **11,701 emptying records** over 349 days [observed]. 34.5 % of records at/above 80 %, 10.2 % the literal `overfull` token (never coerced), 0.0 % empty. One row = one emptying event [representative-stated]. |
| 3 | Filling time per material | Per-series fill-at-emptying rates → days-to-full [predicted]: median brown **122 d**, green **52 d**, white **38 d** — white/green fill far sooner. "At least" markers = censored lower bounds (66.5 % of estimates; real demand ≥ estimate). |
| 4 | Today's recommendation | For as-of 2026-09-30: **458 series expected to need emptying / 880 wait** — every skip shows its reason (threshold 80 % + always-overfull [demo assumption]). The product explains *why*, not just *what*. |
| 5 | **The money story: today → plan** (centrepiece — slow down here) | Today's observed schedule costs **523 truck-days → 261,500 EUR** over the observed window [observed × representative time model]. Our day-spreading plan: **342 truck-days → 171,000 EUR** [predicted — simulation on observed rates]. **≈ 90,500 EUR lower (−34.6 % cost, derived) — with better service**: the plan overflows never (max fill 88.9 %) while the observed schedule's own anchor is 26.9 % of emptying records full/overfull [observed]. Truck-days: 523 → 342. |
| 6 | Distance: status quo vs optimised | Route optimisation cuts the modelled drive distance 355,474 → 70,175 m (total gain +384,448 m [predicted]). Caveat on screen: distances are straight-line-derived estimates — **never road kilometres** (Q12). |

Punchline for slide 5 (the one sentence to land): *"The city can save about a
third of its collection cost — roughly 90,000 EUR a year at the labelled
500 EUR/truck-day — not by cutting service, but by spreading the same work
across days so peaks flatten from 5 trucks to 1."* Label discipline: cost
rate is [representative]; the −34.6 % is derived from the live comparison of
observed schedule vs plan; per-year extrapolations exist in
`docs/demo_numbers.md` but the pitch uses the same-window totals.

## Mode B — optional live appendix (after the pitch, if time and jury allow)

Start the backend and load the demo dataset (identical results to the
captures — the captures were taken from exactly this run shape):

```bash
uv venv --python 3.14 && uv pip install -e ".[dev]"
.venv/bin/uvicorn src.api.main:app --reload &        # :8000
npm --prefix frontend run dev &                      # http://localhost:5173 (proxies to :8000)
```

On Overview press **Load demo data** (server-side demo CSV, labelled
`demo:`) or upload `data/raw/glass_fill_levels_anonymized_f.csv`. KPIs
[observed]: 11,701 emptying records (DE "Leerungsdaten"), 449 locations,
1,338 series, 2025-10-17..2026-09-30; 34.5 % at/above 80 %, 10.2 %
`overfull` (never coerced), 0.0 % empty. Say the semantics out loud: **one
row = one emptying event** [representative-stated, written confirmation
pending] — and the caveat: fill at emptying shows how full the container was
when the schedule reached it, not how fast it would have filled.

- **Scenarios tab** — the live engine behind slide 5 (`POST /api/scenarios`,
  numbers in `docs/demo_numbers.md`, live run 2026-11-15):
  `fixed_frequency` 15,636 emptyings / 852 truck-days / 426,000 EUR but
  2.4 % overflow container-days and 14.4 % of simulated emptyings
  at/overfull; `demand_driven` 9,993 / 1,040 / 520,000 EUR, zero overflow
  but **more expensive** (rate-synchronised series come due together);
  `day_spread` 9,237 / 342 / **171,000 EUR**, zero overflow, peak 1
  truck/day (28 stops/truck-day, 29,401 deferrals, longest wait 29 d —
  deferral is surfaced, never a silent drop). Beside them the
  `observed_baseline` status-quo column: 229/349 active days, 11,701
  visits, 523 truck-days / 261,500 EUR, median 2 / peak 5 trucks,
  0 capacity-infeasible days — cost and service always together (§6).
  Timeline note: ~12 "mega-days" are a labelled replay artefact of the
  §5.2.5 initialisation rule, not observed behaviour.
- **Route map** — `POST /api/route` (as-of 2026-09-30, horizon 28 [demo
  assumption — observed median emptying interval]): status `feasible`, 3
  routes, 34 of 458 served / 424 unserved **each with a reason**, 70,175 m /
  580 min, 45,000 L / 18,000 kg, fleet recommendation 99 × `demo_truck`
  (basis 99 by volume / 48 by weight), cost 1,500 EUR/day [predicted]
  beside the 26.9 % anchor. Banner: synthetic demo geography,
  `haversine_straight_line_derived` — never road distance. Physics all
  labelled: 3,000 L containers and 5 min emptying [representative], 10 min
  per leg incl. depot/disposal (interpretation, Q4), 8 h shift
  [representative], equal-third compartments and fleet specs [demo
  assumption], density 0.40 kg/L [literature — AVV 20 01 02].
- **Config editor** — every default tagged
  [representative]/[literature]/[demo assumption]; tweak a slider live to
  show nothing is hardcoded.

## Q&A preparation (labelled answers, no improvisation)

- **"How many trucks does the city need?"** — the honest answer is a range
  from the observed schedule: median 2, peak 5 trucks on active days
  [observed × representative time model, §4.8]; the plan flattens the peak
  to 1 truck/day. The 3 × `demo_truck` solver input is a separate labelled
  demo assumption (Q1 — real fleet unknown).
- **"Are these road kilometres?"** — no: haversine straight-line × 1.4
  detour [demo assumption]; real-road routing is blocked until the host's
  109 site IDs can be joined to the 449 data locations (Q12).
- **"Is the money real?"** — derived [predicted] products of the
  [representative] 500 EUR/truck-day rate; never invoiced amounts. The
  −34.6 % compares same-window totals of observed schedule vs plan.
- **"Why does the plan visit fewer stops (9,237) than the observed 11,701?"**
  — it empties when projected fill ≥ 80 % instead of on the observed
  calendar; series that would overflow are served anyway (max fill 88.9 %,
  overflow 0.0 %), and every deferral is counted, never dropped.
- **"What is still assumed?"** — `docs/open_questions.md` Q1–Q12: truck
  capacity/fleet (Q1), measured densities (Q2), compartments (Q3), leg
  coverage of the 10 min (Q4), per-container vs per-location (Q5), real
  coordinates (Q6), road matrix (Q7), disposal unload (Q8), second key
  graph (Q9), the real forward schedule (Q10 — the observed history is our
  status-quo proxy), same-colour duplicates (Q11), site↔series mapping
  (Q12).

## Rules

- Presentation slides say **"precalculated from real data (captured
  2026-11-15)"** — never "live" (§6 v5). A missing/invalid capture renders a
  visible error, never an endless spinner or a fabricated number.
- Never present straight-line-derived distances as road distances.
- Never present defaults as facts: [representative] values came verbally
  from the host; [literature] values cite their source; [demo assumption]
  values are placeholders — the config panel keeps the per-field source
  labels visible; overrides never re-label a value as fact.
- **Every cost figure is shown with its service level** (§6) — the observed
  anchor 26.9 % beside the baseline, the simulated overflow/full shares
  beside strategy costs, the plan's 0.0 % overflow beside its saving.
  Cost is never shown alone.
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

- Presentation mode needs **no backend and no network** — if anything else
  breaks, the pitch still runs (§6 v5).
- If a live solve is slow: the fixed solution budget (200 [demo
  assumption]) stops the solver deterministically; the 30 s wall-clock cap
  is a safety net that would show as an honest `timeout`.
- If the live API is unavailable mid-Mode-B: switch to presentation mode —
  the captures are the same numbers recorded from a real run, labelled with
  the capture date.
