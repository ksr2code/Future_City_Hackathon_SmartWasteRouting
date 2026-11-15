/**
 * PresentationMode (W5 + §6 v5, M17-P5b visual-first) tests: the 6 slides
 * render charts + numbers from the bundled capture bundle with ZERO fetches
 * (global fetch is stubbed to a spy that is asserted never-called); wording
 * says "precalculated from real data (captured …)", never "live API";
 * ←/→ navigation and Esc close; honesty labels on every slide ([observed]/
 * [predicted]/illustration/simulation basis); renamed strategy labels
 * (demand_driven → "Demand-driven, same-day (no spacing)", day_spread →
 * "Our plan: demand-driven + day spreading"); a missing/invalid bundle
 * renders a visible error — never an endless spinner or fabricated numbers;
 * EN/DE parity. Recharts renders with fixed width/height, so SVG bars/lines
 * exist in jsdom.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { act } from "react";
import { PresentationMode } from "./PresentationMode";
import { loadPresentationBundle } from "../lib/presentationData";
import { cleanup, render } from "../test/dom";

vi.mock("../lib/presentationData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/presentationData")>();
  return { ...actual, loadPresentationBundle: vi.fn(actual.loadPresentationBundle) };
});

const loadMock = vi.mocked(loadPresentationBundle);

beforeEach(() => {
  loadMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Advance/collapse via the window-level key handler (inside act). */
async function pressKey(key: string): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

