import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import type { SimulationObservedDay } from "../../lib/api";
import { t, tf, type Lang } from "../../lib/i18n";

/**
 * Observed emptying records per day (§5.2.5 v5 `observed_days`, active days
 * only) — the real collection rhythm. PURE: renders from the `days` prop,
 * never fetches; the median is derived from the prop data, never hardcoded.
 * Fixed Recharts size (no ResponsiveContainer) so jsdom renders it in tests.
 */
export function ObservedVisitsTimeline({
  lang,
  days,
}: {
  lang: Lang;
  days: SimulationObservedDay[];
}) {
  const median = useMemo(() => {
    const active = days.map((d) => d.collections).filter((c) => c > 0);
    if (active.length === 0) return null;
    const sorted = [...active].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }, [days]);

  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3" data-testid="chart-observed">
      <BarChart width={760} height={240} data={days}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" hide />
        <YAxis stroke="#64748b" width={40} />
        <Bar dataKey="collections" fill="#0284c7" isAnimationActive={false} />
        {median !== null ? (
          <ReferenceLine
            y={median}
            stroke="#f59e0b"
            label={{
              value: tf(lang, "charts.observed.median", {
                n: median.toLocaleString("en-US"),
              }),
              fill: "#b45309",
              position: "insideTopRight",
            }}
          />
        ) : null}
      </BarChart>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{t(lang, "charts.observed.caption")}</p>
      <p className="mt-0.5 text-xs font-medium text-amber-700">{t(lang, "charts.observed.basis")}</p>
    </div>
  );
}
