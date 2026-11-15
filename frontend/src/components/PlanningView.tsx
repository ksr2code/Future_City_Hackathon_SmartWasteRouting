import { useEffect, useState } from "react";
import {
  ApiError,
  fetchDaysToFull,
  runCandidates,
  runForecasts,
  type CandidateRequest,
  type DaysToFullResponse,
  type ForecastResponse,
  type MaterialType,
  type PolicyConfigOverride,
  type PredictedState,
  type ReasonCode,
  type SelectionResponse,
} from "../lib/api";
import { formatDate, formatPct } from "../lib/format";
import { t, tf, type Lang } from "../lib/i18n";
import { DaysToFullHistogram } from "./charts/DaysToFullHistogram";
import { MaterialBadge, ReasonBadge, StateBadge } from "./Badges";
import { DEFAULT_HORIZON_DAYS, ForecastParamsForm, type ForecastParams } from "./ForecastParamsForm";
import { TechDetails } from "./TechDetails";
import { EmptyState, ErrorState, LoadingState } from "./states";

/**
 * Planning view (§5.2 POST /api/forecasts + GET /api/days-to-full +
 * POST /api/candidates, §5.2.3 v2). Question: which containers will be full
 * soon, and when? Estimates are [predicted] from emptying records; the KPI
 * threshold comes from the config echo (prop) — never hardcoded. Both
 * estimates auto-fetch when a dataset exists; the Run button re-runs
 * forecast + candidates with the user's params.
 */
const TODAY_ISO = new Date().toISOString().slice(0, 10);

/** Rows shown in "Filling next" (display cap, not a data cut). */
const FILLING_NEXT_ROWS = 20;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Defensive §5.2.3 v2 guard — malformed payloads degrade, never crash. */
function validDaysToFull(payload: DaysToFullResponse): DaysToFullResponse | null {
  if (typeof payload.stats !== "object" || payload.stats === null) return null;
  if (!isFiniteNumber(payload.stats.series_with_estimate) || !Array.isArray(payload.series)) {
    return null;
  }
  return payload;
}

export interface PlanningViewProps {
  lang: Lang;
  defaultAsOf: string | null;
  policyOverride: PolicyConfigOverride;
  /** Policy threshold from the config echo — null hides the threshold KPI. */
  selectThresholdPct: number | null;
  datasetVersion: number;
}

