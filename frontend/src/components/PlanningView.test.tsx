/**
 * PlanningView tests (M20 Forecast→Planning redesign). Fetches are stubbed by
 * "METHOD path" — unexpected calls throw. Fixtures: daysToFullFixture is
 * traced to the real v4/days_to_full.json capture (brown row: 43.2 d, lower
 * bound, predicted_full_date 2026-10-23 = overdue vs the real clock); the
 * forecast/selection fixtures are labelled synthetic. Threshold KPI comes
 * from the config prop — never hardcoded.
 */
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { PlanningView } from "./PlanningView";
import { cleanup, click, flush, jsonResponse, render, setSelectValue } from "../test/dom";
import {
  daysToFullFixture,
  forecastFixture,
  selectionFixture,
} from "../test/fixtures";

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

function happyRoutes(): Record<string, (args: FetchArgs) => Response> {
  return {
    "GET /api/days-to-full": () => jsonResponse(daysToFullFixture),
    "POST /api/forecasts": () => jsonResponse(forecastFixture),
    "POST /api/candidates": () => jsonResponse(selectionFixture),
  };
}

function renderPlanning(overrides: Partial<Parameters<typeof PlanningView>[0]> = {}): HTMLElement {
  return render(
    <PlanningView
      lang="en"
      defaultAsOf="2026-10-31"
      policyOverride={{}}
      selectThresholdPct={80}
      datasetVersion={0}
      {...overrides}
    />,
  );
}

describe("PlanningView — purpose header + auto-fetch", () => {
  it("auto-fetches both estimates on mount and renders KPI values from the responses", async () => {
    const fetchMock = stubRoutes(happyRoutes());
    renderPlanning();
    await flush();
    await flush();

    const keys = fetchMock.mock.calls.map(
      ([raw, init]) => `${init?.method ?? "GET"} ${String(raw)}`,
    );
    expect(keys).toContain("GET /api/days-to-full");
    expect(keys).toContain("POST /api/forecasts");

    // KPI strip: median 59.3 d, lower-bound 66.5 %, threshold count 2 of 3
    // forecasts ≥ 80 (prop-driven), overdue 1 (brown row predicted 2026-10-23).
    expect(document.querySelector('[data-testid="kpi-median"]')?.textContent).toContain("59.3 d");
    expect(document.querySelector('[data-testid="kpi-median"]')?.textContent).toContain(
      "1,303 of 1,338",
    );
    expect(document.querySelector('[data-testid="kpi-lowerbound"]')?.textContent).toContain(
      "66.5 %",
    );
    expect(document.querySelector('[data-testid="kpi-threshold"]')?.textContent).toContain(
      "predicted ≥ 80 %",
    );
    expect(document.querySelector('[data-testid="kpi-threshold"]')?.textContent).toMatch(/^2/);
    expect(document.querySelector('[data-testid="kpi-overdue"]')?.textContent).toMatch(/^1/);

    // Histogram renders from the API series (1 estimate in the fixture).
    expect(document.querySelector('[data-testid="planning-histogram"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="chart-dtf-histogram"]')).not.toBeNull();
  });

  it("hides the threshold KPI when no config threshold is available (never hardcodes 80)", async () => {
    stubRoutes(happyRoutes());
    renderPlanning({ selectThresholdPct: null });
    await flush();
    await flush();

    expect(document.querySelector('[data-testid="kpi-threshold"]')).toBeNull();
    expect(document.querySelector('[data-testid="kpi-median"]')).not.toBeNull();
  });

  it("renders the empty state (no fetches) without a dataset", async () => {
    const fetchMock = stubRoutes(happyRoutes());
    renderPlanning({ defaultAsOf: null });
    await flush();
    await flush();

    expect(fetchMock.mock.calls.length).toBe(0);
    expect(document.querySelector('[data-testid="planning-kpis"]')).toBeNull();
    expect(document.body.textContent).toContain("Pick as-of date + horizon and run");
  });

  it("renders an error state when the days-to-full fetch fails (never crashes)", async () => {
    stubRoutes({
      ...happyRoutes(),
      "GET /api/days-to-full": () => jsonResponse({ detail: "boom" }, 500),
    });
    renderPlanning();
    await flush();
    await flush();

    expect(document.body.textContent).toContain("Candidate selection failed");
    expect(document.querySelector('[data-testid="planning-view"]')).not.toBeNull();
  });

  it("renders an error state on a malformed forecast payload (never crashes)", async () => {
    stubRoutes({
      ...happyRoutes(),
      "POST /api/forecasts": () => jsonResponse({ status: "ok" }),
    });
    renderPlanning();
    await flush();
    await flush();

    expect(document.body.textContent).toContain("Candidate selection failed");
    expect(document.querySelector('[data-testid="planning-view"]')).not.toBeNull();
  });
});

