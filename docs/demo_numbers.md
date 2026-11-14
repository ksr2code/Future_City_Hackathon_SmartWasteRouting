# Demo numbers — naive fixed-order vs optimised (M12)

Reproducing command: `python -m src.routing.compare_demo` (writes `docs/demo_numbers.md`; optional overrides `--data PATH --output PATH --as-of YYYY-MM-DD --horizon N`)

Dataset: `data/raw/glass_fill_levels_anonymized_f.csv` [observed] — 11701 rows, 449 locations, 1338 series, 2025-10-17..2026-09-30. Raw file immutable (AGENTS rule 4).

Prediction: as_of 2026-09-30, horizon_days 28 [demo assumption — the brief defines no horizon; the default is the observed median reading gap], method persistence (contract §2.3).

Distance provenance for BOTH scenarios: haversine_straight_line_derived — great-circle haversine x detour factor (§4.6) [demo assumption]; never "road distance" — no road network data exists [observed]. Synthetic stop coordinates derive from SHA-256 of series keys; the depot and disposal site are synthetic fixtures near Heilbronn.

## Scenario A — naive fixed order (`naive_fixed_order`, no OR-Tools)

Visiting order: fixed lexicographic (location_id, material_type) [demo assumption — the data has no area field, so the order is not geographic].

| metric | value |
|---|---|
| status | incomplete |
| total distance_m | 400475 (haversine_straight_line_derived) |
| total duration_min | 1414 |
| stops visited | 52 / 1338 |
| vehicles available | 3 x demo_truck [demo assumption §4.6] |
| vehicles used | 3 |
| collected volume litres | 52820 |
| collected weight kg | 26410 |
| unserved stops | 1286 (each with a reason in the solution) |
| fleet recommendation | demo_truck x 116 (ceil_by_volume 116, ceil_by_weight 70) |

Stops with no persistence value at as_of: 4 — still visited, collect 0 L / 0 kg [demo assumption labelling; contract §2.3: no number is fabricated].

Shift overruns reported (contract §4.4): 0

## Scenario B — optimised (OR-Tools CVRP, `src.routing.solver.solve`)

| metric | value |
|---|---|
| status | feasible |
| total distance_m | 69889 (haversine_straight_line_derived) |
| total duration_min | 601 |
| stops visited | 43 / 458 |
| vehicles available | 3 x demo_truck [demo assumption §4.6] |
| vehicles used | 3 |
| collected volume litres | 47880 |
| collected weight kg | 23940 |
| unserved stops | 415 (each with a reason in the solution) |
| fleet recommendation | demo_truck x 63 (ceil_by_volume 63, ceil_by_weight 38) |

Selection (policy §3, default config): 458 selected / 880 skipped — the optimised scenario routes only selected candidates; the naive scenario visits all 1338 series.

## Assumptions (each labelled [demo assumption])

- Naive visiting order is fixed lexicographic (location_id, material_type) — the data has no area field [observed].
- Naive zero-fill rule: series without a persistence value at as_of are still visited and collect 0 L / 0 kg.
- [demo assumption] forecast horizon_days=28 (brief defines no horizon; default is the observed median reading gap)
- [demo assumption] synthetic stop coordinates derived from SHA-256 of series keys — no real coordinates exist in the data; distances are haversine_straight_line_derived, not road distance
- [demo assumption] synthetic depot 'demo_depot' and disposal site 'demo_disposal_1' near Heilbronn
- [demo assumption] container_volume_litres=1900
- [demo assumption] densities_kg_per_litre=brown=0.5, green=0.5, white=0.5 kg/litre
- [demo assumption] vehicle 'demo_truck': 12000 L / 10000 kg x 3 available
- [demo assumption] stop_service_minutes=10, disposal_service_minutes=30
- [demo assumption] max_shift_minutes=480
- [demo assumption] avg_speed_kmh=30.0, detour_factor=1.4 (matrix derivation)
- [demo assumption] solver_time_limit_s=5.0

## Notes

- Optimised totals vary slightly run-to-run: GUIDED LOCAL SEARCH runs under the configured wall-clock solver time limit (contract §4.4 claims determinism as same status + same invariants, not bitwise). The naive simulation is fully deterministic.
- Unserved stops are never silently dropped (contract §4.4); the generated solution objects carry a deterministic reason per stop.
