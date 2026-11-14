/**
 * TodayPlanToggle (W1/W2, §6) tests: cost is never shown without a service
 * indicator; the observed anchor is [observed]; simulated strategies carry
 * the simulation-basis label; tradeoffs are shown straight (demand_driven
 * currently costs MORE in the fixture — the flag must say so, not spin it);
 * server-defaults request body; loading/empty/error states.
 */
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { TodayPlanToggle } from "./TodayPlanToggle";
import type { ScenarioResponse } from "../lib/api";
import { cleanup, click, flush, jsonResponse, render } from "../test/dom";
import { scenariosFixture } from "../test/fixtures";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubScenarios(payload: unknown, status = 200): Mock {
  const fetchMock = vi.fn(async () => jsonResponse(payload as object, status));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Inverted tradeoff: plan cheaper BUT service worse (§6 warning case). */
const cheaperButWorse: ScenarioResponse = {
  ...scenariosFixture,
  strategies: [
    scenariosFixture.strategies[0],
    {
      ...scenariosFixture.strategies[1],
      cost_eur_total: 300000,
      cost_eur_per_year: 172023.35,
      service: {
        basis: "simulated",
        overflow_share_pct: 5.0,
        share_emptyings_full_or_overfull_pct: 22.0,
        max_fill_pct: 420.0,
      },
    },
  ],
};

describe("TodayPlanToggle — cost + service together (§6)", () => {
  it("renders the observed anchor and the today block with service beside cost; POSTs server defaults", async () => {
    const fetchMock = stubScenarios(scenariosFixture);
    render(<TodayPlanToggle lang="en" datasetVersion={0} />);

    await flush();
    await flush();

    // Empty body → every parameter uses the server default (§5.2.4).
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/scenarios");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe("{}");

    const anchor = document.querySelector('[data-testid="toggle-anchor"]')?.textContent ?? "";
    expect(anchor).toContain("26.9 %"); // from the fixture, never hardcoded
    expect(anchor).toContain("observed emptying records");

    const today = document.querySelector('[data-testid="toggle-strategy-today"]')?.textContent ?? "";
    expect(today).toContain("426,000 EUR"); // cost_eur_total
    expect(today).toContain("244,126 EUR/year"); // cost_eur_per_year (rounded)
    // §6: service indicators ride beside the cost.
    expect(today).toContain("14.4 %"); // share full-or-overfull
    expect(today).toContain("2.4 %"); // overflow share
    expect(today).toContain("366.4 %"); // max fill
    expect(today).toContain("simulation based on historical rates");
  });

  it("plan side shows demand_driven costing MORE, shown straight, with both deltas", async () => {
    stubScenarios(scenariosFixture);
    render(<TodayPlanToggle lang="en" datasetVersion={0} />);
    await flush();
    await flush();

    await click(document.querySelector('[data-testid="toggle-plan"]'));

    const plan = document.querySelector('[data-testid="toggle-strategy-plan"]')?.textContent ?? "";
    expect(plan).toContain("520,000 EUR");
    expect(plan).toContain("297,994 EUR/year");
    expect(plan).toContain("0.0 %"); // overflow 0.0

    const tradeoff = document.querySelector('[data-testid="toggle-tradeoff"]')?.textContent ?? "";
    expect(tradeoff).toContain("costs MORE"); // straight wording, not spun
    // Derived delta: 297,994.27 − 244,126.07 = +53,868 EUR/year.
    expect(tradeoff).toContain("+53,868 EUR/year");
    // Service delta: 0.0 − 14.4 = −14.4 pp (improvement).
    expect(tradeoff).toContain("−14.4 pp");
  });

  it("flags cost-less-but-service-worse honestly (§6 warning case)", async () => {
    stubScenarios(cheaperButWorse);
    render(<TodayPlanToggle lang="en" datasetVersion={0} />);
    await flush();
    await flush();

    await click(document.querySelector('[data-testid="toggle-plan"]'));

    const tradeoff = document.querySelector('[data-testid="toggle-tradeoff"]')?.textContent ?? "";
    expect(tradeoff).toContain("costs LESS");
    expect(tradeoff).toContain("WORSE");
  });

  it("renders German strings with parity (anchor + flags)", async () => {
    stubScenarios(scenariosFixture);
    render(<TodayPlanToggle lang="de" datasetVersion={0} />);
    await flush();
    await flush();

    const text = document.body.textContent ?? "";
    expect(text).toContain("Heute vs. mit unserem Plan");
    expect(text).toContain("Leerungsdaten voll oder übervoll");
    expect(text).toContain("26.9 %");
    await click(document.querySelector('[data-testid="toggle-plan"]'));
    const tradeoff = document.querySelector('[data-testid="toggle-tradeoff"]')?.textContent ?? "";
    expect(tradeoff).toContain("MEHR");
  });
});

describe("TodayPlanToggle — states", () => {
  it("shows the loading state first", async () => {
    stubScenarios(scenariosFixture);
    render(<TodayPlanToggle lang="en" datasetVersion={0} />);
    expect(document.querySelector('[data-testid="loading-state"]')?.textContent).toContain(
      "Computing today-vs-plan",
    );
    await flush();
  });

  it("degrades to an error state on a malformed payload (never crashes)", async () => {
    stubScenarios({ status: "ok" });
    render(<TodayPlanToggle lang="en" datasetVersion={0} />);
    await flush();
    await flush();

    expect(document.querySelector('[data-testid="error-state"]')?.textContent).toContain(
      "Could not compute the today-vs-plan comparison",
    );
    expect(document.querySelector('[data-testid="today-plan-toggle"]')).not.toBeNull();
  });

  it("shows the empty state on 404 (no dataset — not an error, §5.3)", async () => {
    stubScenarios({ detail: "no dataset" }, 404);
    render(<TodayPlanToggle lang="en" datasetVersion={0} />);
    await flush();
    await flush();

    expect(document.querySelector('[data-testid="empty-state"]')?.textContent).toContain(
      "available after loading data",
    );
    expect(document.querySelector('[data-testid="error-state"]')).toBeNull();
  });
});
