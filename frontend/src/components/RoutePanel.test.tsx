import { afterEach, describe, expect, it, vi } from "vitest";
import { RoutePanel } from "./RoutePanel";
import type { RouteResponse } from "../lib/api";
import { click, cleanup, jsonResponse, render } from "../test/dom";
import { routeResponseFixture } from "../test/fixtures";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RoutePanel", () => {
  it("renders solver status, totals with units, fleet recommendation and unserved reasons", async () => {
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
        jsonResponse(routeResponseFixture),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onRoute = vi.fn();

    render(
      <RoutePanel
        defaultAsOf="2026-10-31"
        policyOverride={{}}
        routingOverride={{}}
        onRoute={onRoute}
      />,
    );
    await click(document.querySelector('[data-testid="route-run"]'));

    const [url] = fetchMock.mock.calls[0] as [RequestInfo | URL];
    expect(String(url)).toBe("/api/route");

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

    const unserved = document.querySelector('[data-testid="unserved-list"]')?.textContent ?? "";
    expect(unserved).toContain("11111111-2222-3333-4444-555555555555 · white");
    expect(unserved).toContain("max_shift_minutes");

    // Load progression + straight-line provenance never pass as road distance.
    expect(document.body.textContent).toContain("1,200 L / 600 kg");
    expect(document.body.textContent).toContain("NOT road distance");

    // Assumptions surfaced to the parent for the synthetic-data banner (§5.3).
    expect(onRoute).toHaveBeenCalledWith(routeResponseFixture);
    expect((onRoute.mock.calls[0]?.[0] as RouteResponse).assumptions.length).toBe(2);
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
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(degraded)));

    render(
      <RoutePanel
        defaultAsOf="2026-10-31"
        policyOverride={{}}
        routingOverride={{}}
        onRoute={vi.fn()}
      />,
    );
    await click(document.querySelector('[data-testid="route-run"]'));

    expect(document.querySelector('[data-testid="degraded-status"]')?.textContent).toContain(
      "infeasible",
    );
    expect(document.querySelector('[data-testid="unserved-list"]')?.textContent).toContain(
      "max_shift_minutes",
    );
  });
});
