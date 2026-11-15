import { useEffect, useState } from "react";
import {
  ApiError,
  MATERIAL_TYPES,
  runRoute,
  runScenarios,
  type PolicyConfigOverride,
  type Route,
  type RouteResponse,
  type RoutingConfigOverride,
} from "../lib/api";
import {
  formatKg,
  formatLitres,
  formatMetres,
  formatMinutes,
  formatPct,
  formatStopKey,
  provenanceLabel,
} from "../lib/format";
import { t, tf, type Lang, type TranslationKey } from "../lib/i18n";
import { StatusBadge, MaterialBadge } from "./Badges";
import { ForecastParamsForm, type ForecastParams } from "./ForecastParamsForm";
import { Panel } from "./Panel";
import { RouteMap } from "./RouteMap";
import { TechDetails } from "./TechDetails";
import { EmptyState, ErrorState, LoadingState } from "./states";

/**
 * Route view (§5.1 POST /api/route): pipeline forecast → policy → geography →
 * solve. "One collection day, optimised": the visiting order per truck for the
 * selected day, load progression, feasibility. Stops the configured fleet
 * cannot serve THIS day are "deferred to a later day" with plain-language
 * reasons (never hidden, §4.4; raw reason code kept in the title attribute).
 * The year-wide day-spreading plan lives in Scenarios — the linking sentence
 * sources its "peak trucks/day" figure from POST /api/scenarios (server
 * defaults); when unavailable the parenthetical is omitted, never invented.
 * Totals/cost/tech rows stay EN (M18 decision for non-Overview views; the
 * redesigned presentation parts are EN/DE).
 */

