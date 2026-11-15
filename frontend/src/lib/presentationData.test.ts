/**
 * presentationData (§6 v5) tests: the bundled captures load into a valid
 * bundle (zero network — static imports); missing captures yield the
 * "missing" error result; shape-invalid captures yield the "invalid" error
 * result with a field-level detail — never a thrown error, so the UI can
 * render a visible error slide instead of an endless spinner.
 */
import { describe, expect, it } from "vitest";
import {
  PRESENTATION_CAPTURED,
  buildPresentationBundle,
  loadPresentationBundle,
  type RawCaptures,
} from "./presentationData";

/** Raw captures from the real bundle, re-typed as the raw `unknown` inputs. */
function rawCaptures(): RawCaptures {
  const result = loadPresentationBundle();
  if (result.status !== "ok") throw new Error("bundled captures failed to load");
  return {
    summary: result.bundle.summary,
    comparison: result.bundle.comparison,
    scenarios: result.bundle.scenarios,
    daysToFull: result.bundle.daysToFull,
    simulation: result.bundle.simulation,
  };
}

describe("loadPresentationBundle — bundled captures (§6 v5)", () => {
  it("loads the committed captures into a valid bundle with the capture date", () => {
    const result = loadPresentationBundle();
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.bundle.captured).toBe(PRESENTATION_CAPTURED);
    // Key aggregates the slides render (observed capture values).
    expect(result.bundle.summary.fill_stats?.share_readings_full_or_above_pct).toBe(34.5);
    expect(result.bundle.summary.date_max).toBe("2026-09-30");
    expect(result.bundle.comparison.scenarios).toHaveLength(4);
    expect(result.bundle.daysToFull.stats_by_material.brown.median_days).toBeCloseTo(121.95, 2);
    // §5.2.6 money-story aggregates (captured 2026-11-15).
    expect(result.bundle.scenarios.observed_baseline.truck_days).toBe(523);
    expect(result.bundle.scenarios.observed_baseline.cost_eur_total).toBe(261500.0);
    const spread = result.bundle.scenarios.strategies.find((s) => s.id === "day_spread");
    expect(spread?.cost_eur_total).toBe(171000.0);
    expect(spread?.truck_days).toBe(342);
    // §5.2.5 v5 simulation capture: observed active days + both strategies.
    expect(result.bundle.simulation.observed_days).toHaveLength(229);
    expect(result.bundle.simulation.observed_days[0]).toEqual({
      date: "2025-10-17",
      collections: 23,
    });
    for (const id of ["fixed_frequency", "demand_driven"] as const) {
      const strat = result.bundle.simulation.strategies.find((s) => s.id === id);
      expect(strat?.days).toHaveLength(349);
    }
  });
});

describe("buildPresentationBundle — missing captures", () => {
  it("reports missing (never throws) when a capture is absent", () => {
    const raw = rawCaptures();
    const result = buildPresentationBundle({ ...raw, comparison: undefined });
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.reason).toBe("missing");
    expect(result.detail).toContain("comparison");
  });

  it("reports every missing capture name", () => {
    const result = buildPresentationBundle({
      summary: undefined,
      comparison: null,
      scenarios: undefined,
      daysToFull: undefined,
      simulation: undefined,
    });
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.reason).toBe("missing");
    for (const name of [
      "summary",
      "comparison",
      "scenarios",
      "daysToFull",
      "simulation",
    ]) {
      expect(result.detail).toContain(name);
    }
  });
});

describe("buildPresentationBundle — invalid captures (visible error, not spinner)", () => {
  it("rejects a summary without fill_stats", () => {
    const raw = rawCaptures();
    const summary = { ...(raw.summary as Record<string, unknown>) };
    delete summary.fill_stats;
    const result = buildPresentationBundle({ ...raw, summary });
    expect(result).toMatchObject({ status: "error", reason: "invalid" });
    if (result.status === "error") expect(result.detail).toContain("fill_stats");
  });

  it("rejects a comparison without scenarios", () => {
    const raw = rawCaptures();
    const result = buildPresentationBundle({
      ...raw,
      comparison: { ...(raw.comparison as object), scenarios: [] },
    });
    expect(result).toMatchObject({ status: "error", reason: "invalid" });
    if (result.status === "error") expect(result.detail).toContain("comparison.scenarios");
  });

  it("rejects scenarios strategies without cost + service", () => {
    const raw = rawCaptures();
    const result = buildPresentationBundle({
      ...raw,
      scenarios: { strategies: [{ id: "fixed_frequency" }] },
    });
    expect(result).toMatchObject({ status: "error", reason: "invalid" });
    if (result.status === "error") expect(result.detail).toContain("strategies");
  });

  it("rejects scenarios without the §5.2.6 observed_baseline block", () => {
    const raw = rawCaptures();
    const scenarios = { ...(raw.scenarios as Record<string, unknown>) };
    delete scenarios.observed_baseline;
    const result = buildPresentationBundle({ ...raw, scenarios });
    expect(result).toMatchObject({ status: "error", reason: "invalid" });
    if (result.status === "error") expect(result.detail).toContain("observed_baseline");
  });

  it("rejects scenarios without the day_spread strategy", () => {
    const raw = rawCaptures();
    const scenarios = raw.scenarios as Record<string, unknown>;
    const result = buildPresentationBundle({
      ...raw,
      scenarios: {
        ...scenarios,
        strategies: (scenarios.strategies as unknown[]).filter(
          (s) => (s as Record<string, unknown>).id !== "day_spread",
        ),
      },
    });
    expect(result).toMatchObject({ status: "error", reason: "invalid" });
    if (result.status === "error") expect(result.detail).toContain("day_spread");
  });

  it("rejects days-to-full with a missing material stat", () => {
    const raw = rawCaptures();
    const dtf = raw.daysToFull as Record<string, unknown>;
    const stats = { ...(dtf.stats_by_material as Record<string, unknown>) };
    delete stats.white;
    const result = buildPresentationBundle({ ...raw, daysToFull: { ...dtf, stats_by_material: stats } });
    expect(result).toMatchObject({ status: "error", reason: "invalid" });
    if (result.status === "error") expect(result.detail).toContain("stats_by_material");
  });

  it("rejects a simulation without observed per-day visit counts", () => {
    const raw = rawCaptures();
    const simulation = { ...(raw.simulation as Record<string, unknown>) };
    delete simulation.observed_days;
    const result = buildPresentationBundle({ ...raw, simulation });
    expect(result).toMatchObject({ status: "error", reason: "invalid" });
    if (result.status === "error") expect(result.detail).toContain("observed_days");
  });

  it("rejects a simulation whose strategy lacks per-day truck_days", () => {
    const raw = rawCaptures();
    const simulation = raw.simulation as Record<string, unknown>;
    const result = buildPresentationBundle({
      ...raw,
      simulation: {
        ...simulation,
        strategies: [
          {
            id: "demand_driven",
            days: [{ date: "2025-10-17", collections: 3 }],
          },
        ],
      },
    });
    expect(result).toMatchObject({ status: "error", reason: "invalid" });
    if (result.status === "error") expect(result.detail).toContain("fixed_frequency");
  });
});
