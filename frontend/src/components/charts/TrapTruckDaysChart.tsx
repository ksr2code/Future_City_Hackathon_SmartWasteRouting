import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { SimulationDay } from "../../lib/api";
import { t, type Lang } from "../../lib/i18n";

/**
 * "The trap" (§5.2.5 replay): daily truck-days of the modelled 28-day cycle
 * (spiky mega-days) vs the naive same-day demand-driven strategy (clustering).
 * PURE: merges both day series by index from the props — never fetches, never
 * fabricates a daily series. Fixed Recharts size for jsdom tests.
 */
export function TrapTruckDaysChart({
  lang,
  fixedDays,
  demandDays,
}: {
  lang: Lang;
  fixedDays: SimulationDay[];
  demandDays: SimulationDay[];
}) {
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
          name={t(lang, "overview.toggle.today")}
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
        {t(lang, "overview.toggle.today")} ·{" "}
        <span className="font-semibold text-sky-700">—</span>{" "}
        {t(lang, "charts.trap.legendDemand")}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{t(lang, "charts.trap.caption")}</p>
      <p className="mt-0.5 text-xs font-medium text-amber-700">{t(lang, "charts.trap.basis")}</p>
    </div>
  );
}