/** EUR amounts — unit-explicit, "—" when missing (v3 cost fields). */
function formatEur(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toLocaleString("en-US")} EUR`
    : "— EUR";
}

/**
 * Map a backend unserved reason string to a plain-language deferred sentence
 * (§6: never an unexplained "unserved"). Fail-safe: an unknown reason renders
 * verbatim — never silently genericised. Matching order matters ("no feasible
 * insertion…" mentions "shift limits" but is a capacity/fleet reason).
 */
function deferredReasonKey(reason: string): TranslationKey | null {
  if (reason.includes("no feasible insertion")) return "routing.reason.noInsertion";
  // Live backend emits a prefixed SENTENCE ("hosted_demo_stop_cap: deployment
  // setting…", src/api/services.py) — prefix-match, not equality.
  if (reason.startsWith("hosted_demo_stop_cap")) return "routing.reason.hostedCap";
  if (reason.startsWith("fleet_exhausted")) return "routing.reason.fleetExhausted";
  if (reason.startsWith("collected volume")) return "routing.reason.volume";
  if (reason.startsWith("collected weight")) return "routing.reason.weight";
  if (reason.includes("max_shift_minutes") || reason.includes("shift_limit_exceeded")) {
    return "routing.reason.shift";
  }
  return null; // unknown → render the raw string verbatim
}

function deferredReasonText(lang: Lang, reason: string): string {
  const key = deferredReasonKey(reason);
  return key === null ? reason : t(lang, key);
}

export { deferredReasonText };

export function RoutePanel({
  lang,
  defaultAsOf,
  policyOverride,
  routingOverride,
  onRoute,
}: {
  lang: Lang;
  defaultAsOf: string | null;
  policyOverride: PolicyConfigOverride;
  routingOverride: RoutingConfigOverride;
  onRoute: (response: RouteResponse) => void;
}) {
  const [params, setParams] = useState<ForecastParams>({
    as_of_date: defaultAsOf ?? "",
    horizon_days: 28,
    method: "persistence",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RouteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // §5.2.6 day_spread peak trucks/day for the linking sentence ([predicted]
  // simulation on observed rates). null → omit the parenthetical (§6: never
  // a hardcoded number).
  const [peakTrucksPerDay, setPeakTrucksPerDay] = useState<number | null>(null);

  // Auto-fetch the day-spread aggregates once a dataset exists; keyed on the
  // dataset's last record date — a new upload refetches.
  useEffect(() => {
    if (defaultAsOf === null) {
      setPeakTrucksPerDay(null);
      return;
    }
    let cancelled = false;
    runScenarios({})
      .then((payload) => {
        if (cancelled) return;
        const spread = payload.strategies?.find((s) => s.id === "day_spread");
        const peak = spread?.peak_trucks_per_day;
        setPeakTrucksPerDay(typeof peak === "number" && Number.isFinite(peak) ? peak : null);
      })
      .catch(() => {
        if (!cancelled) setPeakTrucksPerDay(null);
      });
    return () => {
      cancelled = true;
    };
  }, [defaultAsOf]);

  async function handleRun() {
    setBusy(true);
    setError(null);
    try {
      const response = await runRoute({
        as_of_date: params.as_of_date,
        horizon_days: params.horizon_days,
        method: params.method,
        policy_config: policyOverride,
        routing_config: routingOverride,
      });
      setResult(response);
      onRoute(response);
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const canRun =
    !busy &&
    params.as_of_date !== "" &&
    Number.isFinite(params.horizon_days) &&
    params.horizon_days >= 1;

  const solution = result?.solution ?? null;
  const degraded = solution !== null && (solution.status === "infeasible" || solution.status === "timeout");

  // Data-generated insight sentence (from the API solution, never hardcoded).
  const insightTitle =
    solution !== null
      ? tf(lang, "routing.insight", {
          routes: solution.routes.length.toLocaleString("en-US"),
          served: solution.totals.stops_served.toLocaleString("en-US"),
          total: solution.totals.stops_total.toLocaleString("en-US"),
          deferred: solution.unserved.length.toLocaleString("en-US"),
        })
      : t(lang, "routing.title");

  return (
    <Panel
      title={insightTitle}
      subtitle={t(lang, "routing.subtitle")}
      testid="route-panel"
    >
      <p className="max-w-3xl text-xs leading-relaxed text-sky-800" data-testid="route-link">
        {peakTrucksPerDay !== null
          ? tf(lang, "routing.link.withPeak", { n: peakTrucksPerDay.toLocaleString("en-US") })
          : t(lang, "routing.link.withoutPeak")}
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <ForecastParamsForm value={params} onChange={setParams} disabled={busy} lang={lang} />
        <button
          type="button"
          onClick={() => void handleRun()}
          disabled={!canRun}
          className="rounded bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
          data-testid="route-run"
        >
          {busy ? t(lang, "routing.running") : t(lang, "routing.run")}
        </button>
      </div>

      {busy ? <div className="mt-3"><LoadingState label={t(lang, "routing.running")} hint={t(lang, "routing.runningHint")} /></div> : null}
      {error !== null && !busy ? (
        <div className="mt-3"><ErrorState label={t(lang, "routing.error")} hint={error} /></div>
      ) : null}
      {!busy && result === null && error === null ? (
        <div className="mt-3">
          <EmptyState
            label={t(lang, "routing.empty")}
            hint={t(lang, "routing.emptyHint")}
          />
        </div>
      ) : null}

      {result !== null && !busy && solution !== null ? (
        <div className="mt-3 space-y-4" data-testid="route-result">
          <p className="text-xs text-slate-600" data-testid="route-day-context">
            {tf(lang, "routing.dayContext", {
              asOf: formatDateSafe(result.selection.as_of_date),
              target: formatDateSafe(result.selection.target_date),
            })}
          </p>

          {degraded ? (
            <div
              className="rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              data-testid="degraded-status"
            >
              {tf(lang, "routing.degraded", { status: solution.status })}
            </div>
          ) : null}

          {/* Solver status + provenance are technical: collapsible details
              (still in the DOM for tests/tools, hidden from the main view).
              Content stays EN (M18 decision). */}
          <TechDetails label="Technical details" testid="route-tech-details">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={solution.status} />
              <span>{provenanceLabel(solution.distance_provenance)}</span>
            </div>
            <p>
              Objective value:{" "}
              {typeof solution.objective_value === "number" && Number.isFinite(solution.objective_value)
                ? `${solution.objective_value.toLocaleString("en-US")} m`
                : "—"}
            </p>
            {/* ③ §4.8 fleet separation: the fleet recommendation (×99) is a
                solver input [demo assumption] — its cost rows live here in the
                collapsible, not beside the operational totals. */}
            <p data-testid="route-fleet-cost">
              Recommended fleet cost ({solution.cost.fleet_cost.trucks} recommended truck(s) —{" "}
              <span data-testid="route-fleet-solver-input">[demo assumption — solver input]</span>, §4.8):{" "}
              {formatEur(solution.cost.fleet_cost.cost_eur_per_day)}/day ·{" "}
              {formatEur(solution.cost.fleet_cost.cost_eur_per_year)}/year — [predicted] derived, not
              invoiced (§4.4)
            </p>
            <p data-testid="route-travel-time-mode">
              Travel time mode: {solution.travel_time_mode ?? "—"}
              {solution.travel_time_mode === "fixed_per_leg"
                ? " — fixed minutes on every leg incl. depot/disposal"
                : solution.travel_time_mode === "haversine_derived"
                  ? " — duration from straight-line distance ÷ speed"
                  : ""}
            </p>
          </TechDetails>

          <TotalsBar response={result} />

          {/* v3 cost block (§4.3): [predicted] derivations from the configured
              cost parameters — never invoiced amounts (§4.4). The recommended
              FLEET cost rows moved into TechDetails (M18 ③, §4.8 fleet
              separation: solver input ≠ observed operation). EN rows (M18). */}
          <div
            className="grid grid-cols-2 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3"
            data-testid="route-cost"
          >
            <Total
              label="Trucks in use"
              value={`${solution.cost.vehicles_used} vehicle(s) — [predicted] derived, not invoiced (§4.4)`}
            />
            <Total
              label="Cost (trucks in use)"
              value={`${formatEur(solution.cost.cost_eur_per_day)}/day · ${formatEur(solution.cost.cost_eur_per_year)}/year`}
            />
          </div>

          {/* v3 compartment visibility (§4.3/§4.4): litres per material. */}
          <div className="text-xs text-slate-700" data-testid="route-volumes-by-material">
            <span className="font-semibold text-slate-700">Collected volume by material: </span>
            {MATERIAL_TYPES.map((m) => (
              <span key={m} className="mr-3">
                <MaterialBadge material={m} />{" "}
                {formatLitres(solution.totals.collected_volume_by_material?.[m])}
              </span>
            ))}
          </div>

          <RouteMap solution={solution} />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">
                Routes ({solution.routes.length})
              </p>
              {solution.routes.length === 0 ? (
                <p className="text-xs text-slate-400" data-testid="routes-empty">
                  {t(lang, "routing.deferred.none")}
                </p>
              ) : (
                solution.routes.map((route, i) => (
                  <RouteCard key={i} index={i} route={route} />
                ))
              )}
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700" data-testid="deferred-title">
                {tf(lang, "routing.deferred.title", {
                  n: solution.unserved.length.toLocaleString("en-US"),
                })}
              </p>
              <p className="text-xs text-slate-600">{t(lang, "routing.deferred.explanation")}</p>
              {solution.unserved.length === 0 ? (
                <p className="text-xs text-slate-400" data-testid="deferred-none">
                  {t(lang, "routing.deferred.none")}
                </p>
              ) : (
                <ul
                  className="max-h-64 space-y-1 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700"
                  data-testid="deferred-list"
                >
                  {solution.unserved.map((u, i) => (
                    <li key={i} title={u.reason} data-testid="deferred-row">
                      <span className="font-mono">{formatStopKey(u)}</span> —{" "}
                      {deferredReasonText(lang, u.reason)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

/** "—" for a missing selection date — never a fabricated day. */
function formatDateSafe(iso: string | null): string {
  return iso ?? "—";
}

function TotalsBar({ response }: { response: RouteResponse }) {
  const { totals, fleet_recommendation } = response.solution;
  return (
    <div
      className="grid grid-cols-2 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3 lg:grid-cols-6"
      data-testid="route-totals"
    >
      <Total label="Distance" value={formatMetres(totals.distance_m)} />
      <Total label="Duration" value={formatMinutes(totals.duration_min)} />
      <Total label="Volume collected" value={formatLitres(totals.collected_volume_litres)} />
      <Total label="Weight collected" value={formatKg(totals.collected_weight_kg)} />
      <Total
        label="Stops served"
        value={`${totals.stops_served} of ${totals.stops_total}`}
      />
      <Total
        label={`Fleet: ${fleet_recommendation.vehicle_type_id}`}
        value={`${fleet_recommendation.count} vehicle(s) — [demo assumption — solver input] · by volume ⌈${fleet_recommendation.basis.ceil_by_volume}⌉, by weight ⌈${fleet_recommendation.basis.ceil_by_weight}⌉ (brief §4)`}
      />
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function RouteCard({ index, route }: { index: number; route: Route }) {
  return (
    <div
      className="rounded border border-slate-200 p-2 text-xs"
      data-testid={`route-card-${index}`}
    >
      <p className="font-semibold text-slate-800">
        Route {index + 1} · {route.vehicle_type_id} · {formatMetres(route.distance_m)} ·{" "}
        {formatMinutes(route.duration_minutes)}
      </p>
      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-slate-600">
        {route.sequence.map((node, j) => {
          if ("location_id" in node) {
            return (
              <li key={j} className="font-mono">
                {node.location_id.slice(0, 13)}… · {node.material_type} ·{" "}
                {formatPct(node.predicted_fill_pct, 0)} ·{" "}
                {formatLitres(node.container_volume_litres)}
              </li>
            );
          }
          return (
            <li key={j}>
              {"service_minutes" in node ? "Disposal" : "Depot"} {node.id} ({node.name})
            </li>
          );
        })}
      </ol>
      {route.load_progression.length > 0 ? (
        <p className="mt-1 text-slate-500">
          Load progression (L / kg after each stop):{" "}
          {route.load_progression
            .map(([volumeLitres, weightKg]) => `${volumeLitres.toLocaleString("en-US")} L / ${weightKg.toLocaleString("en-US")} kg`)
            .join(" → ")}
        </p>
      ) : null}
    </div>
  );
}
