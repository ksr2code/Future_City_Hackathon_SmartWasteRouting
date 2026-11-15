# Routing methodology (M13, refreshed for v4 semantics + scenario engine, M16; M17 v5: observed baseline + day-spreading scheduler)

How routes are produced: inputs, distance/travel-time provenance,
constraints, the solver setup, unserved handling, fleet sizing + cost, the
comparison design, the scenario engine + simulation replay + the observed
schedule baseline and day-spreading scheduler, and the days-to-full
companion estimate.
Authority: `docs/contracts.md` §4 (esp. §4.2–§4.8) and §5. Comparison demo
numbers marked `docs/demo_numbers.md` come from the generated v5 run of
`.venv/bin/python -m src.api.compare_demo` on the demo dataset
(as_of 2026-09-30, horizon 28); scenario-engine, observed-baseline and
replay numbers come from live `POST /api/scenarios` / `POST /api/simulation`
runs recorded in the same file (2026-11-15).

Status legend: **[observed]** = verified in the challenge data ·
**[predicted]** = model/solver output · **[representative]** = supplied
verbally by the challenge representative (14 Nov 2026) ·
**[representative-stated]** = project-owner statement of data semantics
(written confirmation pending) · **[literature]** = sourced external
reference (citation beside the value) · **[demo assumption]** = labelled
synthetic value, not from data. Inputs still awaited from the host:
`docs/open_questions.md` (Q1–Q12).

## 1. Distance and travel-time provenance

There is no road-network, matrix or speed data in the challenge inputs
[observed]. **Distances** are built from synthetic coordinates (SHA-256
derived per series key) via great-circle haversine × detour factor 1.4
[demo assumption] in every mode; provenance is recorded as
`haversine_straight_line_derived` and echoed into every solution,
comparison response and UI label — **never presented as road distances**.

**Durations** follow `travel_time_mode` (§4.6):
- `fixed_per_leg` (default): 10 min on **every** leg, including
  depot→first, last→depot and any disposal leg [representative value; the
  representative said "10 min between containers" — applying it to
  depot/disposal legs is our interpretation, open question Q4].
- `haversine_derived` (optional): distance ÷ 30 km/h [demo assumption,
  used in this mode only].

## 2. Demo physics (§4.6 v4, per-request overridable, per-field source labels)

| value | default | source |
|---|---|---|
| container volume | 3,000 L (3 m³) | [representative] |
| density | 0.40 kg/L uniform (brown/green/white) | [literature] German AVV conversion table: 0.40 t/m³ for AVV 20 01 02 "Altglas (Flaschen-/Behälterglas, Depotcontainer)" (entsorgen-versorgen.de, retrieved 2026-11-14); partner's 380 kg/m³ corroborates within 5 % (Q2) |
| vehicle | `demo_truck`: 12,000 L / 10,000 kg, 3 available | [demo assumption, Q1] |
| compartments | equal thirds: 4,000 L per material (sum = vehicle volume) | [demo assumption, Q3] |
| stop service time | 5 min | [representative] (per container — Q5 open) |
| disposal service time | 30 min | [demo assumption, Q8] |
| shift | 480 min (8 h) | [representative] |
| travel time | `fixed_per_leg`: 10 min every leg incl. depot/disposal | [representative + interpretation, Q4] |
| cost parameters | 500 EUR/truck-day, 5 days/week, 200 days/year | [representative]; derived EUR amounts [predicted] |
| geography knobs | seed 0 (= current SHA-256 layout), spread 6 km | [demo assumption knobs] |
| containers per series | 1 (one igloo per colour per location) | [demo assumption, Q11] |
| collection cycle | frequency_days 28 (fixed-frequency strategy only — since M17 the status-quo baseline is the **observed schedule itself**, §4.8, not this cycle) | [demo assumption — observed median emptying interval; the real forward schedule is unknown, Q10] |
| solver | solution_limit 200 (primary, deterministic); time_limit 30 s (safety cap) | [demo assumption] |

