# Demo numbers — comparison + scenario engine + observed baseline (v5)

v3 parameter change (2026-11-14), superseded in v4 only by the density source and the new fixed-frequency scenario: the comparison runs on the §4.6 v3 representative parameters — container_volume_litres=3000 [representative], stop_service_minutes=5 [representative], travel_time_mode=fixed_per_leg with fixed_travel_minutes=10 on every leg [representative + interpretation], cost_per_truck_day_eur=500, operating_days_per_week=5, operating_days_per_year=200 [representative] — alongside the unchanged [demo assumption] values (vehicle 12,000 L / 10,000 kg x 3; densities 0.40 kg/litre — [literature] German AVV table AVV 20 01 02 (entsorgen-versorgen.de, retrieved 2026-11-14); disposal unload 30 min, shift 480 min, geography knobs, solver budget). All numbers below supersede the v2 demo numbers, which remain recorded in docs/PROGRESS.md (M12/M13 history) only. v5 (M17, 2026-11-15): the observed emptying schedule itself becomes the status-quo baseline (§4.8) and the `day_spread` strategy joins the scenario engine (§5.2.6) — both in the live-appended sections below. Cost figures are [predicted] derivations, never invoiced amounts (§4.4).

Reproducing command: `python -m src.api.compare_demo` (writes `docs/demo_numbers.md`; optional overrides `--data PATH --output PATH --as-of YYYY-MM-DD --horizon N`)

> **Regeneration warning:** the CLI regenerates the comparison/scenario tables but still writes the stale v3-era title ("# Demo numbers — naive sweep vs optimised comparison (M15 v3)") and omits the v5 header note — regenerating therefore overwrites these two hand-maintained parts. After every regeneration, re-apply: (1) the document title `# Demo numbers — comparison + scenario engine + observed baseline (v5)`; (2) the v5 header note — the paragraph below beginning "v3 parameter change (2026-11-14)…", including its v5 (M17) sentences on the observed baseline (§4.8) and the `day_spread` strategy (§5.2.6). The live-appended sections additionally need re-adding — see the note under "Notes".

Dataset: `data/raw/glass_fill_levels_anonymized_f.csv` [observed] — 11701 rows, 449 locations, 1338 series, 2025-10-17..2026-09-30. Raw file immutable (AGENTS rule 4).

Prediction: as_of 2026-09-30, horizon_days 28 [demo assumption — the brief defines no horizon; the default is the observed median reading gap], method persistence (contract §2.3).

Distance provenance for ALL scenarios: haversine_straight_line_derived — great-circle haversine x detour factor (§4.6) [demo assumption]; never "road distance" — no road network data exists [observed]. Synthetic stop coordinates derive from SHA-256 of series keys; the depot and disposal site are synthetic fixtures near Heilbronn.

Naive visiting order (both sweep scenarios): §4.7 area sweep — grid cells of SWEEP_CELL_SIZE_DEG=0.01° (~1 km [demo assumption]), row-major (lat band ascending, then lon ascending), lexicographic (location_id, material_type) within a cell [demo assumption — the data has no area field, so the order is not geographic].

## Scenario 1 — naive_fixed_frequency (§4.7 v4 status quo: series due under the fixed frequency_days cycle, area-sweep order)

| metric | value |
|---|---|
| status | incomplete |
| total distance_m | 355474 (haversine_straight_line_derived) |
| total duration_min | 1410 |
| stops visited | 60 / 637 |
| vehicles available | 3 x demo_truck [demo assumption §4.6] |
| vehicles used | 3 |
| travel_time_mode | fixed_per_leg (§4.6 v3) |
| collected volume litres | 84900 |
| collected weight kg | 33960 |
| unserved stops | 577 (each with a reason in the solution) |
| fleet recommendation | 183 x demo_truck (ceil_by_volume 183, ceil_by_weight 88) |
| distance per stop served (m) | 5924.6 |
| distance per collected kg (m) | 10.5 |
| cost EUR/day | 1,500 (3 x 500 EUR/truck-day [representative]; [predicted] derived, never invoiced — §4.3/§4.4) |
| cost EUR/year | 300,000 (x 200 operating days/year [representative]) |

Observed service anchor (§4.7 status quo): 26.9 % of emptying records full or overfull (numeric >= 100 or overfull token over all 11701 records) [observed §1.5]; max observed numeric fill: 100.0 %.

Stops with no persistence value at as_of: 4 of 637 — still visited, collect 0 L / 0 kg [demo assumption labelling; contract §2.3: no number is fabricated].

Shift overruns reported (contract §4.4): 2

## Scenario 2 — naive_sweep_all (ALL series, no policy filter, naive area-sweep order)

