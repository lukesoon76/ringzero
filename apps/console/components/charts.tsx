/** Tiny dependency-free SVG charts in the monochrome (Palantir/LangChain) palette. */

const C = {
  fg: "#f4f4f5",
  muted: "#8a8a92",
  edge: "#2a2a2e",
  ok: "#5fae8c",
  warn: "#cfa047",
  bad: "#d56b6b",
};

export interface Series {
  label: string;
  color: string;
  points: number[];
}

/** Multi-series line chart with a faint baseline grid. Values are auto-scaled to `max`. */
export function LineChart({ series, height = 120, max, suffix = "" }: { series: Series[]; height?: number; max?: number; suffix?: string }) {
  const n = Math.max(...series.map((s) => s.points.length), 2);
  const hi = max ?? Math.max(1, ...series.flatMap((s) => s.points));
  const W = 100; // viewBox width units
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const y = (v: number) => height - (v / hi) * (height - 8) - 4;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="h-[120px] w-full" style={{ height }}>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={0} x2={W} y1={height - g * (height - 8) - 4} y2={height - g * (height - 8) - 4} stroke={C.edge} strokeWidth={0.4} />
      ))}
      {series.map((s) => {
        if (s.points.length < 2) return null;
        const d = s.points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
        return <path key={s.label} d={d} fill="none" stroke={s.color} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />;
      })}
      <text x={1} y={10} fill={C.muted} fontSize={6}>
        {Math.round(hi)}
        {suffix}
      </text>
    </svg>
  );
}

/** Bar chart over a rolling window. */
export function Bars({ values, height = 64, color = C.muted }: { values: number[]; height?: number; color?: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{ height: `${Math.max(3, (v / max) * 100)}%`, background: color, opacity: 0.35 + (i / values.length) * 0.65 }}
        />
      ))}
    </div>
  );
}

/** Donut for a small set of labelled segments. */
export function Donut({ segments, size = 120 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = Math.max(1, segments.reduce((n, s) => n + s.value, 0));
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  let a = -Math.PI / 2;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const frac = s.value / total;
      const a0 = a;
      const a1 = a + frac * Math.PI * 2;
      a = a1;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const x0 = cx + r * Math.cos(a0);
      const y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      return { d: `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`, color: s.color };
    });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.edge} strokeWidth={10} />
      {arcs.map((arc, i) => (
        <path key={i} d={arc.d} fill="none" stroke={arc.color} strokeWidth={10} strokeLinecap="butt" />
      ))}
      <text x={cx} y={cy + 3} textAnchor="middle" fill={C.fg} fontSize={14} fontWeight={600}>
        {total}
      </text>
    </svg>
  );
}

/** Horizontal bars for ranked categorical counts. */
export function HBars({ items, color = C.muted }: { items: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-1.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2">
          <span className="w-40 shrink-0 truncate text-[11px] text-muted">{it.label}</span>
          <div className="h-3 flex-1 rounded-sm bg-ink">
            <div className="h-3 rounded-sm" style={{ width: `${(it.value / max) * 100}%`, background: color }} />
          </div>
          <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-fg">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

export const CHART_COLORS = C;