describe("PlanningView — 'Filling next' table", () => {
  it("lists series with dates in ascending order, marks lower bounds and overdue rows", async () => {
    stubRoutes(happyRoutes());
    renderPlanning();
    await flush();
    await flush();

    const rows = document.querySelectorAll('[data-testid="filling-next-rows"] tr');
    expect(rows.length).toBe(1); // fixture: 1 series with a predicted_full_date
    const row = rows[0]?.textContent ?? "";
    // Brown row: last fill 20 %, lower-bound "≥" marker, 43.2 d, overdue badge.
    expect(row).toContain("20 %");
    expect(row).toContain("≥ 43.2 d");
    expect(row).toContain("2026-10-23");
    expect(document.querySelector('[data-testid="overdue-badge"]')).not.toBeNull();
    // Excluded note: the white row without a date is excluded, never dropped silently.
    expect(document.body.textContent).toContain("excluded");
  });
});

describe("PlanningView — method labels + TechDetails", () => {
  it("shows plain-language method options and the evaluation sentence (EN)", async () => {
    stubRoutes(happyRoutes());
    renderPlanning();
    await flush();
    await flush();

    const select = document.querySelector('[data-testid="method-select"]');
    expect(select).not.toBeNull();
    const options = Array.from(select?.querySelectorAll("option") ?? []).map((o) => o.textContent);
    expect(options).toContain("Last measured level holds (persistence)");
    expect(options).toContain("Fill-speed trend (rate)");

    // TechDetails: both method sentences + the honest evaluation numbers.
    const tech = document.querySelector('[data-testid="tech-details"]')?.textContent ?? "";
    expect(tech).toContain("test MAE 22.8 vs 25.8 percentage points");
    expect(tech).toContain("[evaluation on real data]");
  });

  it("shows German labels with parity", async () => {
    stubRoutes(happyRoutes());
    renderPlanning({ lang: "de" });
    await flush();
    await flush();

    expect(document.body.textContent).toContain("Welche Behälter sind bald voll, und wann?");
    const options = Array.from(
      document.querySelectorAll('[data-testid="method-select"] option'),
    ).map((o) => o.textContent);
    expect(options).toContain("Zuletzt gemessener Stand hält (Persistence)");
    expect(options).toContain("Füllgeschwindigkeits-Trend (Rate)");
    const tech = document.querySelector('[data-testid="tech-details"]')?.textContent ?? "";
    expect(tech).toContain("Test-MAE 22,8 vs. 25,8 Prozentpunkte");
    expect(tech).toContain("[Bewertung an echten Daten]");
  });
});

describe("PlanningView — run flow (forecast + candidates)", () => {
  it("runs both endpoints with the form params and renders selection tables with reason badges", async () => {
    const fetchMock = stubRoutes(happyRoutes());
    renderPlanning();
    await flush();
    await flush();

    // Switch method to rate, then run.
    const select = document.querySelector('[data-testid="method-select"]');
    expect(select).not.toBeNull();
    await setSelectValue(select!, "rate");
    await click(document.querySelector('[data-testid="planning-run"]'));
    await flush();
    await flush();

    const runCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    const bodies = runCalls.map(([, init]) => JSON.parse(init?.body as string));
    expect(bodies.filter((b) => b.method === "rate").length).toBe(2); // forecasts + candidates
    const candidatesBody = runCalls
      .map(([, init]) => JSON.parse(init?.body as string))
      .find((b) => b.policy_config !== undefined);
    expect(candidatesBody.as_of_date).toBe("2026-10-31");
    expect(candidatesBody.horizon_days).toBe(28);

    // Selection tables: 2 selected, 1 skipped (fixture), reason badges render.
    expect(document.querySelectorAll('[data-testid="selected-rows"] tr').length).toBe(2);
    expect(document.querySelectorAll('[data-testid="skipped-rows"] tr').length).toBe(1);
    expect(document.querySelectorAll('[data-testid="reason-badge"]').length).toBe(3);
    expect(document.body.textContent).toContain("Selected (2)");
    expect(document.body.textContent).toContain("Skipped (1)");
    // Policy echo from the API response, not local state.
    expect(document.body.textContent).toContain("threshold 80 %");
  });

  it("renders a 422 validation error message from the API", async () => {
    stubRoutes({
      ...happyRoutes(),
      "POST /api/candidates": () => jsonResponse({ detail: "horizon must be ≥ 1" }, 422),
    });
    renderPlanning();
    await flush();
    await flush();
    await click(document.querySelector('[data-testid="planning-run"]'));
    await flush();
    await flush();

    expect(document.body.textContent).toContain("Candidate selection failed");
    expect(document.body.textContent).toContain("horizon must be ≥ 1");
  });
});