| metric | value |
|---|---|
| status | incomplete |
| total distance_m | 454623 (haversine_straight_line_derived) |
| total duration_min | 1420 |
| stops visited | 50 / 1338 |
| vehicles available | 3 x demo_truck [demo assumption §4.6] |
| vehicles used | 3 |
| travel_time_mode | fixed_per_leg (§4.6 v3) |
| collected volume litres | 90300 |
| collected weight kg | 36120 |
| unserved stops | 1288 (each with a reason in the solution) |
| fleet recommendation | 183 x demo_truck (ceil_by_volume 183, ceil_by_weight 88) |
| distance per stop served (m) | 9092.5 |
| distance per collected kg (m) | 12.6 |
| cost EUR/day | 1,500 (3 x 500 EUR/truck-day [representative]; [predicted] derived, never invoiced — §4.3/§4.4) |
| cost EUR/year | 300,000 (x 200 operating days/year [representative]) |

Stops with no persistence value at as_of: 4 of 1338 — still visited, collect 0 L / 0 kg [demo assumption labelling; contract §2.3: no number is fabricated].

Shift overruns reported (contract §4.4): 0

## Scenario 3 — naive_sweep_selected (policy-selected series only, same area-sweep order)

| metric | value |
|---|---|
| status | incomplete |
| total distance_m | 527021 (haversine_straight_line_derived) |
| total duration_min | 1400 |
| stops visited | 38 / 458 |
| vehicles available | 3 x demo_truck [demo assumption §4.6] |
| vehicles used | 3 |
| travel_time_mode | fixed_per_leg (§4.6 v3) |
| collected volume litres | 99900 |
| collected weight kg | 39960 |
| unserved stops | 420 (each with a reason in the solution) |
| fleet recommendation | 99 x demo_truck (ceil_by_volume 99, ceil_by_weight 48) |
| distance per stop served (m) | 13869.0 |
| distance per collected kg (m) | 13.2 |
| cost EUR/day | 1,500 (3 x 500 EUR/truck-day [representative]; [predicted] derived, never invoiced — §4.3/§4.4) |
| cost EUR/year | 300,000 (x 200 operating days/year [representative]) |

Stops with no persistence value at as_of: 0 of 458 — still visited, collect 0 L / 0 kg [demo assumption labelling; contract §2.3: no number is fabricated].

Shift overruns reported (contract §4.4): 0

## Scenario 4 — ortools (OR-Tools CVRP, `src.routing.solver.solve`)

| metric | value |
|---|---|
| status | feasible |
| total distance_m | 70175 (haversine_straight_line_derived) |
| total duration_min | 580 |
| stops visited | 34 / 458 |
| vehicles available | 3 x demo_truck [demo assumption §4.6] |
| vehicles used | 3 |
| travel_time_mode | fixed_per_leg (§4.6 v3) |
| collected volume litres | 45000 |
| collected weight kg | 18000 |
| unserved stops | 424 (each with a reason in the solution) |
| fleet recommendation | 99 x demo_truck (ceil_by_volume 99, ceil_by_weight 48) |
| distance per stop served (m) | 2064.0 |
| distance per collected kg (m) | 3.9 |
| cost EUR/day | 1,500 (3 x 500 EUR/truck-day [representative]; [predicted] derived, never invoiced — §4.3/§4.4) |
| cost EUR/year | 300,000 (x 200 operating days/year [representative]) |

Selection (policy §3, default config): 458 selected / 880 skipped — the ortools and naive_sweep_selected scenarios route only selected candidates; naive_sweep_all visits all 1338 series.

## Gains (derived, metres — contract §4.7)

- selection_gain_m (naive_sweep_all - naive_sweep_selected): -72398
- routing_gain_m (naive_sweep_selected - ortools median): 456846
- total_gain_m: 384448

Different served-stop counts across scenarios are inherent — normalise with the per-stop/per-kg metrics in the tables above; never claim like-for-like distance (§4.7).

## Fleet budget (ortools recommendation x §4.6 v3 cost rates)

- fleet_budget: 99 x demo_truck — 49,500 EUR/day (99 x 500 EUR/truck-day [representative]), 9,900,000 EUR/year (x 200 operating days/year [representative]). Covers full demand incl. unserved stops (§4.4); [predicted] derived, never invoiced amounts (§4.4).

## Optimised determinism (§4.7 repetition protocol, 5 solves)

- runs: 5
- mode: identical (min == max — deterministic solution-budget stop, §4.4)
- distance_m min / median / max: 70175 / 70175 / 70175

## Assumptions (each labelled [demo assumption])

