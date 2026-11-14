/**
 * Typed API client for WasteRouting.AI — shapes hand-written from
 * docs/contracts.md §5.2 (v1, agreed for M10). No codegen; keep in sync
 * with the contract. All requests go through the Vite dev proxy (`/api/*`).
 *
 * JSON is snake_case per §5. One active dataset in memory server-side.
 */

export type MaterialType = "brown" | "green" | "white";

export const MATERIAL_TYPES: readonly MaterialType[] = ["brown", "green", "white"];

export type PredictedState = "normal" | "full" | "overfull";

export type ForecastMethod = "persistence" | "rate";

export type ReasonCode =
  | "at_or_above_threshold"
  | "overfull_state"
  | "below_threshold"
  | "no_forecast";

export type DistanceProvenance = "haversine_straight_line_derived" | "external";

export type SolveStatus = "optimal" | "feasible" | "infeasible" | "timeout";

/**
 * §5.2.2 FillStats — shares of **readings** (percent of n_rows). The data has
 * no collection events; never word these as "emptyings". threshold_pct echoes
 * the §3.1 default (80) used for the at/over-full share [demo assumption].
 */
export interface FillStats {
  share_readings_full_or_above_pct: number;
  share_readings_overfull_pct: number;
  share_readings_empty_pct: number;
  threshold_pct: number;
}

/** §5.2 DatasetSummary (+ §5.2.2 fill_stats; optional so the UI degrades to "—"). */
export interface DatasetSummary {
  n_rows: number;
  n_locations: number;
  n_series: number;
  date_min: string | null;
  date_max: string | null;
  rows_per_material: Partial<Record<MaterialType, number>>;
  n_errors: number;
  n_warnings: number;
  source_name: string;
  fill_stats?: FillStats | null;
}

/**
 * Validation issue — pinned by the backend `ValidationErrorItem`
 * (src/api/schemas.py): rule_id, row_number (1-based, 0 = header), message,
 * optional value. Full lists ride on the POST /datasets response (§5.1).
 */
export interface ApiIssue {
  rule_id: string;
  row_number: number;
  message: string;
  value?: string | null;
}

/**
 * POST /datasets response: the FLAT DatasetSummary fields plus the full
 * error/warning lists — §5.1 "DatasetSummary + errors/warnings"; backend
 * `DatasetUploadResponse(DatasetSummaryResponse)` inherits the summary fields.
 * There is no nested `summary` key (observed capture 2026-11-14:
 * test/fixtures/real-capture/upload.json — the blank-page bug read one).
 */
export interface UploadResponse extends DatasetSummary {
  errors: ApiIssue[];
  warnings: ApiIssue[];
}

/** §5.2 SeriesStatus (backend SeriesStatusResponse — last_date non-nullable). */
export interface SeriesStatus {
  location_id: string;
  material_type: MaterialType;
  n_readings: number;
  last_date: string;
  last_fill_pct: number | null;
  last_is_overfull: boolean;
}

/** §3.1 PolicyConfig (complete, echoed) */
export interface PolicyConfig {
  select_threshold_pct: number;
  uncertainty_buffer_pct: number;
  overfull_always_selected: boolean;
}

/** Partial PolicyConfig sent as `policy_config` override (§5.2). */
export interface PolicyConfigOverride {
  select_threshold_pct?: number;
  uncertainty_buffer_pct?: number;
  overfull_always_selected?: boolean;
}

/** §4.2/§4.6 v3 travel-time mode: fixed minutes per leg, or speed-derived. */
export type TravelTimeMode = "fixed_per_leg" | "haversine_derived";

/** §4.6 v3 / §5.2 per-field source label for the config assumptions panel. */
export type ConfigSourceLabel = "representative" | "demo assumption";

/**
 * `routing_config` override (§5.2 RouteRequest v3, single demo vehicle type).
 * All optional — only non-undefined fields are sent; backend validates and
 * echoes. `vehicle_compartment_volume_litres` absent/null ⇒ equal thirds
 * (§4.2: explicit values must each be > 0 and sum to the vehicle volume).
 */
