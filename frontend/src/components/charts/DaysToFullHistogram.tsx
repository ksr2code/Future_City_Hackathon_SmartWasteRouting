import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { t, tf, type Lang, type TranslationKey } from "../../lib/i18n";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Days-to-full histogram (§5.2.3 v2): the per-series [predicted] estimates
 * bucketed for readability. PURE: bins are derived from the `series` prop —
 * bucket edges are display bins, never data values; the series count comes
 * from the prop. Renders nothing when no series carries an estimate.
 */
const BINS: Array<{ max: number; key: TranslationKey }> = [
  { max: 30, key: "charts.dtf.bin" },
  { max: 60, key: "charts.dtf.bin" },
  { max: 90, key: "charts.dtf.bin" },
  { max: 120, key: "charts.dtf.bin" },
  { max: 180, key: "charts.dtf.bin" },
  { max: 365, key: "charts.dtf.bin" },
  { max: Number.POSITIVE_INFINITY, key: "charts.dtf.binMore" },
];

/** Bin parameter for the shared "≤ {n} d" label; the last bin is "> 365 d". */
const BIN_PARAM = [30, 60, 90, 120, 180, 365, null] as const;

export function DaysToFullHistogram({
  lang,
  series,
}: {
  lang: Lang;
  series: Array<{ days_to_full: number | null }>;
}) {
  const histogram = useMemo(() => {
    const counts = BINS.map((b, i) => ({ max: b.max, key: b.key, n: 0, param: BIN_PARAM[i] }));
    let used = 0;
    for (const s of series) {
      const v = s.days_to_full;
      if (!isFiniteNumber(v)) continue;
      used += 1;
      const bin = counts.find((b) => v <= b.max);
      if (bin !== undefined) bin.n += 1;
    }
    return { counts, used };
  }, [series]);

  if (histogram.used === 0) return null;

  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3" data-testid="chart-dtf-histogram">
      <BarChart
        width={380}
        height={240}
        data={histogram.counts.map((b) => ({
          label: b.param === null ? t(lang, b.key) : tf(lang, b.key, { n: b.param.toLocaleString("en-US") }),
          n: b.n,
        }))}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" hide />
        <YAxis stroke="#64748b" width={40} />
        <Bar dataKey="n" fill="#059669" isAnimationActive={false} />
      </BarChart>
      <p className="mt-1 text-xs text-slate-600">
        {t(lang, "charts.dtf.histogramTitle")} ·{" "}
        {tf(lang, "charts.dtf.count", { n: histogram.used.toLocaleString("en-US") })}
      </p>
      <p className="mt-0.5 text-xs text-slate-400">
        {histogram.counts
          .map((b) => `${b.param === null ? t(lang, b.key) : tf(lang, b.key, { n: b.param.toLocaleString("en-US") })}: ${b.n}`)
          .join(" · ")}
      </p>
    </div>
  );
}
