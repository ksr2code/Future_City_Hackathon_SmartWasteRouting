/**
 * RoutePanel tests (M21 presentation redesign: "One collection day,
 * optimised"). Fetches are stubbed by "METHOD path" — unexpected calls throw.
 * The mount auto-fetch of POST /api/scenarios sources the linking sentence's
 * peak-trucks figure ([predicted] simulation) — never hardcoded; absent →
 * parenthetical omitted.
 */
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { RoutePanel, deferredReasonText } from "./RoutePanel";
import type { RouteResponse } from "../lib/api";
import { click, cleanup, flush, jsonResponse, render } from "../test/dom";
import { routeResponseFixture, scenariosFixture } from "../test/fixtures";
import realRouteCapture from "../test/fixtures/real-capture/route.json";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type FetchArgs = [input: RequestInfo | URL, init?: RequestInit];

function stubRoutes(routes: Record<string, (args: FetchArgs) => Response>): Mock {
  const fetchMock = vi.fn(async (...args: FetchArgs) => {
    const [rawInput, init] = args;
    const key = `${init?.method ?? "GET"} ${String(rawInput)}`;
    const handler = routes[key];
    if (handler === undefined) {
      throw new Error(`unexpected fetch ${key}`);
    }
    return handler(args);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function routeRoutes(): Record<string, (args: FetchArgs) => Response> {
  return {
    "POST /api/route": () => jsonResponse(routeResponseFixture),
    "POST /api/scenarios": () => jsonResponse(scenariosFixture),
  };
}

function renderRoutePanel(
  overrides: Partial<Parameters<typeof RoutePanel>[0]> = {},
): HTMLElement {
  return render(
    <RoutePanel
      lang="en"
      defaultAsOf="2026-10-31"
      policyOverride={{}}
      routingOverride={{}}
      onRoute={vi.fn()}
      {...overrides}
    />,
  );
}

describe("RoutePanel — purpose header + day context + linking sentence", () => {
  it("renders the plain-language header and the peak-trucks figure from POST /api/scenarios", async () => {
    stubRoutes(routeRoutes());
    renderRoutePanel();
    await flushMount();

    expect(document.body.textContent).toContain("One collection day, optimised");

    await click(document.querySelector('[data-testid="route-run"]'));

    // Linking sentence: peak 1 truck/day from the day_spread strategy
    // (scenariosFixture, §5.2.6) — sourced, never hardcoded.
    const link = document.querySelector('[data-testid="route-link"]')?.textContent ?? "";
    expect(link).toContain("The day-by-day plan lives in Scenarios");
    expect(link).toContain("(peak 1 truck(s) per day, [predicted] simulation)");

    // Day context from the response selection dates (not invented).
    const day = document.querySelector('[data-testid="route-day-context"]')?.textContent ?? "";
    expect(day).toContain("as-of 2026-10-31");
    expect(day).toContain("forecast target");
    expect(day).toContain("[demo assumption]");
  });

  it("omits the peak parenthetical when the scenarios fetch fails (never invents a number)", async () => {
    stubRoutes({
      ...routeRoutes(),
      "POST /api/scenarios": () => jsonResponse({ detail: "no dataset" }, 404),
    });
    renderRoutePanel();
    await flushMount();

    expect(document.querySelector('[data-testid="route-link"]')?.textContent).toContain(
      "The day-by-day plan lives in Scenarios",
    );
    expect(document.querySelector('[data-testid="route-link"]')?.textContent).not.toContain(
      "peak",
    );
  });
});

/** Flush the mount auto-fetch (scenarios) plus pending state updates. */
async function flushMount(): Promise<void> {
  await flush();
  await flush();
}

describe("RoutePanel — deferred stops (plain-language reasons)", () => {
  it("shows the deferred title, explanation and plain sentences with the raw code in the title attribute", async () => {
    stubRoutes(routeRoutes());
    renderRoutePanel();
    await flushMount();
    await click(document.querySelector('[data-testid="route-run"]'));

    expect(
      document.querySelector('[data-testid="deferred-title"]')?.textContent,
    ).toContain("Deferred to a later day (1)");
    expect(document.body.textContent).toContain(
      "Not visited on this configured day — the fleet or shift limit ran out first",
    );

    // Fixture reason: "minimum round trip exceeds max_shift_minutes" → shift
    // sentence; the raw code stays in the row's title attribute.
    const row = document.querySelector('[data-testid="deferred-row"]') as HTMLElement | null;
    expect(row?.getAttribute("title")).toContain("max_shift_minutes");
    expect(row?.textContent).toContain(
      "does not fit into a truck's daily shift",
    );

    // No red "engine failure" styling: deferred is neutral, never an error.
    expect(document.querySelector('[data-testid="deferred-list"]')?.className).not.toContain(
      "red",
    );
  });

  it("renders the real captured route: deferred rows with the fleet-capacity sentence", async () => {
    stubRoutes({
      "POST /api/route": () => jsonResponse(realRouteCapture),
      "POST /api/scenarios": () => jsonResponse(scenariosFixture),
    });
    renderRoutePanel({ defaultAsOf: "2026-09-30" });
    await flushMount();
    await click(document.querySelector('[data-testid="route-run"]'));

    const rows = document.querySelectorAll('[data-testid="deferred-row"]');
    expect(rows.length).toBe(424);
    // Real-capture reason: "no feasible insertion within the available fleet
    // (3 vehicles)…" → the no-capacity-left-on-this-day sentence.
    expect(rows[0]?.textContent).toContain(
      "No truck had free capacity or shift time left",
    );
    expect(rows[0]?.getAttribute("title")).toContain("no feasible insertion");
    // Insight title in plain words (no "unserved" failure framing).
    expect(document.body.textContent).toContain("serve 34 of 458 selected stops on this day");
    expect(document.body.textContent).toContain("424 deferred to a later day");
  });

  it("renders German labels with parity", async () => {
    stubRoutes(routeRoutes());
    renderRoutePanel({ lang: "de" });
    await flushMount();

    // Static purpose title before a solve (afterwards the data-generated
    // DE insight sentence replaces it — asserted below).
    expect(document.body.textContent).toContain("Ein Sammeltag, optimiert");
    await click(document.querySelector('[data-testid="route-run"]'));
    expect(document.querySelector('[data-testid="deferred-title"]')?.textContent).toContain(
      "Auf einen späteren Tag verschoben (1)",
    );
    const row = document.querySelector('[data-testid="deferred-row"]') as HTMLElement | null;
    expect(row?.textContent).toContain("tägliche Schicht eines Lkw");
    expect(document.querySelector('[data-testid="route-link"]')?.textContent).toContain(
      "Der Tagesplan liegt unter Szenarien",
    );
  });

  it("renders the all-served empty note", async () => {
    const allServed: RouteResponse = {
      ...routeResponseFixture,
      solution: { ...routeResponseFixture.solution, unserved: [] },
    };
    stubRoutes({
      "POST /api/route": () => jsonResponse(allServed),
      "POST /api/scenarios": () => jsonResponse(scenariosFixture),
    });
    renderRoutePanel();
    await flushMount();
    await click(document.querySelector('[data-testid="route-run"]'));

    expect(document.querySelector('[data-testid="deferred-none"]')?.textContent).toContain(
      "All selected stops are served on this day.",
    );
  });
});

describe("deferredReasonText — every backend reason phrase maps (EN/DE, fail-safe)", () => {
  const CASES: Array<[string, string]> = [
    [
      "no feasible insertion within the available fleet (3 vehicles) and the configured capacity/shift limits",
      "No truck had free capacity or shift time left",
    ],
    [
      "shift_limit_exceeded: minimum collection round trip takes 300 min, exceeding max_shift_minutes 480 min",
      "does not fit into a truck's daily shift",
    ],
    [
      "minimum round trip exceeds max_shift_minutes",
      "does not fit into a truck's daily shift",
    ],
    [
      "collected volume 3200 L of brown exceeds the largest compartment capacity 2500 L for that material",
      "exceeds the largest truck compartment",
    ],
    [
      "collected weight 900 kg exceeds the largest vehicle weight capacity 800 kg",
      "exceeds the largest truck weight capacity",
    ],
    [
      "fleet_exhausted: all 3 vehicles reached max_shift_minutes 480 min with stops remaining in fixed order",
      "All configured trucks reached their shift limit",
    ],
    ["hosted_demo_stop_cap", "Demo display limit"],
  ];

  it("maps every known reason phrase to its plain sentence (EN + DE)", () => {
    for (const [raw, enNeedle] of CASES) {
      expect(deferredReasonText("en", raw)).toContain(enNeedle);
      expect(deferredReasonText("de", raw)).not.toBe(raw); // translated, not raw
    }
  });

  it("renders an unknown reason verbatim (fail-safe, never genericised)", () => {
    const weird = "totally new backend reason phrase";
    expect(deferredReasonText("en", weird)).toBe(weird);
    expect(deferredReasonText("de", weird)).toBe(weird);
  });
});

describe("RoutePanel — existing states preserved", () => {
  it("renders solver status, totals with units, fleet recommendation and deferred reasons", async () => {
    const fetchMock = stubRoutes(routeRoutes());
    renderRoutePanel();
    await flushMount();
    await click(document.querySelector('[data-testid="route-run"]'));

    const routeCalls = fetchMock.mock.calls.filter(
      ([, init]) => typeof init?.body === "string" && init.body.includes("as_of_date"),
    );
    expect(String(routeCalls[0]?.[0])).toBe("/api/route");

    expect(document.querySelector('[data-testid="solve-status"]')?.textContent).toContain(
      "feasible",
    );
    const totals = document.querySelector('[data-testid="route-totals"]')?.textContent ?? "";
    expect(totals).toContain("18,400 m (18.4 km)");
    expect(totals).toContain("95 min");
    expect(totals).toContain("1,200 L");
    expect(totals).toContain("600 kg");
    expect(totals).toContain("2 of 3");
    expect(totals).toContain("1 vehicle(s)");
    expect(totals).toContain("by volume");
    // M18 ③ §4.8 fleet separation: the recommendation is a solver input.
    expect(totals).toContain("[demo assumption — solver input]");

    // Load progression + straight-line provenance never pass as road distance.
    expect(document.body.textContent).toContain("1,200 L / 600 kg");
    expect(document.body.textContent).toContain("NOT road distance");

    // v3 cost block + per-material volumes (fixture: 1 truck, brown only).
    const cost = document.querySelector('[data-testid="route-cost"]')?.textContent ?? "";
    expect(cost).toContain("1 vehicle(s)");
    expect(cost).toContain("500 EUR/day · 100,000 EUR/year");
    expect(cost).toContain("not invoiced");
    expect(cost).not.toContain("recommended truck(s)");
    const details = document.querySelector('[data-testid="route-tech-details"]')?.textContent ?? "";
    expect(details).toContain("recommended truck(s)");
    expect(details).toContain("500 EUR/day · 100,000 EUR/year"); // fleet cost rows
    expect(details).toContain("[demo assumption — solver input]");
    // M18 ⑫: objective value carries its unit.
    expect(details).toContain("18,400 m");
    const volumes = document.querySelector('[data-testid="route-volumes-by-material"]')?.textContent ?? "";
    expect(volumes).toContain("1,200 L");
    expect(document.querySelector('[data-testid="route-travel-time-mode"]')?.textContent).toContain(
      "fixed_per_leg",
    );

    // Assumptions surfaced to the parent for the synthetic-data banner (§5.3).
    expect(routeCalls.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * Regression (review 2026-11-14; regenerated for v3): renders the VERBATIM
   * real backend route response (POST /api/route, real CSV upload, as_of
   * 2026-09-30, v3 defaults incl. solver_solution_limit=200). Real wire
   * shapes: FLAT unserved {location_id, material_type, reason}, load_
   * progression as [volume, weight] TUPLE arrays, v3 cost block +
   * collected_volume_by_material + travel_time_mode echo.
   */
  it("renders the real captured v3 route: 424 deferred with reasons, cost block, per-material volumes", async () => {
    stubRoutes({
      "POST /api/route": () => jsonResponse(realRouteCapture),
      "POST /api/scenarios": () => jsonResponse(scenariosFixture),
    });
    renderRoutePanel({ defaultAsOf: "2026-09-30" });
    await flushMount();
    await click(document.querySelector('[data-testid="route-run"]'));

    expect(document.querySelector('[data-testid="solve-status"]')?.textContent).toContain(
      "feasible",
    );
    const totals = document.querySelector('[data-testid="route-totals"]')?.textContent ?? "";
    expect(totals).toContain("70,175 m (70.2 km)");
    expect(totals).toContain("580 min");
    expect(totals).toContain("45,000 L");
    expect(totals).toContain("22,500 kg");
    expect(totals).toContain("34 of 458");
    expect(totals).toContain("demo_truck");
    expect(totals).toContain("99 vehicle(s)");

    const cost = document.querySelector('[data-testid="route-cost"]')?.textContent ?? "";
    expect(cost).toContain("3 vehicle(s)");
    expect(cost).toContain("1,500 EUR/day · 300,000 EUR/year");
    expect(cost).not.toContain("49,500 EUR/day");
    const details = document.querySelector('[data-testid="route-tech-details"]')?.textContent ?? "";
    expect(details).toContain("49,500 EUR/day · 9,900,000 EUR/year"); // fleet cost rows
    expect(details).toContain("99 recommended truck(s)");

    const volumes = document.querySelector('[data-testid="route-volumes-by-material"]')?.textContent ?? "";
    expect(volumes).toContain("brown");
    expect(volumes).toContain("15,000 L");
    expect(details).toContain("fixed_per_leg");

    const rows = document.querySelectorAll('[data-testid="deferred-row"]');
    expect(rows.length).toBe(424);

    // Tuple load progression renders with units: "2,700 L / 1,350 kg".
    expect(document.body.textContent).toContain("2,700 L / 1,350 kg");
  });

  it("warns (but does not hide) when the solver returns infeasible", async () => {
    const degraded: RouteResponse = {
      ...routeResponseFixture,
      solution: {
        ...routeResponseFixture.solution,
        status: "infeasible",
        routes: [],
        totals: { ...routeResponseFixture.solution.totals, stops_served: 0 },
      },
    };
    stubRoutes({
      "POST /api/route": () => jsonResponse(degraded),
      "POST /api/scenarios": () => jsonResponse(scenariosFixture),
    });
    renderRoutePanel();
    await flushMount();
    await click(document.querySelector('[data-testid="route-run"]'));

    expect(document.querySelector('[data-testid="degraded-status"]')?.textContent).toContain(
      "infeasible",
    );
    expect(
      document.querySelector('[data-testid="deferred-list"]')?.textContent,
    ).toContain("daily shift");
  });
});