export interface RoutingConfigOverride {
  container_volume_litres?: number;
  densities_kg_per_litre?: Partial<Record<MaterialType, number>>;
  vehicle_volume_capacity_litres?: number;
  vehicle_weight_capacity_kg?: number;
  vehicle_count_available?: number;
  vehicle_compartment_volume_litres?: Partial<Record<MaterialType, number>> | null;
  stop_service_minutes?: number;
  disposal_service_minutes?: number;
  max_shift_minutes?: number;
  travel_time_mode?: TravelTimeMode;
  fixed_travel_minutes?: number;
  cost_per_truck_day_eur?: number;
  operating_days_per_week?: number;
  operating_days_per_year?: number;
  geography_seed?: number;
  geography_spread_km?: number;
  avg_speed_kmh?: number;
  detour_factor?: number;
  solver_solution_limit?: number;
  solver_time_limit_s?: number;
}

/** Full routing defaults (§4.6 v3 values) as returned by GET /api/config. */
export interface RoutingConfigDefaults {
  container_volume_litres: number;
  densities_kg_per_litre: Partial<Record<MaterialType, number>>;
  vehicle_volume_capacity_litres: number;
  vehicle_weight_capacity_kg: number;
  vehicle_count_available: number;
  vehicle_compartment_volume_litres: Partial<Record<MaterialType, number>> | null;
  stop_service_minutes: number;
  disposal_service_minutes: number;
  max_shift_minutes: number;
  travel_time_mode: TravelTimeMode;
  fixed_travel_minutes: number;
  cost_per_truck_day_eur: number;
  operating_days_per_week: number;
  operating_days_per_year: number;
  geography_seed: number;
  geography_spread_km: number;
  avg_speed_kmh: number;
  detour_factor: number;
  solver_solution_limit: number;
  solver_time_limit_s: number;
}

/**
 * GET /api/config → §5.2 ConfigDefaults: §3.1 policy defaults, §4.6 v3
 * routing defaults, the names of every [demo assumption] field, and the v3
 * per-field `sources` map ("representative" vs "demo assumption"). Renderers
 * MUST fail safe: a missing/invalid `sources` entry labels the field
 * [demo assumption] — never silently upgrades a value to a fact (§5.3).
 */
export interface ConfigDefaults {
  policy: PolicyConfig;
  routing: RoutingConfigDefaults;
  assumption_fields: string[];
  sources: Record<string, ConfigSourceLabel>;
}

/**
 * Fail-safe source lookup for the UI: only "representative" counts as such;
 * anything else (missing map, missing field, typo) degrades to
 * "demo assumption" (§5.3 — never silently relabel values as facts).
 */
export function sourceLabel(config: ConfigDefaults | null, field: string): ConfigSourceLabel {
  const raw = config?.sources?.[field];
  return raw === "representative" ? "representative" : "demo assumption";
}

/** §5.2 ForecastRequest (horizon_days optional, default 28 [demo assumption]) */
export interface ForecastRequest {
  as_of_date: string;
  horizon_days?: number;
  method: ForecastMethod;
}

/** §2.2 ForecastRecord */
export interface ForecastRecord {
  location_id: string;
  material_type: MaterialType;
  as_of_date: string;
  target_date: string;
  predicted_fill_pct: number;
  predicted_state: PredictedState;
  method: ForecastMethod;
  horizon_days: number;
}

/** §5.2 ForecastResponse */
export interface ForecastResponse {
  as_of_date: string;
  target_date: string;
  method: ForecastMethod;
  forecasts: ForecastRecord[];
}

/** §5.2 CandidateRequest */
export interface CandidateRequest extends ForecastRequest {
  policy_config?: PolicyConfigOverride;
}