export function PlanningView({
  lang,
  defaultAsOf,
  policyOverride,
  selectThresholdPct,
  datasetVersion,
}: PlanningViewProps) {
  const [params, setParams] = useState<ForecastParams>({
    as_of_date: defaultAsOf ?? "",
    horizon_days: DEFAULT_HORIZON_DAYS,
    method: "persistence",
  });
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [daysToFull, setDaysToFull] = useState<DaysToFullResponse | null>(null);
  const [dtfLoading, setDtfLoading] = useState(false);
  const [dtfError, setDtfError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionResponse | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Auto-fetch both estimates when a dataset exists (first load never sits
  // empty silently); keyed on [defaultAsOf, datasetVersion] — a new upload
  // (version bump) refetches. Forecast uses the dataset's last record date,
  // the observed-median 28-day horizon and persistence (defaults echoed in
  // the autoNote — never presented as user choices).
  useEffect(() => {
    if (defaultAsOf === null) {
      setForecast(null);
      setForecastError(null);
      setDaysToFull(null);
      setDtfError(null);
      return;
    }
    let cancelled = false;
    setForecastLoading(true);
    setForecastError(null);
    runForecasts({
      as_of_date: defaultAsOf,
      horizon_days: DEFAULT_HORIZON_DAYS,
      method: "persistence",
    })
      .then((payload) => {
        if (cancelled) return;
        if (Array.isArray(payload.forecasts)) {
          setForecast(payload);
        } else {
          setForecast(null);
          setForecastError("Unexpected /api/forecasts response shape");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setForecast(null);
        setForecastError(err instanceof ApiError ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setForecastLoading(false);
      });

    setDtfLoading(true);
    setDtfError(null);
    fetchDaysToFull()
      .then((payload) => {
        if (cancelled) return;
        setDaysToFull(validDaysToFull(payload));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDaysToFull(null);
        if (!(err instanceof ApiError && err.status === 404)) {
          setDtfError(err instanceof ApiError ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setDtfLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [defaultAsOf, datasetVersion]);

  async function handleRun() {
    setRunning(true);
    setSelectionError(null);
    setForecastError(null);
    const request: CandidateRequest = {
      as_of_date: params.as_of_date,
      horizon_days: params.horizon_days,
      method: params.method,
      policy_config: policyOverride,
    };
    try {
      const [fc, sel] = await Promise.all([
        runForecasts({
          as_of_date: params.as_of_date,
          horizon_days: params.horizon_days,
          method: params.method,
        }),
        runCandidates(request),
      ]);
      setForecast(Array.isArray(fc.forecasts) ? fc : null);
      setSelection(sel);
    } catch (err) {
      setSelectionError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const canRun =
    !running &&
    params.as_of_date !== "" &&
    Number.isFinite(params.horizon_days) &&
    params.horizon_days >= 1;

  // Derived KPI values (from API responses only — never hardcoded).
  const thresholdPct =
    selectThresholdPct !== null && isFiniteNumber(selectThresholdPct)
      ? selectThresholdPct
      : null;
  const thresholdCount =
    forecast !== null && thresholdPct !== null
      ? forecast.forecasts.filter(
          (f) => isFiniteNumber(f.predicted_fill_pct) && f.predicted_fill_pct >= thresholdPct,
        ).length
      : null;
  const dtfStats = daysToFull?.stats ?? null;
  const overdueRows =
    daysToFull !== null
      ? daysToFull.series.filter(
          (s) => s.predicted_full_date !== null && s.predicted_full_date < TODAY_ISO,
        )
      : [];
  const fillingNext = daysToFull
    ? daysToFull.series
        .filter((s) => s.predicted_full_date !== null)
        .sort((a, b) =>
          (a.predicted_full_date ?? "").localeCompare(b.predicted_full_date ?? ""),
        )
        .slice(0, FILLING_NEXT_ROWS)
    : [];
  const excludedCount =
    daysToFull !== null
      ? daysToFull.series.filter((s) => s.predicted_full_date === null).length
      : 0;

  const insightTitle =
    selection !== null
      ? tf(lang, "planning.candidates.insight", {
          selected: selection.selected.length.toLocaleString("en-US"),
          total: (selection.selected.length + selection.skipped.length).toLocaleString("en-US"),
          date: formatDate(selection.target_date),
          skipped: selection.skipped.length.toLocaleString("en-US"),
        })
      : t(lang, "planning.candidates.panelTitle");

  return (
    <div className="space-y-4" data-testid="planning-view">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{t(lang, "planning.title")}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
          {t(lang, "planning.subtitle")}
        </p>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-amber-700">
          {t(lang, "planning.basis")}
        </p>
      </section>

      <section
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        data-testid="planning-params"
      >
        <div className="flex flex-wrap items-end gap-3">
          <ForecastParamsForm value={params} onChange={setParams} disabled={running} lang={lang} />
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={!canRun}
            className="rounded bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
            data-testid="planning-run"
          >
            {running ? t(lang, "planning.running") : t(lang, "planning.run")}
          </button>
        </div>
        {defaultAsOf === null ? (
          <div className="mt-3">
            <EmptyState
              label={t(lang, "planning.candidates.noSelection")}
              hint={t(lang, "planning.candidates.noSelectionHint")}
            />
          </div>
        ) : null}
        <TechDetails label={t(lang, "techdetails.label")}>
          <p>{t(lang, "planning.tech.persistence")}</p>
          <p>{t(lang, "planning.tech.rate")}</p>
          <p>{t(lang, "planning.tech.evaluation")}</p>
          <p>{t(lang, "planning.tech.autoNote")}</p>
          {daysToFull !== null && Array.isArray(daysToFull.assumptions) ? (
            <p>{daysToFull.assumptions.join(" · ")}</p>
          ) : null}
        </TechDetails>
      </section>

      {defaultAsOf !== null ? (
        <section
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          data-testid="planning-kpis"
        >
          {dtfLoading || forecastLoading ? (
            <LoadingState label={t(lang, "planning.running")} />
          ) : null}
          {dtfError !== null && !dtfLoading ? (
            <div className="mb-3">
              <ErrorState label={t(lang, "planning.candidates.selectError")} hint={dtfError} />
            </div>
          ) : null}
          {forecastError !== null && !forecastLoading ? (
            <div className="mb-3">
              <ErrorState label={t(lang, "planning.candidates.selectError")} hint={forecastError} />
            </div>
          ) : null}
          {!dtfLoading && !forecastLoading && dtfError === null && forecastError === null ? (
            <div className="grid gap-3 md:grid-cols-4">
              {thresholdCount !== null && thresholdPct !== null ? (
                <div data-testid="kpi-threshold">
                  <p className="text-2xl font-bold text-slate-900">
                    {thresholdCount.toLocaleString("en-US")}
                  </p>
                  <p className="text-xs text-slate-600">
                    {tf(lang, "planning.kpi.thresholdTitle", {
                      threshold: thresholdPct.toLocaleString("en-US"),
                    })}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {t(lang, "planning.kpi.thresholdNote")}
                  </p>
                </div>
              ) : null}
              {dtfStats !== null && isFiniteNumber(dtfStats.median_days) ? (
                <div data-testid="kpi-median">
                  <p className="text-2xl font-bold text-slate-900">
                    {dtfStats.median_days.toLocaleString("en-US")} d
                  </p>
                  <p className="text-xs text-slate-600">{t(lang, "planning.kpi.medianTitle")}</p>
                  <p className="text-[10px] text-slate-400">
                    {tf(lang, "planning.kpi.medianNote", {
                      n: dtfStats.series_with_estimate.toLocaleString("en-US"),
                      total: dtfStats.series_total.toLocaleString("en-US"),
                    })}
                  </p>
                </div>
              ) : null}
              {dtfStats !== null && isFiniteNumber(dtfStats.lower_bound_share_pct) ? (
                <div data-testid="kpi-lowerbound">
                  <p className="text-2xl font-bold text-slate-900">
                    {dtfStats.lower_bound_share_pct.toLocaleString("en-US")} %
                  </p>
                  <p className="text-xs text-slate-600">
                    {t(lang, "planning.kpi.lowerBoundTitle")}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {t(lang, "planning.kpi.lowerBoundNote")}
                  </p>
                </div>
              ) : null}
              <div data-testid="kpi-overdue">
                <p className="text-2xl font-bold text-slate-900">
                  {overdueRows.length.toLocaleString("en-US")}
                </p>
                <p className="text-xs text-slate-600">{t(lang, "planning.kpi.overdueTitle")}</p>
                <p className="text-[10px] text-slate-400">{t(lang, "planning.kpi.overdueNote")}</p>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {daysToFull !== null && !dtfLoading && dtfError === null ? (
        <section
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          data-testid="planning-histogram"
        >
          <DaysToFullHistogram lang={lang} series={daysToFull.series} />
        </section>
      ) : null}

      {daysToFull !== null && !dtfLoading && dtfError === null ? (
        <section
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          data-testid="planning-filling-next"
        >
          <h2 className="text-base font-semibold text-slate-900">
            {t(lang, "planning.table.title")}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {tf(lang, "planning.table.subtitle", { n: FILLING_NEXT_ROWS.toLocaleString("en-US") })}
          </p>
          {fillingNext.length === 0 ? (
            <div className="mt-3">
              <EmptyState label={t(lang, "planning.table.empty")} />
            </div>
          ) : (
            <>
              <div className="mt-3 max-h-80 overflow-auto rounded border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-2 py-1.5">{t(lang, "planning.table.colSeries")}</th>
                      <th className="px-2 py-1.5">{t(lang, "containers.interval.colMaterial")}</th>
                      <th className="px-2 py-1.5">{t(lang, "planning.table.colLastFill")}</th>
                      <th className="px-2 py-1.5">{t(lang, "planning.table.colDaysToFull")}</th>
                      <th className="px-2 py-1.5">{t(lang, "planning.table.colPredictedDate")}</th>
                    </tr>
                  </thead>
                  <tbody data-testid="filling-next-rows">
                    {fillingNext.map((s) => {
                      const overdue = s.predicted_full_date !== null && s.predicted_full_date < TODAY_ISO;
                      return (
                        <tr
                          key={`${s.location_id}·${s.material_type}`}
                          className="border-t border-slate-100"
                        >
                          <td className="px-2 py-1.5 font-mono" title={s.location_id}>
                            {s.location_id.slice(0, 13)}…
                          </td>
                          <td className="px-2 py-1.5">
                            <MaterialBadge material={s.material_type} />
                          </td>
                          <td className="px-2 py-1.5">
                            {s.last_fill_pct === null ? "—" : formatPct(s.last_fill_pct, 0)}
                            {s.last_is_overfull ? " (overfull)" : ""}
                          </td>
                          <td className="px-2 py-1.5">
                            {s.days_to_full === null
                              ? "—"
                              : `${s.is_lower_bound ? "≥ " : ""}${s.days_to_full.toLocaleString("en-US")} d`}
                          </td>
                          <td className="px-2 py-1.5">
                            {s.predicted_full_date === null
                              ? "—"
                              : formatDate(s.predicted_full_date)}
                            {overdue ? (
                              <span
                                className="ml-1 inline-block rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                                title={t(lang, "containers.interval.overdueTitle")}
                                data-testid="overdue-badge"
                              >
                                {t(lang, "containers.interval.overdue")}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {excludedCount > 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  {tf(lang, "planning.table.excluded", {
                    n: excludedCount.toLocaleString("en-US"),
                  })}
                </p>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      <section
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        data-testid="candidates-panel"
      >
        <h2 className="text-base font-semibold text-slate-900">{insightTitle}</h2>
        <p className="mt-1 text-xs text-slate-500">{t(lang, "planning.candidates.panelSubtitle")}</p>

        {running ? <div className="mt-3"><LoadingState label={t(lang, "planning.running")} /></div> : null}
        {selectionError !== null && !running ? (
          <div className="mt-3">
            <ErrorState label={t(lang, "planning.candidates.selectError")} hint={selectionError} />
          </div>
        ) : null}
        {!running && selection === null && selectionError === null ? (
          <div className="mt-3">
            <EmptyState
              label={t(lang, "planning.candidates.noSelection")}
              hint={t(lang, "planning.candidates.noSelectionHint")}
            />
          </div>
        ) : null}

        {selection !== null && !running ? (
          <div className="mt-3 space-y-3" data-testid="selection-result">
            <p className="text-xs text-slate-600">
              {tf(lang, "planning.candidates.batch", {
                asOf: formatDate(selection.as_of_date),
                target: formatDate(selection.target_date),
                selected: selection.selected.length.toLocaleString("en-US"),
                skipped: selection.skipped.length.toLocaleString("en-US"),
              })}
            </p>
            <p className="text-xs text-slate-500">
              {tf(lang, "planning.candidates.policyEcho", {
                threshold: selection.config.select_threshold_pct.toLocaleString("en-US"),
                buffer: selection.config.uncertainty_buffer_pct.toLocaleString("en-US"),
                overfull: String(selection.config.overfull_always_selected),
              })}
            </p>
            <SelectionTable
              lang={lang}
              caption={t(lang, "planning.candidates.selected")}
              testid="selected-rows"
              rows={selection.selected}
              emptyLabel={t(lang, "planning.candidates.selectedEmpty")}
            />
            <SelectionTable
              lang={lang}
              caption={t(lang, "planning.candidates.skipped")}
              testid="skipped-rows"
              rows={selection.skipped}
              emptyLabel={t(lang, "planning.candidates.skippedEmpty")}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

/** Candidate and Skip differ only in nullability of fill/state (§3.3). */
interface SelectionRow {
  location_id: string;
  material_type: MaterialType;
  predicted_fill_pct: number | null;
  predicted_state: PredictedState | null;
  reason_code: ReasonCode;
  detail: string;
}

function SelectionTable({
  lang,
  caption,
  rows,
  emptyLabel,
  testid,
}: {
  lang: Lang;
  caption: string;
  rows: SelectionRow[];
  emptyLabel: string;
  testid: string;
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-slate-700">
        {caption} ({rows.length.toLocaleString("en-US")})
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">{emptyLabel}</p>
      ) : (
        <div className="max-h-64 overflow-auto rounded border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-600">
              <tr>
                <th className="px-2 py-1.5">{t(lang, "planning.table.colSeries")}</th>
                <th className="px-2 py-1.5">{t(lang, "containers.interval.colMaterial")}</th>
                <th className="px-2 py-1.5">{t(lang, "planning.candidates.colPredictedFill")}</th>
                <th className="px-2 py-1.5">{t(lang, "planning.candidates.colState")}</th>
                <th className="px-2 py-1.5">{t(lang, "planning.candidates.colReason")}</th>
                <th className="px-2 py-1.5">{t(lang, "planning.candidates.colDetail")}</th>
              </tr>
            </thead>
            <tbody data-testid={testid}>
              {rows.map((row) => (
                <tr
                  key={`${row.location_id}·${row.material_type}`}
                  className="border-t border-slate-100"
                >
                  <td className="px-2 py-1.5 font-mono" title={row.location_id}>
                    {row.location_id.slice(0, 13)}…
                  </td>
                  <td className="px-2 py-1.5"><MaterialBadge material={row.material_type} /></td>
                  <td className="px-2 py-1.5">{formatPct(row.predicted_fill_pct)}</td>
                  <td className="px-2 py-1.5"><StateBadge state={row.predicted_state} /></td>
                  <td className="px-2 py-1.5"><ReasonBadge code={row.reason_code} /></td>
                  <td className="px-2 py-1.5 text-slate-500">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