- [demo assumption] forecast horizon_days=28 (brief defines no horizon; default is the observed median reading gap)
- [demo assumption] synthetic stop coordinates derived from SHA-256 of series keys — no real coordinates exist in the data; distances are haversine_straight_line_derived, not road distance
- [demo assumption] synthetic depot 'demo_depot' and disposal site 'demo_disposal_1' near Heilbronn
- [representative] container_volume_litres=3000
- [literature] German AVV table AVV 20 01 02 (entsorgen-versorgen.de, retrieved 2026-11-14) densities_kg_per_litre=brown=0.4, green=0.4, white=0.4 kg/litre
- [demo assumption] vehicle 'demo_truck': 12000 L / 10000 kg x 3 available
- [representative] stop_service_minutes=5, [demo assumption] disposal_service_minutes=30
- [representative] max_shift_minutes=480
- [representative] travel_time_mode=fixed_per_leg, fixed_travel_minutes=10 on every leg incl. depot/disposal [interpretation — open question]
- [representative] cost_per_truck_day_eur=500, operating_days_per_week=5, operating_days_per_year=200 (cost figures derived from them are [predicted], never invoiced amounts)
- [demo assumption] geography_seed=0, geography_spread_km=6 km (synthetic-layout sensitivity knobs; defaults reproduce the current coordinates)
- [demo assumption] solver_solution_limit=200 (primary stopping criterion, deterministic; §4.7)
- [demo assumption] containers_per_series=1 (multiplies litres collected and stop service minutes; the predicted fill % is the series aggregate and does NOT change — Q11), frequency_days=28 (fixed-collection-cycle length, §4.7/§5.2.4; real schedule unknown [open question Q10])
- [demo assumption] solver_time_limit_s=30.0 (safety cap only; fires ⇒ status timeout, run not reproducible; §4.7)
- [demo assumption] naive_fixed_frequency status quo: a series is due iff as_of - last_emptying_date >= frequency_days (no last date ⇒ due; §4.6 default 28 d); 637 of the dataset series were due at as_of — the real schedule is unknown [open question Q10]
- [demo assumption] naive visiting order is the §4.7 area sweep: grid cells of SWEEP_CELL_SIZE_DEG=0.01° (~1 km), row-major, lexicographic within a cell — the data has no area field
- [demo assumption] naive zero-fill rule: series without a persistence value at as_of are still visited and collect 0 L / 0 kg
- Optimised scenario: OR-Tools stops on a fixed solution budget (solver_solution_limit) — repeated solves that reach the budget return identical totals.distance_m (contract §4.4/§4.7). The wall-clock solver_time_limit_s is a safety cap only: a run it stops before the budget is reported with status timeout and is explicitly not reproducible. The naive simulations are fully deterministic.

## Notes

- Optimised scenario: OR-Tools stops on a fixed solution budget (solver_solution_limit) — repeated solves that reach the budget return identical totals.distance_m (contract §4.4/§4.7). The wall-clock solver_time_limit_s is a safety cap only: a run it stops before the budget is reported with status timeout and is explicitly not reproducible. The naive simulations are fully deterministic.
- Unserved stops are never silently dropped (contract §4.4); the generated solution objects carry a deterministic reason per stop.
- This section below is appended from the live API (the CLI writes only the comparison above) — after a CLI regeneration, re-add it from the same curls.

## Scenario engine (§5.2.4/§5.2.6 — cost AND service level, always together)

Values from a live run on the same demo dataset and defaults (2026-11-15): `curl -X POST localhost:8050/api/scenarios -d '{}'`. Three strategies replay the observed window (2025-10-17..2026-09-30, 349 days) on per-series fill-at-emptying rates (§5.2.3 [predicted]) under §4.6 physics with flat 10-min legs (§4.4 — visiting order cannot change duration, so no solver runs here), density 0.40 kg/litre [literature AVV 20 01 02], 500 EUR/truck-day [representative]. Deterministic.

| strategy | emptyings (stops) | truck-days | cost total [predicted] | cost/year [predicted] | overflow share (container-days) | simulated emptyings full/overfull | max fill |
|---|---|---|---|---|---|---|---|
| `fixed_frequency` (every frequency_days=28 [demo assumption — real schedule unknown, Q10]) | 15,636 | 852 | 426,000 EUR | 244,126.07 EUR | 2.4 % | 14.4 % | 366.4 % |
| `demand_driven` (predicted fill ≥ select_threshold_pct=80 [demo assumption §3.1]) | 9,993 | 1,040 | 520,000 EUR | 297,994.27 EUR | 0.0 % | 0.0 % | 80.0 % |
| `day_spread` (§4.8 scheduler: empty when projected fill ≥ 80 %, capacity-capped at 28 stops/truck-day, least-urgent due series deferred — never overflowed) | 9,237 | 342 | 171,000 EUR | 97,994.27 EUR | 0.0 % | 0.0 % | 88.9 % |