/** §3.3 Candidate / Skip */
export interface Candidate {
  location_id: string;
  material_type: MaterialType;
  predicted_fill_pct: number;
  predicted_state: PredictedState;
  reason_code: ReasonCode;
  detail: string;
}

export interface Skip {
  location_id: string;
  material_type: MaterialType;
  predicted_fill_pct: number | null;
  predicted_state: PredictedState | null;
  reason_code: ReasonCode;
  detail: string;
}

/** §3.3 SelectionResult (echoes effective config) */
export interface SelectionResponse {
  as_of_date: string | null;
  target_date: string | null;
  config: PolicyConfig;
  selected: Candidate[];
  skipped: Skip[];
}

/**
 * §4.3 Route.sequence element: Stop | Depot | DisposalSite. §5.2.1 pin: the
 * JSON carries an explicit `node_type` discriminator; stops also carry their
 * routing `point_id` (depot+disposal+stops matrix key).
 */
export interface StopNode {
  node_type: "stop";
  location_id: string;
  material_type: MaterialType;
  lat: number;
  lon: number;
  container_volume_litres: number;
  predicted_fill_pct: number;
  service_minutes: number;
  point_id: string;
}

/** §4.2 Depot */
export interface DepotNode {
  node_type: "depot";
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/** §4.2 DisposalSite */
export interface DisposalNode {
  node_type: "disposal";
  id: string;
  name: string;
  lat: number;
  lon: number;
  service_minutes: number;
}

export type SequenceNode = StopNode | DepotNode | DisposalNode;

export function sequenceNodeKind(node: SequenceNode): "stop" | "depot" | "disposal" {
  return node.node_type;
}

/** §4.3 Route (backend RouteResponseItem: pairs are (volume_litres, weight_kg)). */
export interface Route {
  vehicle_type_id: string;
  sequence: SequenceNode[];
  /** JSON form of list[tuple[int, int]]: [[volume_litres, weight_kg], …]. */
  load_progression: Array<[number, number]>;
  distance_m: number;
  duration_minutes: number;
}

/**
 * §4.3 unserved entry — FLAT {location_id, material_type, reason} (backend
 * UnservedStopResponse; verbatim capture test/fixtures/real-capture/route.json).
 * Never silently dropped (§5.3) — always rendered with its reason.
 */
export interface UnservedStop {
  location_id: string;
  material_type: MaterialType;
  reason: string;
}

/** §4.3 totals + fleet recommendation */
export interface SolutionTotals {
  distance_m: number;
  duration_min: number;
  collected_volume_litres: number;
  /** §4.3 v3: litres per material — compartment visibility (§4.4 limitation). */
  collected_volume_by_material: Record<MaterialType, number>;
  collected_weight_kg: number;
  stops_served: number;
  stops_total: number;
}

export interface FleetRecommendation {
  vehicle_type_id: string;
  count: number;
  basis: { ceil_by_volume: number; ceil_by_weight: number };
}

/** §4.3 v3 cost.fleet_cost — fleet-recommendation cost ([predicted] derived). */
export interface SolutionFleetCost {
  trucks: number;
  cost_eur_per_day: number;
  cost_eur_per_year: number;
}

/**
 * §4.3 v3 solution cost block — pure derivations ([predicted], never invoiced
 * amounts, §4.4): cost_eur_per_day = vehicles_used × cost_per_truck_day_eur;
 * cost_eur_per_year = cost_eur_per_day × operating_days_per_year.
 */
export interface SolutionCost {
  vehicles_used: number;
  cost_eur_per_day: number;
  cost_eur_per_year: number;
  fleet_cost: SolutionFleetCost;
}

/** §4.3 RoutingSolution (v3 echoes travel_time_mode + cost block) */
export interface RoutingSolution {
  status: SolveStatus;
  objective_value: number | null;
  routes: Route[];
  unserved: UnservedStop[];
  totals: SolutionTotals;
  fleet_recommendation: FleetRecommendation;
  /** §4.3 v3 echo of the effective travel-time mode (§4.2). */
  travel_time_mode: TravelTimeMode;
  cost: SolutionCost;
  distance_provenance: DistanceProvenance;
}

/** §5.2 RouteRequest */
export interface RouteRequest extends ForecastRequest {
  policy_config?: PolicyConfigOverride;
  routing_config?: RoutingConfigOverride;
}

/** §5.2 RouteResponse */
export interface RouteResponse {
  selection: SelectionResponse;
  solution: RoutingSolution;
  assumptions: string[];
}

/**
 * §5.2.2 ComparisonScenario (v2 2026-11-14) — one comparison scenario
 * (`naive_sweep_all` / `naive_sweep_selected` / `ortools`). Per-stop/per-kg
 * metrics are `null` on zero denominators (e.g. fleet exhausted before any
 * stop) — never render a fabricated 0. The `ortools` scenario's distance/
 * duration/per-metric values are medians across `runs` solves (§4.7).
 */
export type ComparisonMethod = "naive_sweep_all" | "naive_sweep_selected" | "ortools";

export interface ComparisonScenario {
  method: ComparisonMethod;
  status: string;
  distance_m: number;
  duration_min: number;
  stops_served: number;
  stops_total: number;
  vehicles_available: number;
  vehicles_used: number;
  collected_volume_litres: number;
  collected_weight_kg: number;
  unserved_count: number;
  recommended_trucks: number;
  fleet_basis: { ceil_by_volume: number; ceil_by_weight: number };
  distance_per_stop_m: number | null;
  distance_per_kg_m: number | null;
  /** §4.6 v3 echo of the effective travel-time mode. */
  travel_time_mode: TravelTimeMode;
  /** [predicted] vehicles_used × cost_per_truck_day_eur (§5.2.2 v3). */
  cost_eur_per_day: number;
  /** [predicted] cost_eur_per_day × operating_days_per_year. */
  cost_eur_per_year: number;
}

/** §5.2.2 gains (metres); `null` when a difference would be fabricated. */
export interface ComparisonGains {
  selection_gain_m: number | null; // naive_sweep_all − naive_sweep_selected
  routing_gain_m: number | null; // naive_sweep_selected − ortools (median)
  total_gain_m: number | null;
}

/** §4.7 repetition protocol over `runs` optimised solves. */
export interface OptimisedDeterminism {
  runs: number;
  mode: "identical" | "median_of_runs";
  distance_m_median: number;
  distance_m_min: number;
  distance_m_max: number;
}

/** §5.2.2 v3 fleet budget — ortools fleet recommendation priced at §4.6 rates. */
export interface FleetBudget {
  vehicle_type_id: string;
  trucks: number;
  cost_eur_per_day: number;
  cost_eur_per_year: number;
}

/**
 * §5.2.2 ComparisonResponse (v2 scenarios + v3 cost/fleet_budget). Echoes
 * fixed CLI defaults (as_of/target/horizon, method "persistence"). `scenarios`
 * is in the fixed §4.7 order (`naive_sweep_all`, `naive_sweep_selected`,
 * `ortools`). `distance_provenance` is `haversine_straight_line_derived` —
 * never present as road distance.
 */
export interface ComparisonResponse {
  as_of_date: string;
  target_date: string;
  horizon_days: number;
  method: string;
  scenarios: ComparisonScenario[];
  gains: ComparisonGains;
  optimised_determinism: OptimisedDeterminism;
  fleet_budget: FleetBudget;
  distance_provenance: DistanceProvenance;
  assumptions: string[];
}

/**
 * §5.2.3 Days-to-full (v3): [predicted] per-series estimate from fill history
 * only. `days_to_full` is null exactly when `reason` is set and is not
 * `already_full` (which keeps `days_to_full = 0.0` — a state fact).
 */
export type DaysToFullReason = "no_numeric_history" | "no_positive_rate" | "already_full";

export interface DaysToFullSeries {
  location_id: string;
  material_type: MaterialType;
  last_date: string;
  last_fill_pct: number | null;
  last_is_overfull: boolean;
  /** Median positive consecutive-pair rate (percent per day). */
  rate_pct_per_day: number | null;
  /** max(0, (100 − last numeric fill) / rate), 1 d.p. */
  days_to_full: number | null;
  reason: DaysToFullReason | null;
}

/** Aggregate stats cover series with an estimate only; nulls when none exist. */
export interface DaysToFullStats {
  series_total: number;
  series_with_estimate: number;
  median_days: number | null;
  mean_days: number | null;
  min_days: number | null;
  max_days: number | null;
}

export interface DaysToFullResponse {
  method: "median_positive_pair_rate";
  stats: DaysToFullStats;
  series: DaysToFullSeries[];
  /** Caveats echoed by the API (median reading gap, constant-rate assumption). */
  assumptions: string[];
}

/** API error with HTTP status and parsed detail (FastAPI 422 shape tolerated). */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/** Best-effort human message out of a FastAPI-style `detail` payload. */
export function detailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) =>
        typeof d === "object" && d !== null && "msg" in d
          ? String((d as { msg: unknown }).msg)
          : JSON.stringify(d),
      )
      .join("; ");
  }
  if (typeof detail === "object" && detail !== null) {
    const record = detail as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    return JSON.stringify(detail);
  }
  if (detail === undefined || detail === null) return "";
  return String(detail);
}

