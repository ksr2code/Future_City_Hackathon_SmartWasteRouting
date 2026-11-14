import { useEffect, useState } from "react";
import {
  ApiError,
  fetchConfig,
  fetchSummary,
  type ConfigDefaults,
  type DatasetSummary,
  type PolicyConfigOverride,
  type RouteResponse,
  type RoutingConfigOverride,
} from "./lib/api";
import { fetchHealth, type Health } from "./lib/health";
import { CandidatesPanel } from "./components/CandidatesPanel";
import { ConfigEditor } from "./components/ConfigEditor";
import { ContainerList } from "./components/ContainerList";
import { KpiOverview } from "./components/KpiOverview";
import { RoutePanel } from "./components/RoutePanel";
import { SyntheticDataBanner } from "./components/SyntheticDataBanner";
import { UploadPanel } from "./components/UploadPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";

/**
 * Operator dashboard (M11). Sections: upload → KPI overview → containers →
 * demo-config overrides → forecast/candidates → route proposal. Demo geography
 * /values are always visibly labelled; observed vs predicted vs [demo
 * assumption] is never mixed.
 */
export default function App() {
  // Liveness (M0 convention, asserted by App.test.tsx).
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Active dataset.
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [datasetVersion, setDatasetVersion] = useState(0);

  // Config defaults + user overrides (lifted to candidates/route panels).
  const [config, setConfig] = useState<ConfigDefaults | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [policyOverride, setPolicyOverride] = useState<PolicyConfigOverride>({});
  const [routingOverride, setRoutingOverride] = useState<RoutingConfigOverride>({});

  // Synthetic/demo markers from the latest route response (§5.3).
  const [routeAssumptions, setRouteAssumptions] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((payload) => {
        if (!cancelled) setHealth(payload);
      })
      .catch(() => {
        if (!cancelled) setHealthError("API unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);
    fetchSummary()
      .then((payload) => {
        if (!cancelled) setSummary(payload);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // 404 = no dataset yet → empty state, not an error (§5.3).
        if (!(err instanceof ApiError && err.status === 404)) {
          setSummaryError(err instanceof ApiError ? err.message : String(err));
        }
        setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [datasetVersion]);

  useEffect(() => {
    let cancelled = false;
    setConfigLoading(true);
    fetchConfig()
      .then((payload) => {
        if (!cancelled) setConfig(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setConfigError(err instanceof ApiError ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleUploaded(uploaded: DatasetSummary) {
    setSummary(uploaded);
    setDatasetVersion((v) => v + 1);
  }

  function handleRoute(response: RouteResponse) {
    setRouteAssumptions(Array.isArray(response.assumptions) ? response.assumptions : []);
  }

  const demoInPlay = routeAssumptions !== null;

  return (
    <main className="mx-auto min-h-screen max-w-7xl bg-slate-50 p-6 lg:p-8">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">WasteRouting.AI</h1>
        <p className="mt-1 text-sm text-slate-500">
          Glass-waste collection forecasting &amp; routing (prototype) — observed data, model
          predictions and [demo assumption] values are always labelled.
        </p>
        <p className="mt-1 text-sm text-slate-700" data-testid="health">
          API health:{" "}
          {healthError !== null ? (
            <span className="font-semibold text-red-600">{healthError}</span>
          ) : health !== null ? (
            <span className="font-semibold text-green-700">{health.status}</span>
          ) : (
            "checking…"
          )}
        </p>
      </header>

      {demoInPlay ? (
        <div className="mb-4">
          <SyntheticDataBanner assumptions={routeAssumptions ?? []} />
        </div>
      ) : null}

      <div className="space-y-4">
        {/* One boundary per main view: a render error degrades that view to a
            visible retryable message — never a blank dashboard (M11). */}
        <div className="grid gap-4 xl:grid-cols-2">
          <ErrorBoundary label="Upload">
            <UploadPanel onUploaded={handleUploaded} />
          </ErrorBoundary>
          <ErrorBoundary label="Demo config">
            <ConfigEditor
              config={config}
              loading={configLoading}
              error={configError}
              policyOverride={policyOverride}
              routingOverride={routingOverride}
              onPolicyChange={setPolicyOverride}
              onRoutingChange={setRoutingOverride}
            />
          </ErrorBoundary>
        </div>
        <ErrorBoundary label="Dataset overview">
          <KpiOverview summary={summary} loading={summaryLoading} error={summaryError} />
        </ErrorBoundary>
        <ErrorBoundary label="Containers">
          <ContainerList datasetVersion={datasetVersion} />
        </ErrorBoundary>
        <ErrorBoundary label="Forecast & candidates">
          <CandidatesPanel
            defaultAsOf={summary?.date_max ?? null}
            policyOverride={policyOverride}
          />
        </ErrorBoundary>
        <ErrorBoundary label="Route proposal">
          <RoutePanel
            defaultAsOf={summary?.date_max ?? null}
            policyOverride={policyOverride}
            routingOverride={routingOverride}
            onRoute={handleRoute}
          />
        </ErrorBoundary>
      </div>

      <footer className="mt-6 text-xs text-slate-400">
        Prototype limitation: the API keeps one active dataset in memory; uploads replace it
        (docs/contracts.md §5). Coordinates and fleet values are synthetic until the host supplies
        real ones.
      </footer>
    </main>
  );
}
