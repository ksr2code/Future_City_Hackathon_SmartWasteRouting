import { MATERIAL_TYPES, type DatasetSummary } from "../lib/api";
import { formatDate, formatInt } from "../lib/format";
import { Panel } from "./Panel";
import { EmptyState, ErrorState, LoadingState } from "./states";

/**
 * KPI overview from GET /api/summary. These counts describe the uploaded CSV —
 * observed data; nothing here is predicted or synthetic.
 */
export function KpiOverview({
  summary,
  loading,
  error,
}: {
  summary: DatasetSummary | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <Panel
      title="2 · Dataset overview (observed)"
      subtitle="Counts from the active uploaded dataset — observed facts, no predictions."
      testid="kpi-panel"
    >
      {loading ? <LoadingState label="Loading summary" /> : null}
      {error !== null && !loading ? <ErrorState label="Could not load summary" hint={error} /> : null}
      {!loading && error === null && summary === null ? (
        <EmptyState label="No dataset loaded" hint="Upload a CSV above to populate the dashboard." />
      ) : null}
      {!loading && error === null && summary !== null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="kpi-grid">
          <Kpi label="Rows" value={formatInt(summary.n_rows, "rows")} />
          <Kpi label="Locations" value={formatInt(summary.n_locations, "locations")} />
          <Kpi label="Series" value={formatInt(summary.n_series, "series")} />
          <Kpi
            label="Date range"
            value={`${formatDate(summary.date_min)} → ${formatDate(summary.date_max)}`}
          />
          {MATERIAL_TYPES.map((material) => (
            <Kpi
              key={material}
              label={`${material} glass`}
              value={formatInt(summary.rows_per_material?.[material] ?? 0, "rows")}
            />
          ))}
          <Kpi label="Validation" value={`errors ${summary.n_errors} · warnings ${summary.n_warnings}`} />
          <Kpi label="Source" value={summary.source_name} />
        </div>
      ) : null}
    </Panel>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900" data-testid="kpi-value">
        {value}
      </p>
    </div>
  );
}