/** Stub fetch as a spy — the §6 v5 rule is that it must NEVER be called. */
function forbidFetch(): Mock {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

describe("PresentationMode — slides render from the bundle, zero fetches", () => {
  it("opens on slide 1 with the capture-date basis, never 'live API' wording", () => {
    const fetchSpy = forbidFetch();
    const onClose = vi.fn();
    render(<PresentationMode lang="en" summary={null} onClose={onClose} />);

    const text = document.body.textContent ?? "";
    expect(document.querySelector('[data-testid="presentation-root"]')).not.toBeNull();
    expect(text).toContain("Step 1 of 6");
    expect(text).toContain("Why we are here");
    // §6 v5 wording: precalculated + capture date, never "live".
    expect(text).toContain("precalculated from real data (captured 2026-11-15)");
    expect(text).not.toMatch(/live API/i);
    expect(text).toContain("← → to navigate");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("slide 2 draws the observed visits-per-day chart with the median line [observed]", async () => {
    const fetchSpy = forbidFetch();
    render(<PresentationMode lang="en" summary={null} onClose={() => {}} />);
    await pressKey("ArrowRight");

    const text = document.body.textContent ?? "";
    expect(text).toContain("Step 2 of 6");
    expect(text).toContain("Observed today");
    expect(text).toContain("34.5 %"); // summary.fill_stats (capture)
    // Chart from simulation.observed_days: 229 active-day bars, median 51.
    const chart = document.querySelector('[data-testid="s2-observed-chart"]');
    expect(chart).not.toBeNull();
    expect(chart?.querySelectorAll("svg")).toHaveLength(1);
    expect(chart?.querySelectorAll(".recharts-bar-rectangle").length).toBe(229);
    expect(text).toContain("median 51 per active day"); // computed from capture
    expect(text).toContain("Emptying visits per day [observed]"); // caption label
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("slide 3 shows the labelled illustration fill curve + days-to-full histogram", async () => {
    forbidFetch();
    render(<PresentationMode lang="en" summary={null} onClose={() => {}} />);
    await pressKey("ArrowRight");
    await pressKey("ArrowRight");

    const text = document.body.textContent ?? "";
    expect(text).toContain("Step 3 of 6");
    expect(text).toContain("How it works");
    const curve = document.querySelector('[data-testid="s3-fill-curve"]');
    expect(curve).not.toBeNull();
    expect(curve?.querySelectorAll(".recharts-line-curve").length).toBe(1);
    // Honesty: the schematic is explicitly NOT data.
    expect(text).toContain("Illustration — not data");
    expect(text).toContain("80 %");
    // Histogram from days_to_full capture: chart + series count.
    const hist = document.querySelector('[data-testid="s3-histogram"]');
    expect(hist).not.toBeNull();
    expect(hist?.querySelectorAll(".recharts-bar-rectangle").length).toBe(7); // bins
    expect(text).toContain("Predicted days to full");
    expect(text).toContain("1,303 series [predicted]"); // capture: series with estimate
    // Mandatory §1.5 caveat stays.
    expect(text).toContain("not how fast it would have filled");
    expect(text).toContain("predicted from emptying records");
  });

  it("slide 4 draws the trap: daily truck-days for both strategies with renamed labels", async () => {
    forbidFetch();
    render(<PresentationMode lang="en" summary={null} onClose={() => {}} />);
    await pressKey("ArrowRight");
    await pressKey("ArrowRight");
    await pressKey("ArrowRight");

    const text = document.body.textContent ?? "";
    expect(text).toContain("Step 4 of 6");
    expect(text).toContain("The trap: same-day service clusters the trucks");
    const chart = document.querySelector('[data-testid="s4-trap-chart"]');
    expect(chart).not.toBeNull();
    expect(chart?.querySelectorAll(".recharts-line-curve").length).toBe(2);
    // Renamed display labels (ids unchanged).
    expect(text).toContain("Fixed cycle (status quo) [predicted]");
    expect(text).toContain("Demand-driven, same-day (no spacing) [predicted]");
    // The explanation caption + simulation basis (§6).
    expect(text).toContain("truck-days pile up in spikes");
    expect(text).toContain("simulation on observed rates — not a prediction");
  });

  it("slide 5 draws the money story: cost bars, derived savings, service beside cost", async () => {
    const fetchSpy = forbidFetch();
    render(<PresentationMode lang="en" summary={null} onClose={() => {}} />);
    for (let i = 0; i < 4; i += 1) await pressKey("ArrowRight");

    const text = document.body.textContent ?? "";
    expect(text).toContain("Step 5 of 6");
    expect(text).toContain("Our plan — the money story");
    const chart = document.querySelector('[data-testid="s5-cost-chart"]');
    expect(chart).not.toBeNull();
    expect(chart?.querySelectorAll(".recharts-bar-rectangle").length).toBe(2);
    expect(text).toContain("261,500 EUR"); // observed_baseline (capture)
    expect(text).toContain("171,000 EUR"); // day_spread plan (capture)
    expect(text).toContain("Our plan: demand-driven + day spreading"); // renamed label
    expect(text).toContain("≈ 90,500 EUR lower (−34.6 % cost, derived) — with better service.");
    expect(text).toContain("Truck-days: 523 → 342");
    expect(text).toContain("Trucks per day: typical 1 · peak 1"); // capture aggregates
    expect(text).toContain("26.9 %"); // observed anchor beside cost (§6)
    expect(text).toContain("0.0 %"); // simulated overflow
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("slide 6 shows the three derived outcomes + capture-date basis", async () => {
    forbidFetch();
    render(<PresentationMode lang="en" summary={null} onClose={() => {}} />);
    for (let i = 0; i < 5; i += 1) await pressKey("ArrowRight");

    const text = document.body.textContent ?? "";
    expect(text).toContain("Step 6 of 6");
    expect(text).toContain("What this means");
    expect(document.querySelector('[data-testid="s6-outcome-cost"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="s6-outcome-eur"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="s6-outcome-service"]')).not.toBeNull();
    expect(text).toContain("−34.6 %"); // derived
    expect(text).toContain("−90,500 EUR"); // derived
    expect(text).toContain("0.0 %"); // simulated overflow
    expect(text).toContain("26.9 %"); // observed anchor
    expect(text).toContain("captured 2026-11-15"); // capture-date footer/basis
    expect(text).toContain("never a measurement");
  });

  it("ArrowLeft returns; Esc closes; navigation is bounded at the last slide", async () => {
    forbidFetch();
    const onClose = vi.fn();
    render(<PresentationMode lang="en" summary={null} onClose={onClose} />);

    for (let i = 0; i < 10; i += 1) await pressKey("ArrowRight");
    expect(document.body.textContent ?? "").toContain("Step 6 of 6");
    const next = document.querySelector(
      '[data-testid="presentation-next"]',
    ) as HTMLButtonElement | null;
    expect(next?.disabled).toBe(true);

    await pressKey("ArrowLeft");
    expect(document.body.textContent ?? "").toContain("Step 5 of 6");

    await pressKey("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders German strings with parity (slides 1, 2, 5)", async () => {
    forbidFetch();
    render(<PresentationMode lang="de" summary={null} onClose={() => {}} />);

    let text = document.body.textContent ?? "";
    expect(text).toContain("Schritt 1 von 6");
    expect(text).toContain("Warum wir hier sind");
    expect(text).toContain("aus echten Daten vorberechnet (erfasst am 2026-11-15)");
    expect(text).not.toMatch(/API-Antworten/);

    await pressKey("ArrowRight");
    text = document.body.textContent ?? "";
    expect(text).toContain("Leerungs-Besuche pro Tag [beobachtet]");
    expect(text).toContain("Median 51 pro aktivem Tag");

    await pressKey("ArrowRight");
    text = document.body.textContent ?? "";
    expect(text).toContain("Wie es funktioniert");
    expect(text).toContain("Illustration — keine Daten");

    await pressKey("ArrowRight");
    text = document.body.textContent ?? "";
    expect(text).toContain("Die Falle: Same-Day-Service bündelt die Lkw");
    expect(text).toContain("Bedarfsorientiert, gleicher Tag (ohne Staffelung) [Prognose]");

    await pressKey("ArrowRight");
    text = document.body.textContent ?? "";
    expect(text).toContain("Schritt 5 von 6");
    expect(text).toContain("Unser Plan — die Geld-Geschichte");
    expect(text).toContain("Unser Plan: bedarfsorientiert + Tagesverteilung");
    expect(text).toContain("Lkw-Tage: 523 → 342");
    expect(text).toContain("niedriger (−34.6 % Kosten, abgeleitet) — bei besserem Service.");
  });
});

describe("PresentationMode — missing/invalid bundle (§6 v5: visible error, never spinner)", () => {
  it("missing capture → visible error with detail, no loading note, no numbers", () => {
    loadMock.mockReturnValueOnce({
      status: "error",
      reason: "missing",
      detail: "comparison, simulation",
    });
    forbidFetch();
    render(<PresentationMode lang="en" summary={null} onClose={() => {}} />);

    const text = document.body.textContent ?? "";
    expect(document.querySelector('[data-testid="presentation-error"]')).not.toBeNull();
    expect(text).toContain("Bundled presentation data is missing or invalid");
    expect(text).toContain("comparison, simulation");
    expect(text).not.toContain("Loading");
    expect(text).not.toContain("34.5 %");
    expect(text).not.toContain("261,500 EUR");
  });

  it("invalid capture → same visible error path with the validator detail", () => {
    loadMock.mockReturnValueOnce({
      status: "error",
      reason: "invalid",
      detail: "simulation.observed_days: no per-day observed visit counts",
    });
    forbidFetch();
    render(<PresentationMode lang="en" summary={null} onClose={() => {}} />);

    const text = document.body.textContent ?? "";
    expect(document.querySelector('[data-testid="presentation-error"]')).not.toBeNull();
    expect(text).toContain("simulation.observed_days");
    expect(text).not.toContain("34.5 %");
  });

  it("Esc still closes on the error state", async () => {
    loadMock.mockReturnValueOnce({ status: "error", reason: "missing", detail: "summary" });
    forbidFetch();
    const onClose = vi.fn();
    render(<PresentationMode lang="en" summary={null} onClose={onClose} />);

    await pressKey("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
