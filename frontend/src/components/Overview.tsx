import { useEffect, useState } from "react";
import {
  ApiError,
  fetchComparison,
  runCandidates,
  type ComparisonResponse,
  type DatasetSummary,
  type FillStats,
  type SelectionResponse,
} from "../lib/api";
import { derivedSavingsPct, formatKg, formatLitres, formatMetres, formatMinutes, formatPct } from "../lib/format";
import { t, tf, type Lang, type TranslationKey } from "../lib/i18n";
import { DemoLoadButton } from "./DemoLoadButton";
import { GlassLegend } from "./GlassLegend";
import { TechDetails } from "./TechDetails";
import { EmptyState, ErrorState, LoadingState } from "./states";

/**
 * Overview page (first nav tab; M11 jury-usability pass). Audience: jury and
 * city administrators. Plain-language key numbers from the API, a "today's
 * recommendation" work list with reasons, a 4-step how-it-works strip and a
 * fixed-vs-optimised before/after card. Labelling discipline (AGENTS rule 3,
 * §5.2.2): historical shares are shares of *readings* — never "emptyings"
 * (the data has no collection events); distances are straight-line estimates;
 * savings are labelled derived; solver statuses and raw metrics stay inside
 * the TechDetails collapsible.
 */

/** Recommendation horizon for the overview (task-fixed 7 days) [demo assumption]. */
const RECOMMENDATION_HORIZON_DAYS = 7;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TOP_EXAMPLES = 5;

export interface OverviewProps {
  lang: Lang;
  summary: DatasetSummary | null;
  summaryLoading: boolean;
  summaryError: string | null;
  datasetVersion: number;
  /** Same handler as a CSV upload — a demo load activates the dataset (§5.1). */
  onDemoLoaded: (summary: DatasetSummary) => void;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Defensive fill_stats guard (App.test mock returns {status:"ok"} everywhere). */
function validFillStats(summary: DatasetSummary | null): FillStats | null {
  const fs = summary?.fill_stats;
  if (fs === null || fs === undefined) return null;
  if (!isFiniteNumber(fs.share_readings_full_or_above_pct) || !isFiniteNumber(fs.threshold_pct)) {
    return null;
  }
  return fs;
}

/** Defensive §5.2.2 scenario guard — malformed payloads degrade, never crash. */
function isScenario(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    isFiniteNumber(s.distance_m) &&
    isFiniteNumber(s.duration_min) &&
    isFiniteNumber(s.stops_served) &&
    isFiniteNumber(s.stops_total) &&
    isFiniteNumber(s.vehicles_used) &&
    isFiniteNumber(s.collected_volume_litres) &&
    isFiniteNumber(s.collected_weight_kg) &&
    isFiniteNumber(s.unserved_count) &&
    isFiniteNumber(s.recommended_trucks)
  );
}

function scenario(value: unknown): ComparisonResponse["naive"] | null {
  return isScenario(value) ? (value as ComparisonResponse["naive"]) : null;
}

