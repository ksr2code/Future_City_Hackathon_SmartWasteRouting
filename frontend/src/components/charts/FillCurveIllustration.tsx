import { Line, LineChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { t, tf, type Lang } from "../../lib/i18n";

/**
 * Schematic fill curve — ILLUSTRATION ONLY, labelled as such (§6): fill rises
 * to the emptying trigger, the container is emptied (reset to 0), twice.
 * Static component: no data props, no fetches, deterministic so tests can
 * assert the sawtooth shape. The 80 % trigger in the drawing is part of the
 * illustration and labelled [demo assumption] — never presented as observed.
 */
const FILL_CURVE = Array.from({ length: 56 }, (_, i) => ({
  day: i + 1,
  fill: Math.round(((i % 28) / 28) * 80),
}));

export function FillCurveIllustration({ lang }: { lang: Lang }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3" data-testid="chart-fill-curve">
      <LineChart width={380} height={240} data={FILL_CURVE}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="day" hide />
        <YAxis domain={[0, 100]} stroke="#64748b" width={40} />
        <ReferenceLine
          y={80}
          stroke="#ef4444"
          label={{ value: "80 %", fill: "#b91c1c", position: "insideTopLeft" }}
        />
        <Line
          type="monotone"
          dataKey="fill"
          stroke="#0284c7"
          strokeWidth={3}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
      <p className="mt-1 text-xs font-semibold text-amber-700">
        {t(lang, "charts.fill.illustration")} · {tf(lang, "charts.fill.trigger", { pct: "80" })}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{t(lang, "charts.fill.curveCaption")}</p>
    </div>
  );
}
