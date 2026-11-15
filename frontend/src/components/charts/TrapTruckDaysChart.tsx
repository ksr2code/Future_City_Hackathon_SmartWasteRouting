import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { SimulationDay } from "../../lib/api";
import { t, tf, type Lang } from "../../lib/i18n";

/**
 * "The trap" (§5.2.5 replay): daily truck-days of the modelled fixed emptying
 * cycle (spiky mega-days) vs the naive same-day demand-driven strategy
 * (clustering). The cycle length in the legend comes from the API config
 * echo via the `cycleDays` prop (review finding 4 — never hardcoded 28);
 * missing → number-free fallback label. PURE: merges both day series by
 * index from the props — never fetches, never fabricates a daily series.
 * Fixed Recharts size for jsdom tests.
 */
export function TrapTruckDaysChart({
  lang,
  fixedDays,
  demandDays,
  cycleDays = null,
}: {
  lang: Lang;
  fixedDays: SimulationDay[];
  demandDays: SimulationDay[];
  /** Frequency_days from the API config echo, pre-formatted; null when unknown. */
  cycleDays?: string | null;
}) {
  const fixedLabel =
    cycleDays !== null && cycleDays !== ""
      ? tf(lang, "overview.toggle.today", { days: cycleDays })
      : t(lang, "overview.toggle.todayNoDays");
  const rows = useMemo(
    () =>
      fixedDays.map((d, i) => ({
        day: i + 1,
        fixed: d.truck_days,
        demand: demandDays[i]?.truck_days ?? null,
      })),
    [fixedDays, demandDays],
  );

  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3" data-testid="chart-trap">
      <LineChart width={760} height={240} data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="day" hide />
        <YAxis stroke="#64748b" width={40} />
        <Line
          type="monotone"
          dataKey="fixed"
          name={fixedLabel}
          stroke="#f59e0b"
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="demand"
          name={t(lang, "charts.trap.legendDemand")}
          stroke="#0284c7"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
      <p className="mt-1 text-xs text-slate-500">
        <span className="font-semibold text-amber-700">—</span>{" "}
        {fixedLabel} ·{" "}
        <span className="font-semibold text-sky-700">—</span>{" "}
        {t(lang, "charts.trap.legendDemand")}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{t(lang, "charts.trap.caption")}</p>
      <p className="mt-0.5 text-xs font-medium text-amber-700">{t(lang, "charts.trap.basis")}</p>
    </div>
  );
}
