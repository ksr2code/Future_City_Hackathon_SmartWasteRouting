import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  loadPresentationBundle,
  type PresentationBundleResult,
} from "../lib/presentationData";
import { t, tf, type Lang, type TranslationKey } from "../lib/i18n";

/**
 * W5 (M16 v4) + §6 v5 presentation data mode (M17-P5b): 6 slides, big type,
 * ←/→ navigation, Esc closes, native fullscreen (requestFullscreen,
 * gracefully caught). Visual-first: charts render from the bundled captures
 * (Recharts, fixed sizes — no ResponsiveContainer so jsdom renders them too).
 *
 * Data source: **bundled verbatim API captures** precalculated from the real
 * dataset (capture date in the bundle) — ZERO live network calls while
 * presenting. Slide wording says "precalculated from real data (captured
 * YYYY-MM-DD)", never "live". Loading is bounded: a missing capture fails the
 * build; an invalid capture yields a visible error slide — never an endless
 * spinner. Honesty rules (§6) hold on EVERY slide: labels ([observed]/
 * [predicted]/simulation basis, illustration) are never hidden; a slide
 * whose data is somehow absent renders an explicit "data not available"
 * note — never a fabricated value or a hard-coded figure. The only drawn
 * non-capture series is the s3 fill curve, explicitly labelled
 * "illustration — not data".
 */

const STEP_COUNT = 6;

export interface PresentationModeProps {
  lang: Lang;
  /**
   * Ignored since §6 v5: the presentation reads the bundled capture bundle
   * (self-contained, offline), not app state. Kept only for Overview call
   * compatibility.
   */
  summary: unknown;
  onClose: () => void;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Basis label shown on every data slide (§6 vocabulary). */
function BasisLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-base text-amber-200" data-testid="presentation-basis">
      {children}
    </p>
  );
}

/**
 * s3 fill curve — schematic illustration ONLY (labelled on the slide): fill
 * rises to the 80 % trigger, container is emptied (reset to 0), twice. Not
 * capture data; deterministic so tests can assert the sawtooth shape.
 */
const FILL_CURVE = Array.from({ length: 56 }, (_, i) => ({
  day: i + 1,
  fill: Math.round(((i % 28) / 28) * 80),
}));

/** s3 days-to-full histogram bins (days) — evaluated in order, value ≤ max. */
const HIST_BINS: Array<{ labelKey: string; max: number }> = [
  { labelKey: "presentation.s3.bin30", max: 30 },
  { labelKey: "presentation.s3.bin60", max: 60 },
  { labelKey: "presentation.s3.bin90", max: 90 },
  { labelKey: "presentation.s3.bin120", max: 120 },
  { labelKey: "presentation.s3.bin180", max: 180 },
  { labelKey: "presentation.s3.bin365", max: 365 },
  { labelKey: "presentation.s3.binMore", max: Number.POSITIVE_INFINITY },
];

