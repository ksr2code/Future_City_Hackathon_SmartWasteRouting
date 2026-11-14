/**
 * Shared vitest fixtures — synthetic demo payloads mirroring docs/contracts.md
 * §5.2 shapes. Labelled synthetic; never mistaken for observed data.
 */
import type {
  ComparisonResponse,
  ComparisonScenario,
  ConfigDefaults,
  DaysToFullResponse,
  DatasetSummary,
  RouteResponse,
  SelectionResponse,
  SeriesStatus,
} from "../lib/api";

export const summaryFixture: DatasetSummary = {
  n_rows: 11701,
  n_locations: 449,
  n_series: 1338,
  date_min: "2025-01-01",
  date_max: "2026-10-31",
  rows_per_material: { brown: 3901, green: 3900, white: 3900 },
  n_errors: 0,
  n_warnings: 0,
  source_name: "glass_fill_levels_anonymized_f.csv",
};

/**
 * §5.2.2 fill_stats variant — synthetic values (no collection events in the
 * data; "full or above" means readings at/above the 80 % threshold).
 */
export const summaryWithFillStats: DatasetSummary = {
  ...summaryFixture,
  fill_stats: {
    share_readings_full_or_above_pct: 10.2,
    share_readings_overfull_pct: 10.2,
    share_readings_empty_pct: 0.4,
    threshold_pct: 80,
  },
};

export const containersFixture: SeriesStatus[] = [
  {
    location_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    material_type: "brown",
    n_readings: 26,
    last_date: "2026-10-31",
    last_fill_pct: 60,
    last_is_overfull: false,
  },
  {
    location_id: "ffff1111-2222-3333-4444-555555555555",
    material_type: "green",
    n_readings: 24,
    last_date: "2026-10-30",
    last_fill_pct: null,
    last_is_overfull: true,
  },
];

export const selectionFixture: SelectionResponse = {
  as_of_date: "2026-10-31",
  target_date: "2026-11-28",
  config: { select_threshold_pct: 80, uncertainty_buffer_pct: 0, overfull_always_selected: true },
  selected: [
    {
      location_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      material_type: "brown",
      predicted_fill_pct: 92,
      predicted_state: "full",
      reason_code: "at_or_above_threshold",
      detail: "predicted 92.0 >= threshold 80 + buffer 0",
    },
    {
      location_id: "ffff1111-2222-3333-4444-555555555555",
      material_type: "green",
      predicted_fill_pct: 100,
      predicted_state: "overfull",
      reason_code: "overfull_state",
      detail: "overfull token — state override",
    },
  ],
  skipped: [
    {
      location_id: "11111111-2222-3333-4444-555555555555",
      material_type: "white",
      predicted_fill_pct: 40,
      predicted_state: "normal",
      reason_code: "below_threshold",
      detail: "predicted 40.0 < threshold 80 + buffer 0",
    },
  ],
};

export const routeResponseFixture: RouteResponse = {
  selection: selectionFixture,
  solution: {
    status: "feasible",
    objective_value: 18400,
    routes: [
      {
        vehicle_type_id: "demo_truck",
        sequence: [
          { node_type: "depot", id: "demo_depot", name: "Demo Depot", lat: 49.14, lon: 9.22 },
          {
            node_type: "stop",
            location_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            material_type: "brown",
            lat: 49.15,
            lon: 9.21,
            container_volume_litres: 1900,
            predicted_fill_pct: 92,
            service_minutes: 10,
            point_id: "stop:aaaaaaaa…:brown",
          },
          {
            node_type: "disposal",
            id: "demo_disposal",
            name: "Demo Disposal",
            lat: 49.145,
            lon: 9.215,
            service_minutes: 30,
          },
        ],
        load_progression: [[1200, 600]],
        distance_m: 18400,
        duration_minutes: 95,
      },
    ],
    unserved: [
      {
        // Backend UnservedStopResponse is FLAT (real capture route.json).
        location_id: "11111111-2222-3333-4444-555555555555",
        material_type: "white",
        reason: "minimum round trip exceeds max_shift_minutes",
      },
    ],
    totals: {
      distance_m: 18400,
      duration_min: 95,
      collected_volume_litres: 1200,
      collected_volume_by_material: { brown: 1200, green: 0, white: 0 },
      collected_weight_kg: 600,
      stops_served: 2,
      stops_total: 3,
    },
    fleet_recommendation: {
      vehicle_type_id: "demo_truck",
      count: 1,
      basis: { ceil_by_volume: 1, ceil_by_weight: 1 },
    },
    travel_time_mode: "fixed_per_leg",
    cost: {
      vehicles_used: 1,
      cost_eur_per_day: 500,
      cost_eur_per_year: 100000,
      fleet_cost: { trucks: 1, cost_eur_per_day: 500, cost_eur_per_year: 100000 },
    },
    distance_provenance: "haversine_straight_line_derived",
  },
  assumptions: [
    "Coordinates, depot and disposal sites are synthetic [demo assumption].",
    "Distances are straight-line derived, not road distance [demo assumption].",
  ],
};