`day_spread` scheduler echoes (§5.2.6): peak 1 truck/day, typical 1.0 trucks/active day, `stops_per_truck_day` 28 = floor((480 − 2×10 − 30)/(5+10)) from the §4.6 values, 29,401 capacity deferrals with a longest wait of 29 days — deferral is surfaced, never a silent drop, and overflow is never accepted. [predicted — simulation on observed rates]

Observed service anchor (§4.7/§5.2.4) [observed]: 26.9 % of emptying records full or overfull (numeric ≥ 100 or the overfull token over all 11,701 records); max observed numeric fill 100.0 % — the reference all strategies are judged against.

Reading the table (§6 honesty rule — cost is never shown without its service column): `fixed_frequency` is cheaper than `demand_driven` (852 vs 1,040 truck-days) but serves worse — 2.4 % of container-days overflow (10,812 overflow container-days in the replay) and one in seven simulated emptyings at/overfull; `demand_driven` eliminates overflow (max fill exactly the 80 % trigger) yet **costs more** because its emptyings cluster onto rate-synchronised peak days. `day_spread` keeps demand-driven timing but spreads the due work across days (deferrals instead of peak truck counts), so it is the cheapest of the three **and** overflow-free by construction — the due trigger plus the same-day guard never accept a state above 100 % (§4.8), with the 88.9 % max fill as the emergent closeness measure — the only strategy that beats the fixed cycle on both axes.

## Observed baseline — the status quo in money terms (§5.2.6/§4.8, M17)

Same live run, `observed_baseline` block: the **observed emptying schedule itself** (`docs/schedule_profile.md`, [observed]) put through the §4.8 truck-day arithmetic — no assumed cycle, no simulation.

| metric | value |
|---|---|
| basis | `observed_emptying_records` [observed × representative time model] |
| active days / calendar days | 229 / 349 (120 zero-visit days are never counted as service days) |
| visits (emptying records) | 11,701 |
| truck-days | 523 |
| cost total | 261,500 EUR (523 × 500 EUR/truck-day [representative]) |
| cost per year | 273,488.54 EUR [predicted — ×365/349 calendar extrapolation] |
| trucks per active day | median 2, peak 5 — a range, **not** a claimed fleet size (real fleet unknown, Q1) |
| capacity-infeasible days | 0 (surfaced per §4.8, never coerced) |

Per-truck arithmetic (§4.8, flat mode, per active day): with the §4.6 defaults — 5 min service, 10 min travel on every leg, 30 min disposal per truck, 480 min shift — the inequality `15·visits + 50·t ≤ 480·t` closes to `t = ⌈15·visits/430⌉`; truck-days = Σ t over the 229 active days. [observed visit counts × representative time model]

**Honest reading — the money story (§6)**: the `day_spread` plan costs **171,000 EUR vs the observed schedule's 261,500 EUR over the same window — −90,500 EUR ≈ −35 % (derived from this live run: −34.6 %)** — **with better service, not worse**: the plan's overflow share is 0.0 % of container-days and 0.0 % of simulated emptyings at/overfull — by construction, since the due trigger plus the same-day guard never accept a state above 100 % (§4.8); the emergent closeness measure is max fill 88.9 % — while the observed schedule's own service level is the anchor — 26.9 % of emptying records full or overfull [observed]. The saving comes from spreading work across days (plan peak 1 truck/day vs observed peak 5) and emptying before containers reach full, instead of paying for peak-day staffing on a schedule that still lets one in four records reach full/overfull. Annualisation bases differ by contract (§5.2.6): strategy `cost_eur_per_year` uses the 200 operating days × window ratio, the baseline's `cost_eur_per_year_predicted` uses ×365/349 — compare the same-window totals above, never the two per-year columns against each other.

## Simulation replay (§5.2.5) and the replay-initialisation rule

`curl -X POST localhost:8050/api/simulation -d '{}'` (re-verified live 2026-11-15, same defaults): start 2025-10-17, end 2026-09-30; data basis records=observed, rates=derived, plan=simulated; totals reconcile with the scenario table above (fixed_frequency 15,636 emptyings / 852 truck-days / 426,000 EUR final cumulative cost; demand_driven 9,993 / 1,040 / 520,000 EUR; the timeline covers the two §5.2.4 replay strategies — `day_spread` and the observed baseline are scenario-engine outputs, §5.2.6).
