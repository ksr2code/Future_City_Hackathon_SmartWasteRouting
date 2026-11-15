/**
 * Overview story charts (§6 v5 restructure) — pure components: they render
 * from API-shaped props (no fetches). Fixture data: simulationFixture is
 * traced to the live v4/simulation.json capture (2026-11-15); the histogram
 * uses the days-to-full fixture (§5.2.3 v2). Honesty labels are asserted on
 * every chart — never hidden, never hardcoded numbers (median/counts derive
 * from the props).
 */
import { afterEach, describe, expect, it } from "vitest";
import { DaysToFullHistogram } from "./DaysToFullHistogram";
import { FillCurveIllustration } from "./FillCurveIllustration";
import { ObservedVisitsTimeline } from "./ObservedVisitsTimeline";
import { TrapTruckDaysChart } from "./TrapTruckDaysChart";
import { cleanup, render } from "../../test/dom";
import { daysToFullFixture, simulationFixture } from "../../test/fixtures";

afterEach(cleanup);

describe("ObservedVisitsTimeline — [observed] daily rhythm", () => {
  it("renders bars + the derived median label from the capture data", () => {
    render(<ObservedVisitsTimeline lang="en" days={simulationFixture.observed_days} />);
    const chart = document.querySelector('[data-testid="chart-observed"]');
    expect(chart).not.toBeNull();
    // Derived median of [23, 127, 57] = 57 — from the props, never hardcoded.
    expect(chart?.textContent).toContain("Median per active day: 57");
    // §6 basis label: observed emptying records, active days only.
    expect(chart?.textContent).toContain("observed emptying records [observed]");
    // Bars actually render (svg rects), one per observed day.
    expect(document.querySelectorAll("svg rect").length).toBeGreaterThan(0);
  });

  it("renders no median line when the day list is empty", () => {
    render(<ObservedVisitsTimeline lang="en" days={[]} />);
    const chart = document.querySelector('[data-testid="chart-observed"]');
    expect(chart).not.toBeNull();
    expect(chart?.textContent).not.toContain("Median per active day");
  });

  it("renders German labels with parity", () => {
    render(<ObservedVisitsTimeline lang="de" days={simulationFixture.observed_days} />);
    expect(document.querySelector('[data-testid="chart-observed"]')?.textContent).toContain(
      "beobachtete Leerungsdaten [beobachtet]",
    );
    expect(document.querySelector('[data-testid="chart-observed"]')?.textContent).toContain(
      "Median pro aktivem Tag: 57",
    );
  });
});