export const configFixture: ConfigDefaults = {
  policy: { select_threshold_pct: 80, uncertainty_buffer_pct: 0, overfull_always_selected: true },
  routing: {
    container_volume_litres: 3000,
    densities_kg_per_litre: { brown: 0.5, green: 0.5, white: 0.5 },
    vehicle_volume_capacity_litres: 12000,
    vehicle_weight_capacity_kg: 10000,
    vehicle_count_available: 3,
    vehicle_compartment_volume_litres: null, // absent ⇒ equal thirds (§4.2)
    stop_service_minutes: 5,
    disposal_service_minutes: 30,
    max_shift_minutes: 480,
    travel_time_mode: "fixed_per_leg",
    fixed_travel_minutes: 10,
    cost_per_truck_day_eur: 500,
    operating_days_per_week: 5,
    operating_days_per_year: 200,
    geography_seed: 0,
    geography_spread_km: 6.0,
    avg_speed_kmh: 30,
    detour_factor: 1.4,
    solver_solution_limit: 200,
    solver_time_limit_s: 30.0,
  },
  assumption_fields: [
    "select_threshold_pct",
    "uncertainty_buffer_pct",
    "overfull_always_selected",
    "container_volume_litres",
    "vehicle_volume_capacity_litres",
  ],
  sources: {
    select_threshold_pct: "demo assumption",
    uncertainty_buffer_pct: "demo assumption",
    overfull_always_selected: "demo assumption",
    container_volume_litres: "representative",
    densities_kg_per_litre: "demo assumption",
    vehicle_volume_capacity_litres: "demo assumption",
    vehicle_weight_capacity_kg: "demo assumption",
    vehicle_count_available: "demo assumption",
    vehicle_compartment_volume_litres: "demo assumption",
    stop_service_minutes: "representative",
    disposal_service_minutes: "demo assumption",
    max_shift_minutes: "representative",
    travel_time_mode: "representative",
    fixed_travel_minutes: "representative",
    cost_per_truck_day_eur: "representative",
    operating_days_per_week: "representative",
    operating_days_per_year: "representative",
    geography_seed: "demo assumption",
    geography_spread_km: "demo assumption",
    avg_speed_kmh: "demo assumption",
    detour_factor: "demo assumption",
    solver_solution_limit: "demo assumption",
    solver_time_limit_s: "demo assumption",
    horizon_days: "demo assumption",
  },
};

/**
 * §5.2.2 ComparisonResponse (v2 scenarios + v3 cost fields) — synthetic
 * fixture mirroring the real 2026-11-14 live capture (frontend/src/test/
 * fixtures/real-capture/comparison.json, regenerated for v3): scenarios in
 * the fixed §4.7 order, nullable per-metrics, gains incl. the honestly-
 * negative selection gain, determinism "identical", per-scenario cost block
 * and the fleet budget. Distances are straight-line derived, never road
 * distance.
 */
function scenario(
  method: "naive_sweep_all" | "naive_sweep_selected" | "ortools",
  values: {
    status: string;
    distance_m: number;
    duration_min: number;
    stops_served: number;
    stops_total: number;
    collected_volume_litres: number;
    collected_weight_kg: number;
    unserved_count: number;
    recommended_trucks: number;
    fleet_basis: { ceil_by_volume: number; ceil_by_weight: number };
    distance_per_stop_m: number | null;
    distance_per_kg_m: number | null;
  },
): ComparisonScenario {
  return {
    method,
    ...values,
    vehicles_available: 3,
    vehicles_used: 3,
    travel_time_mode: "fixed_per_leg",
    cost_eur_per_day: 1500, // 3 trucks in use × 500 EUR/truck-day [predicted]
    cost_eur_per_year: 300000, // × 200 operating days/year [predicted]
  };
}

