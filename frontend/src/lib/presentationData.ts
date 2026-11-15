/**
 * Presentation data source (§6 v5, M17-P3a): presentation slides read
 * **bundled verbatim API captures** — precalculated from the real dataset,
 * capture date recorded below — with ZERO live network calls while
 * presenting. The JSON files are statically imported, so:
 * - a missing capture file fails the BUILD (never a runtime spinner);
 * - a shape-invalid capture fails here at runtime into a visible error
 *   result that PresentationMode renders as an error slide.
 *
 * Captures live in src/test/fixtures/real-capture/presentation/ (see its
 * README for the exact capture commands and date). They contain API
 * outputs/aggregates only — no raw CSV rows and no host coordinates JSON.
 */
import comparisonJson from "../test/fixtures/real-capture/presentation/comparison.json";
import daysToFullJson from "../test/fixtures/real-capture/presentation/days_to_full.json";
import scenariosJson from "../test/fixtures/real-capture/presentation/scenarios.json";
import simulationJson from "../test/fixtures/real-capture/presentation/simulation.json";
import summaryJson from "../test/fixtures/real-capture/presentation/summary.json";
import type {
  ComparisonResponse,
  DaysToFullResponse,
  DatasetSummary,
  ScenarioResponse,
  SimulationResponse,
} from "./api";

/** Capture date (YYYY-MM-DD) of the bundled fixtures, shown on every slide. */
export const PRESENTATION_CAPTURED = "2026-11-15";

export interface PresentationBundle {
  captured: string;
  summary: DatasetSummary;
  comparison: ComparisonResponse;
  scenarios: ScenarioResponse;
  daysToFull: DaysToFullResponse;
  simulation: SimulationResponse;
}

export type PresentationBundleResult =
  | { status: "ok"; bundle: PresentationBundle }
  | { status: "error"; reason: "missing" | "invalid"; detail: string };