async function parseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const body = await parseBody(response);
    const detail = typeof body === "object" && body !== null && "detail" in body
      ? (body as { detail: unknown }).detail
      : body;
    throw new ApiError(
      response.status,
      detail,
      `${init?.method ?? "GET"} ${path} failed: ${response.status}${
        detailMessage(detail) ? ` — ${detailMessage(detail)}` : ""
      }`,
    );
  }
  return (await response.json()) as T;
}

export async function uploadDataset(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  return request<UploadResponse>("/api/datasets", { method: "POST", body: form });
}

export async function fetchSummary(): Promise<DatasetSummary> {
  return request<DatasetSummary>("/api/summary");
}

export async function fetchContainers(): Promise<SeriesStatus[]> {
  return request<SeriesStatus[]>("/api/containers");
}

export async function fetchConfig(): Promise<ConfigDefaults> {
  return request<ConfigDefaults>("/api/config");
}

export async function runForecasts(payload: ForecastRequest): Promise<ForecastResponse> {
  return request<ForecastResponse>("/api/forecasts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function runCandidates(payload: CandidateRequest): Promise<SelectionResponse> {
  return request<SelectionResponse>("/api/candidates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function runRoute(payload: RouteRequest): Promise<RouteResponse> {
  return request<RouteResponse>("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * GET /api/comparison (§5.2.2 v2): three scenarios (fixed-order sweeps vs
 * optimised) on the active dataset. 404 when no dataset is loaded (§5.3) —
 * callers must turn that into an empty state, not an error.
 */
export async function fetchComparison(): Promise<ComparisonResponse> {
  return request<ComparisonResponse>("/api/comparison");
}

/**
 * GET /api/days-to-full (§5.2.3 v3): [predicted] days-to-full per series from
 * the fill history of the active dataset. 404 when no dataset is loaded (§5.3)
 * — callers must turn that into an empty state, not an error.
 */
export async function fetchDaysToFull(): Promise<DaysToFullResponse> {
  return request<DaysToFullResponse>("/api/days-to-full");
}

/**
 * POST /api/datasets/demo (§5.1): load the server-side demo CSV (path fixed
 * server-side, never client-supplied). Response shape = upload response
 * (flat DatasetSummary + errors/warnings); `source_name` carries a `demo:`
 * prefix so the UI can label it as demo data (§5.2.2).
 */
export async function loadDemoDataset(): Promise<UploadResponse> {
  return request<UploadResponse>("/api/datasets/demo", { method: "POST" });
}