export function Overview({
  lang,
  summary,
  summaryLoading,
  summaryError,
  datasetVersion,
  onDemoLoaded,
}: OverviewProps) {
  // Auto-run candidates (§5.1 POST /api/candidates) for "today's recommendation".
  const [selection, setSelection] = useState<SelectionResponse | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  // Fixed-vs-optimised comparison (§5.2.2 GET /api/comparison).
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [comparisonNotFound, setComparisonNotFound] = useState(false);

  const asOf =
    typeof summary?.date_max === "string" && ISO_DATE.test(summary.date_max)
      ? summary.date_max
      : null;
  const hasDataset = summary !== null;

  // Auto-run candidates once the dataset exposes its last reading date.
  // Keyed on [date_max, datasetVersion] — a new upload (version bump) reruns.
  useEffect(() => {
    if (asOf === null) {
      setSelection(null);
      setRecError(null);
      return;
    }
    let cancelled = false;
    setRecLoading(true);
    setRecError(null);
    runCandidates({
      as_of_date: asOf,
      horizon_days: RECOMMENDATION_HORIZON_DAYS,
      method: "persistence",
    })
      .then((payload) => {
        if (cancelled) return;
        // Defensive shape guard: malformed responses set an error, never crash.
        if (!Array.isArray(payload.selected) || !Array.isArray(payload.skipped)) {
          setSelection(null);
          setRecError("Unexpected /api/candidates response shape (missing selected/skipped)");
          return;
        }
        setSelection(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSelection(null);
          setRecError(err instanceof ApiError ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setRecLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [asOf, datasetVersion]);

  // Comparison only exists once a dataset is loaded (404 before, §5.3 → empty state).
  useEffect(() => {
    if (!hasDataset) {
      setComparison(null);
      setComparisonNotFound(false);
      setComparisonError(null);
      return;
    }
    let cancelled = false;
    setComparisonLoading(true);
    setComparisonNotFound(false);
    setComparisonError(null);
    fetchComparison()
      .then((payload) => {
        if (cancelled) return;
        // Defensive shape guard: missing naive/optimised → error state.
        if (scenario(payload.naive) === null || scenario(payload.optimised) === null) {
          setComparison(null);
          setComparisonError("Unexpected /api/comparison response shape (missing naive/optimised)");
          return;
        }
        setComparison(payload);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setComparison(null);
        if (err instanceof ApiError && err.status === 404) {
          setComparisonNotFound(true); // no dataset → empty state, not an error
        } else {
          setComparisonError(err instanceof ApiError ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setComparisonLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasDataset, datasetVersion]);

  const fillStats = validFillStats(summary);
  const selected = selection?.selected ?? [];
  const skipped = selection?.skipped ?? [];
  const noForecastCount = skipped.filter((s) => s.reason_code === "no_forecast").length;
  const naive = comparison !== null ? scenario(comparison.naive) : null;
  const optimised = comparison !== null ? scenario(comparison.optimised) : null;
  const savingsPct =
    naive !== null && optimised !== null
      ? derivedSavingsPct(naive.distance_m, optimised.distance_m)
      : null;

  return (
    <div className="space-y-4" data-testid="overview-root">
      {/* Hero: headline + 2-sentence problem statement + glass legend */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="max-w-3xl text-xl font-bold text-slate-900">
            {t(lang, "overview.headline")}
          </h2>
          <GlassLegend lang={lang} />
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          {t(lang, "overview.problem")}
        </p>
      </section>

      {/* Dataset-level states replace the key numbers while absent/failed */}
      {summaryLoading ? <LoadingState label={t(lang, "overview.state.loading")} /> : null}
      {summaryError !== null && !summaryLoading ? (
        <ErrorState label={t(lang, "overview.state.summaryError")} hint={summaryError} />
      ) : null}
      {!summaryLoading && summaryError === null && !hasDataset ? (
        <div className="space-y-3">
          <EmptyState label={t(lang, "overview.state.noDataset")} />
          <DemoLoadButton lang={lang} onLoaded={onDemoLoaded} />
        </div>
      ) : null}

      {/* Three plain-language key numbers */}
      {!summaryLoading && summaryError === null && hasDataset ? (
        <div className="grid gap-4 md:grid-cols-3" data-testid="overview-keynumbers">
          <KeyNumberCard
            title={t(lang, "overview.keynum.readings.title")}
            value={fillStats !== null ? formatPct(fillStats.share_readings_full_or_above_pct, 1) : "— %"}
            testid="keynum-readings"
          >
            {fillStats !== null ? (
              tf(lang, "overview.keynum.readings.note", { thr: fillStats.threshold_pct })
            ) : (
              t(lang, "overview.state.noFillStats")
            )}
          </KeyNumberCard>
          <KeyNumberCard
            title={t(lang, "overview.keynum.containers.title")}
            value={`${selected.length.toLocaleString("en-US")} ${t(lang, "unit.containers")}`}
            testid="keynum-containers"
          >
            {asOf !== null
              ? tf(lang, "overview.keynum.containers.note", { date: asOf })
              : t(lang, "overview.state.noAsOf")}
          </KeyNumberCard>
          <KeyNumberCard
            title={t(lang, "overview.keynum.distance.title")}
            value={
              naive !== null && optimised !== null
                ? `${formatMetres(naive.distance_m)} → ${formatMetres(optimised.distance_m)}`
                : "— m"
            }
            testid="keynum-distance"
          >
            {naive !== null && optimised !== null ? (
              <>
                {t(lang, "overview.keynum.distance.fixed")}: {formatMetres(naive.distance_m)} ·{" "}
                {t(lang, "overview.keynum.distance.optimised")}: {formatMetres(optimised.distance_m)}{" "}
                · {t(lang, "unit.vehicles")}: {naive.recommended_trucks} → {optimised.recommended_trucks}
                {savingsPct !== null ? (
                  <span className="mt-1 block">
                    {tf(lang, "overview.keynum.distance.savings", {
                      pct: `${savingsPct.toFixed(1)} %`,
                    })}
                  </span>
                ) : null}
              </>
            ) : (
              t(lang, "overview.state.comparisonNoDataset")
            )}
          </KeyNumberCard>
        </div>
      ) : null}

      {/* Today's recommendation: N empty / M wait + top examples with reasons */}
      {!summaryLoading && summaryError === null && hasDataset ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-testid="recommendation">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              {t(lang, "overview.recommendation.title")}
            </h3>
            {asOf !== null ? (
              <p className="text-xs text-slate-500">
                {tf(lang, "overview.recommendation.asof", { date: asOf })} ·{" "}
                {tf(lang, "overview.recommendation.horizon", { days: RECOMMENDATION_HORIZON_DAYS })}
              </p>
            ) : null}
          </div>

          {recLoading ? <div className="mt-3"><LoadingState label={t(lang, "overview.state.recommendationLoading")} /></div> : null}
          {recError !== null && !recLoading ? (
            <div className="mt-3"><ErrorState label={t(lang, "overview.state.recommendationError")} hint={recError} /></div>
          ) : null}
          {asOf === null && !recLoading && recError === null ? (
            <div className="mt-3"><EmptyState label={t(lang, "overview.state.noAsOf")} /></div>
          ) : null}

          {asOf !== null && !recLoading && recError === null && selection !== null ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <p className="font-semibold text-red-800">
                  {tf(lang, "overview.recommendation.toEmpty", { n: selected.length })}
                </p>
                <p className="font-semibold text-slate-600">
                  {tf(lang, "overview.recommendation.canWait", { n: skipped.length })}
                </p>
                {noForecastCount > 0 ? (
                  <p className="text-amber-700">
                    {tf(lang, "overview.recommendation.noForecast", { n: noForecastCount })}
                  </p>
                ) : null}
              </div>
              <ExampleList
                label={t(lang, "overview.recommendation.examples")}
                rows={[
                  ...selected.slice(0, TOP_EXAMPLES).map((c) => ({
                    key: `${c.location_id}·${c.material_type}`,
                    locationId: c.location_id,
                    material: c.material_type,
                    fill: formatPct(c.predicted_fill_pct, 0),
                    reason: t(lang, `overview.reason.${c.reason_code}` as TranslationKey),
                  })),
                ]}
                emptyLabel={t(lang, "overview.state.recommendationError")}
              />
              <p className="text-xs leading-relaxed text-slate-500">
                {t(lang, "overview.recommendation.caption")}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* How it works — static, shown even before data is loaded */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-testid="how-strip">
        <h3 className="text-base font-semibold text-slate-900">{t(lang, "overview.how.title")}</h3>
        <ol className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-4">
          {(["step1", "step2", "step3", "step4"] as const).map((step, i) => (
            <li key={step} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="mr-1 font-bold text-sky-700">{i + 1}.</span>
              {t(lang, `overview.how.${step}` as TranslationKey)}
            </li>
          ))}
        </ol>
      </section>

      {/* Before/after: fixed schedule vs optimised */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-testid="comparison-card">
        <h3 className="text-base font-semibold text-slate-900">
          {t(lang, "overview.beforeafter.title")}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {t(lang, "overview.beforeafter.caption")}
        </p>

        {comparisonLoading ? (
          <div className="mt-3"><LoadingState label={t(lang, "overview.state.comparisonLoading")} /></div>
        ) : null}
        {comparisonError !== null && !comparisonLoading ? (
          <div className="mt-3"><ErrorState label={t(lang, "overview.state.comparisonError")} hint={comparisonError} /></div>
        ) : null}
        {!comparisonLoading && comparisonError === null && (comparisonNotFound || !hasDataset) ? (
          <div className="mt-3"><EmptyState label={t(lang, "overview.state.comparisonNoDataset")} /></div>
        ) : null}

        {naive !== null && optimised !== null && !comparisonLoading ? (
          <div className="mt-3 space-y-2">
            <div className="overflow-x-auto rounded border border-slate-200">
              <table className="w-full text-left text-xs" data-testid="comparison-table">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-2 py-1.5" />
                    <th className="px-2 py-1.5">{t(lang, "overview.beforeafter.fixed")}</th>
                    <th className="px-2 py-1.5">{t(lang, "overview.beforeafter.optimised")}</th>
                  </tr>
                </thead>
                <tbody>
                  <ComparisonRow
                    label={t(lang, "col.distance")}
                    a={formatMetres(naive.distance_m)}
                    b={formatMetres(optimised.distance_m)}
                  />
                  <ComparisonRow
                    label={t(lang, "col.duration")}
                    a={formatMinutes(naive.duration_min)}
                    b={formatMinutes(optimised.duration_min)}
                  />
                  <ComparisonRow
                    label={t(lang, "col.trucks")}
                    a={`${naive.recommended_trucks} ${t(lang, "unit.vehicles")}`}
                    b={`${optimised.recommended_trucks} ${t(lang, "unit.vehicles")}`}
                  />
                  <ComparisonRow
                    label={t(lang, "col.stopsServed")}
                    a={`${naive.stops_served.toLocaleString("en-US")} / ${naive.stops_total.toLocaleString("en-US")}`}
                    b={`${optimised.stops_served.toLocaleString("en-US")} / ${optimised.stops_total.toLocaleString("en-US")}`}
                  />
                  <ComparisonRow
                    label={t(lang, "col.unserved")}
                    a={naive.unserved_count.toLocaleString("en-US")}
                    b={optimised.unserved_count.toLocaleString("en-US")}
                  />
                  <ComparisonRow
                    label={t(lang, "col.volume")}
                    a={formatLitres(naive.collected_volume_litres)}
                    b={formatLitres(optimised.collected_volume_litres)}
                  />
                  <ComparisonRow
                    label={t(lang, "col.weight")}
                    a={formatKg(naive.collected_weight_kg)}
                    b={formatKg(optimised.collected_weight_kg)}
                  />
                </tbody>
              </table>
            </div>
            {savingsPct !== null ? (
              <p className="text-xs font-semibold text-emerald-700" data-testid="comparison-savings">
                {tf(lang, "overview.beforeafter.savings", { pct: `${savingsPct.toFixed(1)} %` })}
              </p>
            ) : null}
            <TechDetails label={t(lang, "techdetails.label")} testid="comparison-tech-details">
              <p data-testid="comparison-statuses">
                {t(lang, "overview.beforeafter.fixed")}: {comparison?.naive.status} ·{" "}
                {t(lang, "overview.beforeafter.optimised")}: {comparison?.optimised.status}
              </p>
              <p>{comparison?.distance_provenance === "haversine_straight_line_derived"
                ? "Distances: straight-line (haversine × detour factor) — NOT road distance"
                : `Distance provenance: ${comparison?.distance_provenance ?? "—"}`}</p>
              <p className="text-slate-500">
                {t(lang, "overview.tech.assumptions")}:
              </p>
              <ul className="list-disc pl-4">
                {(comparison?.assumptions ?? []).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </TechDetails>
          </div>
        ) : null}
      </section>

      {/* Calm note on demo assumptions + straight-line distances */}
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800" data-testid="overview-calmnote">
        {t(lang, "overview.calmnote")}
      </p>
    </div>
  );
}

function KeyNumberCard({
  title,
  value,
  children,
  testid,
}: {
  title: string;
  value: string;
  children: React.ReactNode;
  testid: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-testid={testid}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{children}</p>
    </div>
  );
}

function ExampleList({
  label,
  rows,
  emptyLabel,
}: {
  label: string;
  rows: Array<{ key: string; locationId: string; material: string; fill: string; reason: string }>;
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-slate-700">{label}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1" data-testid="recommendation-examples">
          {rows.map((row) => (
            <li
              key={row.key}
              className="rounded border border-slate-100 bg-slate-50 px-2 py-1 text-xs text-slate-700"
            >
              <span className="font-mono" title={row.locationId}>{row.locationId.slice(0, 13)}…</span>{" "}
              · {row.material} · {row.fill} — {row.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ComparisonRow({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-2 py-1.5 font-medium text-slate-600">{label}</td>
      <td className="px-2 py-1.5 text-slate-800">{a}</td>
      <td className="px-2 py-1.5 text-slate-800">{b}</td>
    </tr>
  );
}
