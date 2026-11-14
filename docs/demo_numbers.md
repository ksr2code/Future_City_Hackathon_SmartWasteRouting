# Demo numbers — naive sweep vs optimised comparison (M15 v3)

v3 parameter change (2026-11-14): the comparison now runs on the §4.6 v3 representative parameters — container_volume_litres=3000 [representative], stop_service_minutes=5 [representative], travel_time_mode=fixed_per_leg with fixed_travel_minutes=10 on every leg [representative + interpretation], cost_per_truck_day_eur=500, operating_days_per_week=5, operating_days_per_year=200 [representative] — alongside the unchanged [demo assumption] values (vehicle 12,000 L / 10,000 kg x 3, densities 0.5 kg/litre, disposal unload 30 min, shift 480 min, geography knobs, solver budget). All numbers below supersede the v2 demo numbers, which remain recorded in docs/PROGRESS.md (M12/M13 history) only. Cost figures are [predicted] derivations, never invoiced amounts (§4.4).

Reproducing command: `python -m src.api.compare_demo` (writes `docs/demo_numbers.md`; optional overrides `--data PATH --output PATH --as-of YYYY-MM-DD --horizon N`)

Dataset: `data/raw/glass_fill_levels_anonymized_f.csv` [observed] — 11701 rows, 449 locations, 1338 series, 2025-10-17..2026-09-30. Raw file immutable (AGENTS rule 4).

Prediction: as_of 2026-09-30, horizon_days 28 [demo assumption — the brief defines no horizon; the default is the observed median reading gap], method persistence (contract §2.3).

Distance provenance for ALL scenarios: haversine_straight_line_derived — great-circle haversine x detour factor (§4.6) [demo assumption]; never "road distance" — no road network data exists [observed]. Synthetic stop coordinates derive from SHA-256 of series keys; the depot and disposal site are synthetic fixtures near Heilbronn.

Naive visiting order (both sweep scenarios): §4.7 area sweep — grid cells of SWEEP_CELL_SIZE_DEG=0.01° (~1 km [demo assumption]), row-major (lat band ascending, then lon ascending), lexicographic (location_id, material_type) within a cell [demo assumption — the data has no area field, so the order is not geographic].

## Scenario 1 — naive_sweep_all (ALL series, no policy filter, naive area-sweep order)

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
| collected weight kg | 45150 |
| unserved stops | 1288 (each with a reason in the solution) |
| fleet recommendation | 183 x demo_truck (ceil_by_volume 183, ceil_by_weight 110) |
| distance per stop served (m) | 9092.5 |
| distance per collected kg (m) | 10.1 |
| cost EUR/day | 1,500 (3 x 500 EUR/truck-day [representative]; [predicted] derived, never invoiced — §4.3/§4.4) |
| cost EUR/year | 300,000 (x 200 operating days/year [representative]) |

Stops with no persistence value at as_of: 4 of 1338 — still visited, collect 0 L / 0 kg [demo assumption labelling; contract §2.3: no number is fabricated].

Shift overruns reported (contract §4.4): 0

## Scenario 2 — naive_sweep_selected (policy-selected series only, same area-sweep order)

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
| collected weight kg | 49950 |
| unserved stops | 420 (each with a reason in the solution) |
| fleet recommendation | 99 x demo_truck (ceil_by_volume 99, ceil_by_weight 60) |
| distance per stop served (m) | 13869.0 |
| distance per collected kg (m) | 10.6 |
| cost EUR/day | 1,500 (3 x 500 EUR/truck-day [representative]; [predicted] derived, never invoiced — §4.3/§4.4) |
| cost EUR/year | 300,000 (x 200 operating days/year [representative]) |

Stops with no persistence value at as_of: 0 of 458 — still visited, collect 0 L / 0 kg [demo assumption labelling; contract §2.3: no number is fabricated].

Shift overruns reported (contract §4.4): 0

## Scenario 3 — ortools (OR-Tools CVRP, `src.routing.solver.solve`)

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
| collected weight kg | 22500 |
| unserved stops | 424 (each with a reason in the solution) |
| fleet recommendation | 99 x demo_truck (ceil_by_volume 99, ceil_by_weight 60) |
| distance per stop served (m) | 2064.0 |
| distance per collected kg (m) | 3.1 |
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
- [demo assumption] densities_kg_per_litre=brown=0.5, green=0.5, white=0.5 kg/litre
- [demo assumption] vehicle 'demo_truck': 12000 L / 10000 kg x 3 available
- [representative] stop_service_minutes=5, [demo assumption] disposal_service_minutes=30
- [representative] max_shift_minutes=480
- [representative] travel_time_mode=fixed_per_leg, fixed_travel_minutes=10 on every leg incl. depot/disposal [interpretation — open question]
- [representative] cost_per_truck_day_eur=500, operating_days_per_week=5, operating_days_per_year=200 (cost figures derived from them are [predicted], never invoiced amounts)
- [demo assumption] geography_seed=0, geography_spread_km=6 km (synthetic-layout sensitivity knobs; defaults reproduce the current coordinates)
- [demo assumption] solver_solution_limit=200 (primary stopping criterion, deterministic; §4.7)
- [demo assumption] solver_time_limit_s=30.0 (safety cap only; fires ⇒ status timeout, run not reproducible; §4.7)
- [demo assumption] naive visiting order is the §4.7 area sweep: grid cells of SWEEP_CELL_SIZE_DEG=0.01° (~1 km), row-major, lexicographic within a cell — the data has no area field
- [demo assumption] naive zero-fill rule: series without a persistence value at as_of are still visited and collect 0 L / 0 kg
- Optimised scenario: OR-Tools stops on a fixed solution budget (solver_solution_limit) — repeated solves that reach the budget return identical totals.distance_m (contract §4.4/§4.7). The wall-clock solver_time_limit_s is a safety cap only: a run it stops before the budget is reported with status timeout and is explicitly not reproducible. The naive simulations are fully deterministic.

## Notes

- Optimised scenario: OR-Tools stops on a fixed solution budget (solver_solution_limit) — repeated solves that reach the budget return identical totals.distance_m (contract §4.4/§4.7). The wall-clock solver_time_limit_s is a safety cap only: a run it stops before the budget is reported with status timeout and is explicitly not reproducible. The naive simulations are fully deterministic.
- Unserved stops are never silently dropped (contract §4.4); the generated solution objects carry a deterministic reason per stop.