/** Raw capture payloads exactly as parsed from the bundled JSON files. */
export interface RawCaptures {
  summary: unknown;
  comparison: unknown;
  scenarios: unknown;
  daysToFull: unknown;
  simulation: unknown;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const isString = (v: unknown): v is string => typeof v === "string";

const isArrayOf = <T>(v: unknown, pred: (x: unknown) => x is T): v is T[] =>
  Array.isArray(v) && v.every(pred);

/**
 * Validate exactly the fields the presentation slides consume (§6 v5:
 * bounded loading — invalid captures surface as errors, never spinners).
 * Each validator returns null when the capture is usable, else a detail
 * string naming the missing/invalid field.
 */
function validateSummary(v: unknown): string | null {
  if (!isRecord(v)) return "summary: not an object";
  if (!isFiniteNumber(v.n_rows)) return "summary.n_rows: not a finite number";
  if (!(v.date_max === null || isString(v.date_max)))
    return "summary.date_max: not a string or null";
  const fs = v.fill_stats;
  if (
    !isRecord(fs) ||
    !isFiniteNumber(fs.share_readings_full_or_above_pct) ||
    !isFiniteNumber(fs.share_readings_overfull_pct) ||
    !isFiniteNumber(fs.share_readings_empty_pct) ||
    !isFiniteNumber(fs.threshold_pct)
  ) {
    return "summary.fill_stats: missing or not the 4-field §5.2.2 shape";
  }
  return null;
}

function validateComparison(v: unknown): string | null {
  if (!isRecord(v)) return "comparison: not an object";
  if (
    !isArrayOf(v.scenarios, isRecord) ||
    v.scenarios.length === 0 ||
    !v.scenarios.every((s) => isString(s.method) && isFiniteNumber(s.distance_m))
  ) {
    return "comparison.scenarios: no entries with method + distance_m";
  }
  if (!isRecord(v.gains) || !(v.gains.total_gain_m === null || isFiniteNumber(v.gains.total_gain_m)))
    return "comparison.gains.total_gain_m: not a number or null";
  const anchor = v.observed_service_anchor;
  if (
    !isRecord(anchor) ||
    !(anchor.share_full_or_overfull_pct === null || isFiniteNumber(anchor.share_full_or_overfull_pct))
  ) {
    return "comparison.observed_service_anchor.share_full_or_overfull_pct: not a number or null";
  }
  return null;
}

function validateScenarios(v: unknown): string | null {
  if (!isRecord(v)) return "scenarios: not an object";
  if (
    !isArrayOf(v.strategies, isRecord) ||
    v.strategies.length === 0 ||
    !v.strategies.every(
      (s) =>
        isString(s.id) &&
        isFiniteNumber(s.cost_eur_total) &&
        isFiniteNumber(s.cost_eur_per_year) &&
        isRecord(s.service) &&
        (s.service.overflow_share_pct === null || isFiniteNumber(s.service.overflow_share_pct)),
    )
  ) {
    return "scenarios.strategies: no entries with id + cost_eur_total + cost_eur_per_year + service.overflow_share_pct";
  }
  const spread = v.strategies.find((s) => s.id === "day_spread");
  if (
    !isRecord(spread) ||
    !isFiniteNumber(spread.cost_eur_total) ||
    !isFiniteNumber(spread.truck_days) ||
    !isFiniteNumber(spread.typical_trucks_per_day)
  ) {
    return "scenarios.strategies: day_spread strategy missing cost/truck_days/typical_trucks_per_day";
  }
  const baseline = v.observed_baseline;
  if (
    !isRecord(baseline) ||
    baseline.basis !== "observed_emptying_records" ||
    !isFiniteNumber(baseline.truck_days) ||
    !isFiniteNumber(baseline.cost_eur_total) ||
    !isFiniteNumber(baseline.median_trucks_per_active_day) ||
    !isFiniteNumber(baseline.peak_trucks)
  ) {
    return "scenarios.observed_baseline: missing or not the §5.2.6 shape";
  }
  return null;
}

function validateDaysToFull(v: unknown): string | null {
  if (!isRecord(v)) return "daysToFull: not an object";
  const materials = isRecord(v.stats_by_material) ? v.stats_by_material : undefined;
  const ok =
    materials !== undefined &&
    (["brown", "green", "white"] as const).every((m) => {
      const s = materials[m];
      return (
        isRecord(s) &&
        (s.median_days === null || isFiniteNumber(s.median_days)) &&
        (s.lower_bound_share_pct === null || isFiniteNumber(s.lower_bound_share_pct))
      );
    });
  if (!ok) return "daysToFull.stats_by_material: missing brown/green/white medians";
  if (!isArrayOf(v.assumptions, isString) || v.assumptions.length === 0)
    return "daysToFull.assumptions: no labelled assumption strings";
  return null;
}

/** §5.2.5 v5 simulation: observed_days + both strategies' daily rows. */
function validateSimulation(v: unknown): string | null {
  if (!isRecord(v)) return "simulation: not an object";
  const dayOk = (d: unknown): d is Record<string, unknown> =>
    isRecord(d) && isString(d.date) && isFiniteNumber(d.collections);
  const simDayOk = (d: unknown): d is Record<string, unknown> =>
    dayOk(d) && isFiniteNumber(d.truck_days);
  if (!isArrayOf(v.observed_days, dayOk) || v.observed_days.length === 0)
    return "simulation.observed_days: no per-day observed visit counts";
  if (!isArrayOf(v.strategies, isRecord) || v.strategies.length === 0) {
    return "simulation.strategies: none";
  }
  const fixed = v.strategies.find((s) => s.id === "fixed_frequency");
  const demand = v.strategies.find((s) => s.id === "demand_driven");
  for (const [name, s] of [
    ["fixed_frequency", fixed],
    ["demand_driven", demand],
  ] as const) {
    if (!isRecord(s) || !isArrayOf(s.days, simDayOk) || s.days.length === 0) {
      return `simulation.strategies.${name}: no per-day truck_days rows`;
    }
  }
  return null;
}

/** Build the bundle result from raw captures (pure, testable). */
export function buildPresentationBundle(raw: RawCaptures): PresentationBundleResult {
  const missing = Object.entries(raw)
    .filter(([, v]) => v === undefined || v === null)
    .map(([k]) => k);
  if (missing.length > 0) {
    return { status: "error", reason: "missing", detail: missing.join(", ") };
  }
  const problems = [
    validateSummary(raw.summary),
    validateComparison(raw.comparison),
    validateScenarios(raw.scenarios),
    validateDaysToFull(raw.daysToFull),
    validateSimulation(raw.simulation),
  ].filter((p): p is string => p !== null);
  if (problems.length > 0) {
    return { status: "error", reason: "invalid", detail: problems.join("; ") };
  }
  return {
    status: "ok",
    bundle: {
      captured: PRESENTATION_CAPTURED,
      summary: raw.summary as DatasetSummary,
      comparison: raw.comparison as ComparisonResponse,
      scenarios: raw.scenarios as ScenarioResponse,
      daysToFull: raw.daysToFull as DaysToFullResponse,
      simulation: raw.simulation as SimulationResponse,
    },
  };
}

/**
 * The five bundled capture files, statically imported — Vite inlines JSON
 * imports into the build, so the presentation makes no network request at
 * all, and a missing file fails `tsc`/`vite build` at build time (never a
 * runtime spinner). The `as unknown` casts keep the payloads untyped until
 * the validators above have checked them (a JSON import infers types that
 * could silently drift from the real wire shapes).
 */
const captures: RawCaptures = {
  summary: summaryJson as unknown,
  comparison: comparisonJson as unknown,
  scenarios: scenariosJson as unknown,
  daysToFull: daysToFullJson as unknown,
  simulation: simulationJson as unknown,
};

/** Load the presentation bundle (synchronous, bounded, no network). */
export function loadPresentationBundle(): PresentationBundleResult {
  return buildPresentationBundle(captures);
}
