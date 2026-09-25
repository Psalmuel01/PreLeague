/** Tiny price path. Points are [t, price]; colour follows the net move. */
export function Sparkline({ points, height = 84 }: { points: [number, number][]; height?: number }) {
  if (points.length < 2) {
    return (
      <div className="caption center" style={{ height, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sunken)", borderRadius: 12 }}>
        Price path appears after a few updates
      </div>
    );
  }
  const w = 358;
  const t0 = points[0][0];
  const t1 = points[points.length - 1][0];
  const ps = points.map((p) => p[1]);
  const lo = Math.min(...ps);
  const hi = Math.max(...ps);
  const span = hi - lo || hi * 0.001 || 1;
  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * (w - 8) + 4;
  const y = (p: number) => height - 6 - ((p - lo) / span) * (height - 12);
  const d = points.map(([t, p], i) => `${i ? "L" : "M"}${x(t).toFixed(1)} ${y(p).toFixed(1)}`).join(" ");
  const up = ps[ps.length - 1] >= ps[0];
  const stroke = up ? "var(--up)" : "var(--down)";
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} role="img" aria-label={`Price ${up ? "up" : "down"} since round start`} preserveAspectRatio="none">
      <line x1="0" x2={w} y1={y(ps[0])} y2={y(ps[0])} stroke="var(--line-2)" strokeDasharray="4 4" />
      <path d={`${d} L${x(t1)} ${height} L${x(t0)} ${height} Z`} fill={up ? "var(--up-tint)" : "var(--down-tint)"} opacity=".7" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(t1)} cy={y(ps[ps.length - 1])} r="4" fill={stroke} />
    </svg>
  );
}