export const comparisonFixture: ComparisonResponse = {
  as_of_date: "2026-09-30",
  target_date: "2026-10-28",
  horizon_days: 28,
  method: "persistence",
  scenarios: [
    scenario("naive_sweep_all", {
      status: "incomplete",
      distance_m: 454623,
      duration_min: 1420,
      stops_served: 50,
      stops_total: 1338,
      collected_volume_litres: 90300,
      collected_weight_kg: 45150,
      unserved_count: 1288,
      recommended_trucks: 183,
      fleet_basis: { ceil_by_volume: 183, ceil_by_weight: 110 },
      distance_per_stop_m: 9092.5,
      distance_per_kg_m: 10.1,
    }),
    scenario("naive_sweep_selected", {
      status: "incomplete",
      distance_m: 527021,
      duration_min: 1400,
      stops_served: 38,
      stops_total: 458,
      collected_volume_litres: 99900,
      collected_weight_kg: 49950,
      unserved_count: 420,
      recommended_trucks: 99,
      fleet_basis: { ceil_by_volume: 99, ceil_by_weight: 60 },
      distance_per_stop_m: 13869.0,
      distance_per_kg_m: 10.6,
    }),
    scenario("ortools", {
      status: "feasible",
      distance_m: 70175,
      duration_min: 580,
      stops_served: 34,
      stops_total: 458,
      collected_volume_litres: 45000,
      collected_weight_kg: 22500,
      unserved_count: 424,
      recommended_trucks: 99,
      fleet_basis: { ceil_by_volume: 99, ceil_by_weight: 60 },
      distance_per_stop_m: 2064.0,
      distance_per_kg_m: 3.1,
    }),
  ],
  gains: {
    selection_gain_m: -72398,
    routing_gain_m: 456846,
    total_gain_m: 384448,
  },
  optimised_determinism: {
    runs: 5,
    mode: "identical",
    distance_m_median: 70175.0,
    distance_m_min: 70175,
    distance_m_max: 70175,
  },
  fleet_budget: {
    vehicle_type_id: "demo_truck",
    trucks: 99,
    cost_eur_per_day: 49500,
    cost_eur_per_year: 9900000,
  },
  distance_provenance: "haversine_straight_line_derived",
  assumptions: [
    "Coordinates, depot and disposal sites are synthetic [demo assumption].",
    "Distances are straight-line derived, not road distance [demo assumption].",
  ],
};

/**
 * Variant for the TechDetails median-of-runs wording (wall-clock solver
 * variance observed): synthetic spread around the observed median.
 */
export const comparisonMedianOfRunsFixture: ComparisonResponse = {
  ...comparisonFixture,
  optimised_determinism: {
    runs: 5,
    mode: "median_of_runs",
    distance_m_median: 70175.0,
    distance_m_min: 69800,
    distance_m_max: 70900,
  },
};

/**
 * §5.2.3 DaysToFullResponse (v3) — synthetic fixture mirroring the observed
 * real-CSV run (docs/PROGRESS.md M15: median 48.3 d, 1,213/1,338 series).
 * All values [predicted] from fill history; caveats are the API's own
 * labelled assumption strings.
 */
export const daysToFullFixture: DaysToFullResponse = {
  method: "median_positive_pair_rate",
  stats: {
    series_total: 1338,
    series_with_estimate: 1213,
    median_days: 48.3,
    mean_days: 113.0,
    min_days: 0,
    max_days: 2120,
  },
  series: [
    {
      location_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      material_type: "brown",
      last_date: "2026-09-30",
      last_fill_pct: 60,
      last_is_overfull: false,
      rate_pct_per_day: 0.83,
      days_to_full: 48.2,
      reason: null,
    },
  ],
  assumptions: [
    "[observed] median reading gap 28 d",
    "[predicted] constant fill rate assumed between readings; decreasing readings (probable emptying events) are excluded from the rate — the data has no collection events",
  ],
};