describe("FillCurveIllustration — static, labelled illustration", () => {
  it("renders the sawtooth drawing with the illustration + trigger labels", () => {
    render(<FillCurveIllustration lang="en" />);
    const chart = document.querySelector('[data-testid="chart-fill-curve"]');
    expect(chart).not.toBeNull();
    expect(chart?.textContent).toContain("Illustration — not data");
    expect(chart?.textContent).toContain("emptying trigger 80 % [demo assumption]");
    // The drawing itself renders (svg with a path/line).
    expect(document.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("renders German labels with parity", () => {
    render(<FillCurveIllustration lang="de" />);
    const chart = document.querySelector('[data-testid="chart-fill-curve"]');
    expect(chart?.textContent).toContain("Illustration — keine Daten");
    expect(chart?.textContent).toContain("Leerungs-Auslöser 80 % [Demo-Annahme]");
  });
});

describe("DaysToFullHistogram — [predicted] bins from the API series", () => {
  it("bins the estimates and shows the used-series count", () => {
    // Fixture: brown 43.2 d (≤ 60 bin), white null (excluded) → 1 used.
    render(<DaysToFullHistogram lang="en" series={daysToFullFixture.series} />);
    const chart = document.querySelector('[data-testid="chart-dtf-histogram"]');
    expect(chart).not.toBeNull();
    expect(chart?.textContent).toContain("1 series with an estimate");
    expect(chart?.textContent).toContain("≤ 60 d: 1");
    expect(chart?.textContent).toContain("≤ 30 d: 0");
  });

  it("renders nothing when no series carries an estimate", () => {
    const container = render(
      <DaysToFullHistogram
        lang="en"
        series={[{ days_to_full: null }, { days_to_full: null }]}
      />,
    );
    expect(container.querySelector('[data-testid="chart-dtf-histogram"]')).toBeNull();
  });

  it("renders German bin labels with parity", () => {
    render(<DaysToFullHistogram lang="de" series={daysToFullFixture.series} />);
    const chart = document.querySelector('[data-testid="chart-dtf-histogram"]');
    expect(chart?.textContent).toContain("1 Serien mit Schätzung");
    expect(chart?.textContent).toContain("≤ 60 T: 1");
  });
});

describe("TrapTruckDaysChart — the clustering trap, [predicted]", () => {
  it("renders both replay series with legend + basis labels", () => {
    const fixed = simulationFixture.strategies.find((s) => s.id === "fixed_frequency")!.days;
    const demand = simulationFixture.strategies.find((s) => s.id === "demand_driven")!.days;
    // cycleDays comes from the API config echo (28 in the fixture) — same
    // wiring the Overview uses; the label is parameterised, never hardcoded.
    render(
      <TrapTruckDaysChart
        lang="en"
        fixedDays={fixed}
        demandDays={demand}
        cycleDays={simulationFixture.config_echo.frequency_days.toLocaleString("en-US")}
      />,
    );
    const chart = document.querySelector('[data-testid="chart-trap"]');
    expect(chart).not.toBeNull();
    // Legend: fixed cycle reuses the today-label vocabulary; demand line has
    // its own [predicted] label (ScenariosPanel trap wording parity).
    expect(chart?.textContent).toContain("Modelled 28-day cycle [demo assumption]");
    expect(chart?.textContent).toContain("Demand-driven, same-day (no spacing) [predicted]");
    expect(chart?.textContent).toContain("Simulation based on historical rates");
  });

  it("titles the fixed-cycle legend with the cycleDays prop (never hardcoded 28)", () => {
    const fixed = simulationFixture.strategies.find((s) => s.id === "fixed_frequency")!.days;
    const demand = simulationFixture.strategies.find((s) => s.id === "demand_driven")!.days;
    render(<TrapTruckDaysChart lang="en" fixedDays={fixed} demandDays={demand} cycleDays="14" />);
    const chart = document.querySelector('[data-testid="chart-trap"]');
    expect(chart?.textContent).toContain("Modelled 14-day cycle [demo assumption]");
    expect(chart?.textContent).not.toContain("28-day");
    expect(chart?.textContent).not.toContain("{days}");
  });

  it("falls back to the number-free label when cycleDays is missing (never invents 28)", () => {
    const fixed = simulationFixture.strategies.find((s) => s.id === "fixed_frequency")!.days;
    const demand = simulationFixture.strategies.find((s) => s.id === "demand_driven")!.days;
    render(<TrapTruckDaysChart lang="en" fixedDays={fixed} demandDays={demand} />);
    const chart = document.querySelector('[data-testid="chart-trap"]');
    expect(chart?.textContent).toContain("Modelled fixed emptying cycle [demo assumption]");
    expect(chart?.textContent).not.toContain("28");
    expect(chart?.textContent).not.toContain("{days}");
  });

  it("renders German labels with parity", () => {
    const fixed = simulationFixture.strategies.find((s) => s.id === "fixed_frequency")!.days;
    const demand = simulationFixture.strategies.find((s) => s.id === "demand_driven")!.days;
    render(
      <TrapTruckDaysChart
        lang="de"
        fixedDays={fixed}
        demandDays={demand}
        cycleDays={simulationFixture.config_echo.frequency_days.toLocaleString("en-US")}
      />,
    );
    const chart = document.querySelector('[data-testid="chart-trap"]');
    expect(chart?.textContent).toContain("Modellierter 28-Tage-Zyklus [Demo-Annahme]");
    expect(chart?.textContent).toContain("Bedarfsorientiert, gleicher Tag (ohne Staffelung) [Prognose]");
  });
});