export function PresentationMode({ lang, onClose }: PresentationModeProps) {
  const [step, setStep] = useState(0);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // §6 v5: bounded, synchronous load of the bundled captures — no network.
  const [load] = useState<PresentationBundleResult>(() => loadPresentationBundle());
  const bundle = load.status === "ok" ? load.bundle : null;

  // Native fullscreen — some environments (jsdom, denied permission) reject;
  // the presentation still works inline, so failures are caught, never fatal.
  useEffect(() => {
    const el = overlayRef.current;
    if (el !== null && typeof el.requestFullscreen === "function") {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  // ←/→ navigate, Esc closes (window-level so fullscreen keeps working).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setStep((s) => Math.min(STEP_COUNT - 1, s + 1));
      else if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  const fillStats = bundle?.summary.fill_stats ?? null;
  // §5.2.6 money story (centrepiece): observed baseline → day_spread plan.
  const moneyBaseline = bundle?.scenarios.observed_baseline ?? null;
  const moneySpread =
    bundle?.scenarios.strategies.find((s) => s.id === "day_spread") ?? null;
  const moneyAnchor =
    bundle?.scenarios.observed_anchor.share_full_or_overfull_pct ?? null;
  const moneySavedEur =
    moneyBaseline !== null &&
    moneySpread !== null &&
    moneySpread.cost_eur_total <= moneyBaseline.cost_eur_total
      ? moneyBaseline.cost_eur_total - moneySpread.cost_eur_total
      : null;
  const moneySavedPct =
    moneySavedEur !== null && moneyBaseline !== null && moneyBaseline.cost_eur_total > 0
      ? (moneySavedEur / moneyBaseline.cost_eur_total) * 100
      : null;

  // s2 observed timeline + median over active days (computed from the capture).
  const observedDays = bundle?.simulation.observed_days ?? [];
  const observedMedian = useMemo(() => {
    const active = observedDays.map((d) => d.collections).filter((c) => c > 0);
    if (active.length === 0) return null;
    const sorted = [...active].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }, [observedDays]);

  // s4 daily truck-days: both simulated strategies from the capture.
  const fixedDays = bundle?.simulation.strategies.find((s) => s.id === "fixed_frequency")?.days ?? [];
  const demandDays = bundle?.simulation.strategies.find((s) => s.id === "demand_driven")?.days ?? [];
  const trapRows = useMemo(
    () =>
      fixedDays.map((d, i) => ({
        day: i + 1,
        fixed: d.truck_days,
        demand: demandDays[i]?.truck_days ?? null,
      })),
    [fixedDays, demandDays],
  );

  // s3 days-to-full histogram from the capture's per-series estimates.
  const histogram = useMemo(() => {
    const series = bundle?.daysToFull.series ?? [];
    const counts = HIST_BINS.map((b) => ({ ...b, n: 0 }));
    let used = 0;
    for (const s of series) {
      const v = s.days_to_full;
      if (!isFiniteNumber(v)) continue;
      used += 1;
      const bin = counts.find((b) => v <= b.max);
      if (bin !== undefined) bin.n += 1;
    }
    return { counts, used };
  }, [bundle]);

  const stepTitleKey = (
    [
      "presentation.s1.title",
      "presentation.s2.title",
      "presentation.s3.title",
      "presentation.s4.title",
      "presentation.s5.title",
      "presentation.s6.title",
    ] as const
  )[step] as TranslationKey;

  const dataUnavailable = (
    <p className="mt-6 text-2xl text-amber-200" data-testid="presentation-unavailable">
      {t(lang, "presentation.unavailable")}
    </p>
  );

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex flex-col bg-slate-900 p-10 text-white"
      data-testid="presentation-root"
    >
      <header className="flex items-baseline justify-between">
        <p className="text-lg font-semibold uppercase tracking-wide text-sky-300">
          {tf(lang, "presentation.stepOf", { i: step + 1, n: STEP_COUNT })}
        </p>
        <div className="flex items-center gap-4">
          <p className="text-sm text-slate-300">{t(lang, "presentation.hint")}</p>
          <button
            type="button"
            onClick={onClose}
            data-testid="presentation-close"
            className="rounded border border-slate-500 px-3 py-1 text-sm font-medium hover:bg-slate-800"
          >
            {t(lang, "presentation.close")}
          </button>
        </div>
      </header>

      <main className="mt-8 flex-1 overflow-auto">
        {bundle === null ? (
          <div className="mt-6 max-w-4xl space-y-4" data-testid="presentation-error">
            <p className="text-3xl font-bold text-amber-200">
              {t(lang, "presentation.bundle.error")}
            </p>
            <p className="text-xl leading-relaxed text-slate-200">
              {tf(lang, "presentation.bundle.hint", {
                detail: load.status === "error" ? load.detail : "",
              })}
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-4xl font-bold">{t(lang, stepTitleKey)}</h2>

            {step === 0 ? (
              <div className="mt-6 max-w-4xl space-y-4">
                <p className="text-3xl leading-snug">{t(lang, "overview.headline")}</p>
                <p className="text-xl leading-relaxed text-slate-200">{t(lang, "overview.problem")}</p>
                <BasisLabel>
                  {tf(lang, "presentation.s1.basis", { date: bundle.captured })}
                </BasisLabel>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="mt-4 max-w-5xl space-y-3">
                {observedDays.length === 0 ? (
                  dataUnavailable
                ) : (
                  <>
                    {fillStats !== null && isFiniteNumber(fillStats.share_readings_full_or_above_pct) ? (
                      <p className="text-3xl font-bold">
                        {fillStats.share_readings_full_or_above_pct.toFixed(1)} %{" "}
                        <span className="text-lg font-normal text-slate-300">
                          {tf(lang, "presentation.s2.note", { thr: fillStats.threshold_pct })}
                        </span>
                      </p>
                    ) : null}
                    {/* Observed visits per day — bar chart from the capture. */}
                    <div className="rounded-lg bg-slate-800 p-3" data-testid="s2-observed-chart">
                      <BarChart width={880} height={300} data={observedDays}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" hide />
                        <YAxis stroke="#94a3b8" width={40} />
                        <Bar dataKey="collections" fill="#38bdf8" isAnimationActive={false} />
                        {observedMedian !== null ? (
                          <ReferenceLine
                            y={observedMedian}
                            stroke="#fbbf24"
                            label={{
                              value: tf(lang, "presentation.s2.median", {
                                n: observedMedian.toLocaleString("en-US"),
                              }),
                              fill: "#fbbf24",
                              position: "insideTopRight",
                            }}
                          />
                        ) : null}
                      </BarChart>
                    </div>
                    <p className="text-lg text-slate-300">{t(lang, "presentation.s2.chartCaption")}</p>
                    <BasisLabel>{t(lang, "presentation.s2.basis")}</BasisLabel>
                  </>
                )}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="mt-4 max-w-5xl space-y-3">
                <div className="flex flex-wrap items-start gap-6">
                  {/* Schematic fill curve — explicitly an illustration. */}
                  <div className="rounded-lg bg-slate-800 p-3" data-testid="s3-fill-curve">
                    <LineChart width={420} height={260} data={FILL_CURVE}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="day" hide />
                      <YAxis domain={[0, 100]} stroke="#94a3b8" width={40} />
                      <ReferenceLine
                        y={80}
                        stroke="#f87171"
                        label={{ value: "80 %", fill: "#f87171", position: "insideTopLeft" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="fill"
                        stroke="#38bdf8"
                        strokeWidth={3}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                    <p className="mt-1 text-sm text-amber-200">
                      {t(lang, "presentation.s3.illustration")} ·{" "}
                      {t(lang, "presentation.s3.fillTrigger")}
                    </p>
                  </div>
                  {/* Days-to-full histogram — from the days_to_full capture. */}
                  {histogram.used > 0 ? (
                    <div className="rounded-lg bg-slate-800 p-3" data-testid="s3-histogram">
                      <BarChart width={420} height={260} data={histogram.counts}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="labelKey" hide />
                        <YAxis stroke="#94a3b8" width={40} />
                        <Bar dataKey="n" fill="#34d399" isAnimationActive={false} />
                      </BarChart>
                      <p className="mt-1 text-sm text-slate-300">
                        {t(lang, "presentation.s3.histogramTitle")}{" "}
                        {tf(lang, "presentation.s3.histogramCount", {
                          n: histogram.used.toLocaleString("en-US"),
                        })}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {histogram.counts.map((b) => `${t(lang, b.labelKey as TranslationKey)}: ${b.n}`).join(" · ")}
                      </p>
                    </div>
                  ) : (
                    dataUnavailable
                  )}
                </div>
                <p className="text-lg leading-relaxed text-amber-200">
                  {bundle.daysToFull.assumptions[0] ?? ""}
                </p>
                <BasisLabel>{t(lang, "presentation.s3.basis")}</BasisLabel>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="mt-4 max-w-5xl space-y-3">
                {trapRows.length === 0 ? (
                  dataUnavailable
                ) : (
                  <>
                    {/* Daily truck-days: fixed cycle mega-days vs same-day clustering. */}
                    <div className="rounded-lg bg-slate-800 p-3" data-testid="s4-trap-chart">
                      <LineChart width={880} height={300} data={trapRows}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="day" hide />
                        <YAxis stroke="#94a3b8" width={40} />
                        <Line
                          type="monotone"
                          dataKey="fixed"
                          name={t(lang, "presentation.s4.legendFixed")}
                          stroke="#fbbf24"
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="demand"
                          name={t(lang, "presentation.s4.legendDemand")}
                          stroke="#38bdf8"
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                      <p className="mt-1 text-xs text-slate-400">
                        <span className="text-amber-300">—</span>{" "}
                        {t(lang, "presentation.s4.legendFixed")} ·{" "}
                        <span className="text-sky-300">—</span>{" "}
                        {t(lang, "presentation.s4.legendDemand")}
                      </p>
                    </div>
                    <p className="text-xl leading-relaxed text-slate-200">
                      {t(lang, "presentation.s4.caption")}
                    </p>
                    <BasisLabel>{t(lang, "presentation.s4.basis")}</BasisLabel>
                  </>
                )}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="mt-4 max-w-5xl space-y-3">
                {moneyBaseline !== null && moneySpread !== null ? (
                  <>
                    {/* Cost bars: observed baseline vs our plan (capture values). */}
                    <div className="flex flex-wrap items-start gap-6">
                      <div className="rounded-lg bg-slate-800 p-3" data-testid="s5-cost-chart">
                        <BarChart
                          width={460}
                          height={280}
                          data={[
                            {
                              name: t(lang, "overview.money.observedTitle"),
                              cost: moneyBaseline.cost_eur_total,
                              td: moneyBaseline.truck_days,
                            },
                            {
                              name: t(lang, "scenarios.spreadLabel"),
                              cost: moneySpread.cost_eur_total,
                              td: moneySpread.truck_days,
                            },
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="name" stroke="#94a3b8" width={80} />
                          <YAxis stroke="#94a3b8" width={70} />
                          <Bar dataKey="cost" fill="#38bdf8" isAnimationActive={false} />
                          <ReferenceLine
                            y={moneyBaseline.cost_eur_total}
                            stroke="#94a3b8"
                            strokeDasharray="4 4"
                          />
                        </BarChart>
                        <p className="mt-1 text-xs text-slate-400">{t(lang, "overview.toggle.costWindow")}</p>
                      </div>
                      <div className="max-w-sm space-y-2">
                        <p className="text-2xl text-slate-200">
                          <span className="font-bold text-slate-100">
                            {moneyBaseline.cost_eur_total.toLocaleString("en-US")} EUR
                          </span>{" "}
                          →{" "}
                          <span className="font-bold text-sky-300">
                            {moneySpread.cost_eur_total.toLocaleString("en-US")} EUR
                          </span>
                        </p>
                        {moneySavedEur !== null && moneySavedPct !== null ? (
                          <p className="text-3xl font-bold text-emerald-300" data-testid="s5-savings">
                            {tf(lang, "presentation.s5.saved", {
                              eur: moneySavedEur.toLocaleString("en-US"),
                              pct: `${moneySavedPct.toFixed(1)} %`,
                            })}
                          </p>
                        ) : null}
                        <p className="text-xl text-slate-200">
                          {tf(lang, "presentation.s5.truckDays", {
                            from: moneyBaseline.truck_days.toLocaleString("en-US"),
                            to: moneySpread.truck_days.toLocaleString("en-US"),
                          })}
                        </p>
                        {/* Trucks-per-day strip: aggregates from the capture, no fabricated daily series. */}
                        <p className="text-xl text-slate-200">
                          {tf(lang, "presentation.s5.trucksPerDay", {
                            typical:
                              isFiniteNumber(moneySpread.typical_trucks_per_day)
                                ? moneySpread.typical_trucks_per_day.toLocaleString("en-US")
                                : "—",
                            peak:
                              isFiniteNumber(moneySpread.peak_trucks_per_day)
                                ? moneySpread.peak_trucks_per_day.toLocaleString("en-US")
                                : "—",
                          })}
                        </p>
                        {/* §6: cost is never shown without its service level. */}
                        <p className="text-xl text-sky-200">
                          {t(lang, "overview.toggle.overflow")}:{" "}
                          {isFiniteNumber(moneySpread.service.overflow_share_pct)
                            ? `${moneySpread.service.overflow_share_pct.toFixed(1)} %`
                            : "— %"}{" "}
                          ·{" "}
                          {moneyAnchor !== null && isFiniteNumber(moneyAnchor)
                            ? tf(lang, "overview.toggle.anchor", {
                                pct: `${moneyAnchor.toFixed(1)} %`,
                              })
                            : null}
                        </p>
                      </div>
                    </div>
                    <BasisLabel>{t(lang, "presentation.s5.basis")}</BasisLabel>
                  </>
                ) : (
                  dataUnavailable
                )}
              </div>
            ) : null}

            {step === 5 ? (
              <div className="mt-6 max-w-5xl space-y-6">
                {moneySavedEur !== null &&
                moneySavedPct !== null &&
                moneySpread !== null &&
                moneyBaseline !== null ? (
                  <>
                    <div className="grid gap-8 md:grid-cols-3">
                      <div data-testid="s6-outcome-cost">
                        <p className="text-6xl font-bold text-emerald-300">
                          −{moneySavedPct.toFixed(1)} %
                        </p>
                        <p className="mt-2 text-xl text-slate-200">{t(lang, "presentation.s6.outcomeCost")}</p>
                      </div>
                      <div data-testid="s6-outcome-eur">
                        <p className="text-6xl font-bold text-emerald-300">
                          −{moneySavedEur.toLocaleString("en-US")} EUR
                        </p>
                        <p className="mt-2 text-xl text-slate-200">{t(lang, "presentation.s6.outcomeEur")}</p>
                      </div>
                      <div data-testid="s6-outcome-service">
                        <p className="text-6xl font-bold text-sky-300">
                          {isFiniteNumber(moneySpread.service.overflow_share_pct)
                            ? `${moneySpread.service.overflow_share_pct.toFixed(1)} %`
                            : "— %"}
                        </p>
                        <p className="mt-2 text-xl text-slate-200">
                          {moneyAnchor !== null && isFiniteNumber(moneyAnchor)
                            ? tf(lang, "presentation.s6.outcomeService", {
                                anchor: `${moneyAnchor.toFixed(1)} %`,
                              })
                            : null}
                        </p>
                      </div>
                    </div>
                    <BasisLabel>
                      {tf(lang, "presentation.s6.basis", { date: bundle.captured })}
                    </BasisLabel>
                  </>
                ) : (
                  dataUnavailable
                )}
              </div>
            ) : null}
          </>
        )}
      </main>

      <footer className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          data-testid="presentation-prev"
          className="rounded border border-slate-500 px-4 py-2 text-base font-semibold disabled:opacity-40"
        >
          ←
        </button>
        <p className="text-sm text-slate-400">
          {bundle !== null ? tf(lang, "presentation.calmbasis", { date: bundle.captured }) : ""}
        </p>
        <button
          type="button"
          onClick={() => setStep((s) => Math.min(STEP_COUNT - 1, s + 1))}
          disabled={step === STEP_COUNT - 1}
          data-testid="presentation-next"
          className="rounded border border-slate-500 px-4 py-2 text-base font-semibold disabled:opacity-40"
        >
          →
        </button>
      </footer>
    </div>
  );
}
