# Routing methodology (M13, refreshed for v3 parameters, M15)

How routes are produced: inputs, distance/travel-time provenance,
constraints, the solver setup, unserved handling, fleet sizing + cost, the
comparison design, and the days-to-full companion estimate.
Authority: `docs/contracts.md` §4 (esp. §4.2–§4.7) and §5. Comparison demo
numbers marked `docs/demo_numbers.md` come from the generated v3 run of
`.venv/bin/python -m src.api.compare_demo` (2026-11-14) on the demo dataset
(as_of 2026-09-30, horizon 28).

Status legend: **[observed]** = verified in the challenge data ·
**[predicted]** = model/solver output · **[representative]** = supplied
verbally by the challenge representative (14 Nov 2026) ·
**[demo assumption]** = labelled synthetic value, not from data. Inputs
still awaited from the host: `docs/open_questions.md` (Q1–Q8).

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

## 2. Demo physics (§4.6 v3, per-request overridable, per-field source labels)

| value | default | source |
|---|---|---|
| container volume | 3,000 L (3 m³) | [representative] |
| density | 0.5 kg/L uniform (brown/green/white) | [demo assumption, Q2] |
| vehicle | `demo_truck`: 12,000 L / 10,000 kg, 3 available | [demo assumption, Q1] |
| compartments | equal thirds: 4,000 L per material (sum = vehicle volume) | [demo assumption, Q3] |
| stop service time | 5 min | [representative] (per container — Q5 open) |
| disposal service time | 30 min | [demo assumption, Q8] |
| shift | 480 min (8 h) | [representative] |
| travel time | `fixed_per_leg`: 10 min every leg incl. depot/disposal | [representative + interpretation, Q4] |
| cost parameters | 500 EUR/truck-day, 5 days/week, 200 days/year | [representative]; derived EUR amounts [predicted] |
| geography knobs | seed 0 (= current SHA-256 layout), spread 6 km | [demo assumption knobs] |
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
45,000 L / 22,500 kg, cost 1,500 EUR/day [predicted]. An interactive
`POST /api/route` under the same defaults returns the same status and
invariants; served counts may differ within the solver protocol (§4.4).

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
(basis 99 by volume, 60 by weight). The implied **fleet budget** [predicted]
is 99 × 500 EUR = 49,500 EUR/day, × 200 operating days = 9,900,000
EUR/year — a derivation from the [representative] cost parameters, never
an invoiced amount.

## 7. Comparison design (v2/v3, contracts §4.7)

Three scenarios isolate where improvement comes from; all share the §4.6
v3 physics and the naive simulation semantics (`src/routing/naive.py`):
capacities, nearest-disposal unload, shift rules, fleet exhaustion,
per-stop unserved reasons. Numbers: `docs/demo_numbers.md` (v3 run).

| scenario | stops visited | order | isolates |
|---|---|---|---|
| `naive_sweep_all` | all 1,338 series (no selection) | area sweep | status quo |
| `naive_sweep_selected` | 458 policy-selected only | same area sweep | selection reference |
| `ortools` | 458 policy-selected only | OR-Tools | routing gain |

- **Area sweep order** [demo assumption]: the data has no area field
  [observed], so synthetic coordinates are bucketed into 0.01° grid cells
  (≈1 km), visited row-major; within a cell, lexicographic
  `(location_id, material_type)`.
- **Results**: sweep_all 454,623 m (50/1,338 served, 10.1 m/kg);
  sweep_selected 527,021 m (38/458, 10.6 m/kg); ortools 70,175 m
  (34/458, 3.1 m/kg). Each scenario costs 1,500 EUR/day / 300,000
  EUR/year [predicted] (3 trucks used × [representative] rates).
- **Gains** (derived, metres): selection = sweep_all − sweep_selected =
  **−72,398**; routing = sweep_selected − ortools = **+456,846**; total =
  **+384,448**. The negative selection gain (fewer stops under the same
  inefficient order) is reported honestly; served counts differ by design,
  so like-for-like judgement uses the per-stop/per-kg metrics
  (10.1 → 10.6 → 3.1 m/kg), never raw distance.
- **Repetition protocol** (optimised only): 5 solves [demo assumption];
  mode `identical` (min = max) or `median_of_runs` with min/median/max.
  The **median is the value used in the UI and docs**. Demo: identical ×5,
  70,175 m each.

Reproduce all numbers: `.venv/bin/python -m src.api.compare_demo` (writes
`docs/demo_numbers.md`) or run the app per `docs/user_guide.md` §2.

## 8. Days-to-full companion estimate (contracts §5.2.3, v3)

`GET /api/days-to-full` answers the representative's reporting wish
("average days-to-full per container") [predicted], from fill history
only. Method `median_positive_pair_rate`: per series, the rate is the
median over consecutive numeric reading pairs with a positive delta of
Δfill / Δdays — drops are probable emptyings [observed: no collection
events in the data] and are excluded, never treated as negative
accumulation; then `days_to_full = max(0, (100 − last numeric fill) /
rate)`. `already_full` (numeric 100 or `overfull`) reports 0.0 exactly;
`no_numeric_history` (< 2 numeric readings) and `no_positive_rate` get a
reason instead of a fabricated number. Demo run on the real CSV: 1,213 /
1,338 series with an estimate, median 48.3 d, mean 113.0 d, min 0,
max 2,120 d [predicted]. Caveats echoed in `assumptions`: the median
reading gap is 28 d [observed], and the estimate assumes a constant fill
rate with no emptying between readings — indicative, not a schedule.