`GET /api/config` echoes every default with its per-field source
(`sources` map: `representative` vs `demo assumption`) so the UI can keep
the distinction visible; overrides never relabel a value as a fact.

**Compartments** (Q3): one vehicle type serves all materials, collected
separated [representative]; the compartment layout on the truck is unknown,
so the demo assumes equal thirds — 4,000 L per material [demo
assumption]. Each material's collected volume is capped by its compartment
capacity at every point on a route; a disposal visit resets every material
dimension (§4.4). `collected_volume_by_material` surfaces any
compartment-bound limitation instead of hiding it.

**Cost** (§4.3): `cost_eur_per_day = vehicles_used × 500 EUR`,
`cost_eur_per_year = cost_eur_per_day × 200`; the fleet budget uses
`fleet_recommendation.count` instead of `vehicles_used`. All EUR amounts
are [predicted] derivations of the [representative] rate parameters —
**never invoiced amounts** (§4.4).

## 3. OR-Tools setup (src/routing/solver.py)

- **Model**: CVRP with one OR-Tools dimension per observed material
  (capacity = that vehicle's compartment volume for the material) plus a
  total weight dimension (kg = volume × density). Total volume needs no
  extra dimension: a validated compartment layout always sums to the
  vehicle volume. Disposal sites are optional unload nodes that **reset
  every dimension** — materials are never mixed on one truck
  [representative].
- **Droppable stops**: optional nodes with a large drop penalty; a dropped
  stop becomes `unserved` with a reason — never silently discarded.
- **Stopping criterion (v2)**: the fixed `solver_solution_limit` (200
  solutions). Repeated solves reaching the budget on the same problem
  return identical `totals.distance_m`. The wall-clock `solver_time_limit_s`
  is a **safety cap only**: if it fires first, status is `timeout` and the
  run is explicitly non-reproducible.
- **No time dimension** in the OR-Tools model: empirically, a span cap on
  any optional node that cannot fit makes the model FAIL at root
  propagation [observed during M9].
- Status mapping is honest: `optimal`/`feasible`/`infeasible`/`timeout`;
  NOT_SOLVED/INVALID → error. `objective_value` is the recomputed total
  route distance (metres), not the solver's penalty-mixed internal value.

Demo result (ortools scenario, `docs/demo_numbers.md`): status `feasible`,
3 routes, 70,175 m / 580 min, 34 of 458 candidates served / 424 unserved,
45,000 L / 18,000 kg (density 0.40 kg/L [literature]), cost 1,500 EUR/day
[predicted] — always shown beside the observed service anchor (26.9 % of
emptying records full/overfull [observed]). An interactive `POST /api/route`
under the same defaults returns the same status and invariants; served
counts may differ within the solver protocol (§4.4).

## 4. Shift handling (post-hoc, §4.4)

Because the model has no time dimension, the 480-min shift
[representative] is enforced **after** solving:

1. **Prefilter**: stops whose minimum round trip (depot → stop → nearest
   disposal → depot) exceeds the shift go straight to `unserved` with a
   reason.
2. **Truncation**: over-long routes are truncated deterministically —
   last disposal visit first (if capacities still hold), then lowest-fill
   stops; truncated stops become `unserved` with reasons.
3. **Reporting**: any residual route duration > shift is reported as a
   violation, never hidden.

## 5. Unserved reasons

Every input stop appears in exactly one route **or** in `unserved` with a
deterministic reason (capacities, compartment, shift, fleet exhaustion, no
forecast value, solver drop). Counts reconcile: `stops_served + unserved ==
stops_total`. Demo run (`docs/demo_numbers.md`): 34 served / 424 unserved
(selection: 458 selected / 880 skipped upstream; policy unchanged by v3).

## 6. Fleet recommendation and fleet budget

Per vehicle type, per the brief's "recommend fleet size from total weight
and volume":

```text
recommended_count = max(⌈total_volume_litres / volume_capacity⌉,
                        ⌈total_weight_kg / weight_capacity⌉)
```

with `basis: {ceil_by_volume, ceil_by_weight}` echoed so the driving
constraint is visible. The recommendation covers full demand including
unserved stops. Demo run (`docs/demo_numbers.md`): 99 × `demo_truck`
(basis 99 by volume, 48 by weight — the lower 0.40 kg/L [literature]
density shifts the binding constraint toward volume). The implied **fleet
budget** [predicted] is 99 × 500 EUR = 49,500 EUR/day, × 200 operating
days = 9,900,000 EUR/year — a derivation from the [representative] cost
parameters, never an invoiced amount.

## 7. Comparison design (v4, contracts §4.7)

Four scenarios isolate where improvement comes from; all share the §4.6
physics and the naive simulation semantics (`src/routing/naive.py`):
capacities, nearest-disposal unload, shift rules, fleet exhaustion,
per-stop unserved reasons. Numbers: `docs/demo_numbers.md` (v4 run).

| scenario | stops visited | order | isolates |
|---|---|---|---|
| `naive_fixed_frequency` | 637 series due at as_of (`as_of − last emptying ≥ frequency_days`; no last date ⇒ due) | area sweep | status quo (v4) |
| `naive_sweep_all` | all 1,338 series (no selection) | area sweep | upper bound |
| `naive_sweep_selected` | 458 policy-selected only | same area sweep | selection reference |
| `ortools` | 458 policy-selected only | OR-Tools | routing gain |

- **Area sweep order** [demo assumption]: the data has no area field
  [observed], so synthetic coordinates are bucketed into 0.01° grid cells
  (≈1 km), visited row-major; within a cell, lexicographic
  `(location_id, material_type)`.
- **Results**: fixed_frequency 355,474 m (60/637 served, 10.5 m/kg, 2
  reported shift overruns — surfaced, never hidden); sweep_all 454,623 m
  (50/1,338, 12.6 m/kg); sweep_selected 527,021 m (38/458, 13.2 m/kg);
  ortools 70,175 m (34/458, 3.9 m/kg). Each scenario costs 1,500 EUR/day /
  300,000 EUR/year [predicted] (3 trucks used × [representative] rates) —
  **always reported beside the observed service anchor: 26.9 % of emptying
  records full/overfull [observed]** (§4.7/§6; cost is never shown alone).
- **Gains** (derived, metres): selection = sweep_all − sweep_selected =
  **−72,398**; routing = sweep_selected − ortools = **+456,846**; total =
  **+384,448**. The negative selection gain (fewer stops under the same
  inefficient order) is reported honestly; served counts differ by design,
  so like-for-like judgement uses the per-stop/per-kg metrics
  (10.5 → 12.6 → 13.2 → 3.9 m/kg), never raw distance.
- **Flat-mode invariance** (§4.4): under `fixed_per_leg` every leg costs
  the same minutes, so visiting order cannot change total duration —
  duration is a function of stop count. Reports attribute time/cost
  differences to stop *selection*, never ordering; distance differences
  are distance only, labelled "no time effect in flat mode" where shown.
- **Repetition protocol** (optimised only): 5 solves [demo assumption];
  mode `identical` (min = max) or `median_of_runs` with min/median/max.
  The **median is the value used in the UI and docs**. Demo: identical ×5,
  70,175 m each.

Reproduce the comparison: `.venv/bin/python -m src.api.compare_demo` (writes
the comparison part of `docs/demo_numbers.md`); run the app per
`docs/user_guide.md` §2.

## 8. Scenario engine, simulation replay, observed baseline (v4/§5.2.6, contracts §5.2.4–§5.2.6, §4.8)

`POST /api/scenarios` replays three strategies over the observed window on
per-series fill-at-emptying rates (§5.2.3 [predicted]) under the same §4.6
physics (flat 10-min legs — ordering is irrelevant, §4.4, so no solver
runs here; deterministic), with the **observed schedule** as the status-quo
column beside them:

| strategy | rule | emptyings | truck-days | cost total/year [predicted] | overflow share | simulated emptyings full/overfull | max fill |
|---|---|---|---|---|---|---|---|
| `fixed_frequency` | every `frequency_days` (28 [demo assumption, Q10]) | 15,636 | 852 | 426,000 / 244,126.07 EUR | 2.4 % | 14.4 % | 366.4 % |
| `demand_driven` | predicted fill ≥ 80 % [demo assumption, §3.1] | 9,993 | 1,040 | 520,000 / 297,994.27 EUR | 0.0 % | 0.0 % | 80.0 % |
| `day_spread` | due at ≥ 80 % projected fill, spread across days (§4.8 scheduler) | 9,237 | 342 | 171,000 / 97,994.27 EUR | 0.0 % | 0.0 % | 88.9 % |
| `observed_baseline` | the observed schedule itself [observed × representative time model] | 11,701 visits | 523 | 261,500 / 273,488.54 EUR [predicted ×365/349] | — | 26.9 % [observed anchor] | 100.0 % [observed] |

Observed anchor [observed]: 26.9 % of emptying records full/overfull, max
numeric fill 100.0 % — reported with every simulated cost. **§6 rule: cost
and service level are always reported together; a strategy that lowers cost
while worsening service is flagged, never shown cost-alone.** The live
run's honest results: `fixed_frequency` is cheaper than `demand_driven`
(852 vs 1,040 truck-days) but overflows; `demand_driven` eliminates
overflow (max fill exactly the 80 % trigger) yet **costs more** — its
emptyings cluster onto shared peak days (rate-synchronised series come due
together), so peak days need more trucks despite fewer total emptyings;
`day_spread` keeps demand-driven timing but spreads due work across days,
making it cheapest of the three **and** overflow-free — **−90,500 EUR
(−34.6 %, derived) vs the observed baseline with better service**.
Annualisation bases differ by contract (§5.2.6): strategy per-year figures
use the 200 operating days × window ratio, the baseline's per-year figure
is the ×365/349 calendar extrapolation [predicted] — compare same-window
totals, never the per-year columns against each other.

### 8.1 Observed-schedule baseline and truck estimate (§4.8, M17)

The status quo is **not** a simulated cycle — it is the observed emptying
history counted (`docs/schedule_profile.md`): 11,701 visits over 349 days,
229 of them active (120 zero-visit days are never service days). Each
active day is priced through the flat-mode time model: per-truck overhead
means the day's truck count is the smallest integer `t` satisfying
`visits × 5 min + (visits + 2t) × 10 min + t × 30 min ≤ t × 480 min`
— with the §4.6 defaults this closes to **`t = ⌈15·visits/430⌉`**
(deterministic arithmetic, no solver, no RNG). Result [observed ×
representative time model]: **523 truck-days → 261,500 EUR** (× the
[representative] 500 EUR/truck-day); **median 2 / peak 5 trucks** per
active day — a range, never a claimed fleet size (the real fleet is
unknown, Q1; the 3 × `demo_truck` solver input stays a separate labelled
demo assumption); **0 capacity-infeasible days** (surfaced per §4.8, never
coerced). Per-year: 273,488.54 EUR [predicted — ×365/349 extrapolation].

### 8.2 Day-spreading scheduler (§4.8, M17)

The plan strategy replays the §5.2.5 simulation core (rates §2.3; clock =
latest record ≤ start; fill resets to 0 after each emptying) with these
rules [predicted — simulation on observed rates]:

- **Trigger**: a series is due on day d when projected fill (fill 0 + rate
  × days since last emptying) ≥ `select_threshold_pct` (80 [demo
  assumption §3.1]).
- **Daily capacity**: `stops_per_truck_day = floor((480 − 2×10 − 30)/15)`
  = **28** stops (shift minus depot/disposal legs, divided by service +
  travel).
- **Selection under capacity**: serve due series by projected fill
  descending (ties: rate descending, then key — deterministic). Overflowing
  capacity defers the least-urgent due series, **except** series whose
  next-day projected fill would exceed 100 % — they are served the same day
  and may raise that day's truck count. Overflow is never accepted;
  deferrals are counted and surfaced (29,401 deferrals, longest wait 29
  days), never silent drops.
- **Counting**: `trucks_used(d) = ceil(stops_served(d)/28)`; truck-days =
  Σ over days; cost = truck-days × [representative] rate. Planning staffing
  is unbounded (per-truck-day cost model); the 3 × `demo_truck` demo cap
  does not apply here.

Live result (2026-11-15): 9,237 stops, **342 truck-days → 171,000 EUR**,
peak 1 truck/day, typical 1.0, overflow 0.0 %, max fill 88.9 % — the
money story of slide 5. Pure function of dataset + config (no solver, no
RNG); the baseline column is the same arithmetic applied to the observed
schedule.

`POST /api/simulation` returns the daily replay for the timeline visual
(basis: records observed, rates derived, plan simulated). **Replay
initialisation (§5.2.5 addendum)**: each series' simulated clock starts at
its **latest record ≤ `start_date`** (past-only, leakage-safe); a series
with no record ≤ `start_date` starts at `start_date` with fill 0. The
globally-latest record must NOT seed the clock — it lies at/near the window
end and would deaden the early replay (observed before the fix: 4 dead
months, status-quo cost understated ~15×). `simulate_strategy` takes the
pre-window dates as an explicit `prior_emptying_dates` mapping; a mapped
date after `start_date` is a `SimulationConfigError` — honest failure,
never a silent clamp.

Model consequence [observed live run, labelled on every timeline]: the
1,303 series with a pre-window record all seed on the same day, so
`fixed_frequency` synchronises onto ~12 "mega-days" of ~1,303 emptyings
(peak 2025-11-14) — a replay artefact of the initialisation rule, not
observed behaviour. Calibration echo (§5.2.5): simulated fill-at-emptying
median 42.5 % vs observed 60.0 %. Deterministic; no seasonality/holiday
multipliers (rejected — `docs/partner_prototype_review.md` elements 4/6).

## 9. Days-to-full companion estimate (contracts §5.2.3 v2, §1.5 semantics)

`GET /api/days-to-full` answers the representative's reporting wish
("average days-to-full per container") [predicted], method
`fill_at_emptying_rate`, from emptying records only (§1.5: one row = one
emptying event [representative-stated]). Per series: `rate_pct_per_day` is
the median over records `r_i` (i ≥ 2) with `interval_days = date_i −
date_{i−1} > 0` and numeric `fill_i` of `fill_i / interval_days` — **never
Δfill/Δdays** between records (fill increases are not accumulation
velocity); `days_to_full = target_pct / rate` (target 90 % [demo assumption
— slide mockup], parameter 1..100), assuming the container **refills from
0 after each emptying** [model assumption]; `predicted_full_date = last
emptying date + round(days_to_full)` — never clamped (may be overdue).
Records at numeric 100 or `overfull` are **censored lower bounds** (§1.5):
they never enter the numeric median but set `is_lower_bound` (true demand ≥
estimate). Reasons — no estimate ever fabricated: `not_enough_records`
(< 2 records), `zero_interval_only`, `no_numeric_fill`, `zero_rate` (rate
exactly 0; contract addendum 2026-11-14).

Demo run on the real CSV (target 90): 1,338 series, **1,303 with an
estimate**; median **59.3 d**, mean 101.7 d, min 6.6, max 2,313.0;
`lower_bound_share_pct` **66.5** [predicted]. Per material (median days /
estimates / lower-bound share): brown **121.95** / 422 / 36.3 %; green
**52.0** / 439 / 73.6 %; white **38.05** / 442 / 88.5 % — white/green
containers need emptying far sooner and are far more often censored
[observed pattern §1.5/profile §15]. Caveats echoed in `assumptions`: the
mandatory §1.5 caveat (*"fill at emptying shows how full the container was
when the schedule reached it — not how fast it would have filled"*), rates
assume no unobserved emptyings between records, and the median emptying
interval is 28 d [observed] — indicative, not a schedule. The same rows
power the per-container interval view and the §8 scenario engine.
