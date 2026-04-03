/** Circular progress ring (dashboard / production metrics). */
export function StatRing({
  pct,
  color,
  size = 56,
  stroke = 4,
}: {
  pct: number;
  color: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const offset = c - (p / 100) * c;
  const cx = size / 2;
  return (
    <svg width={size} height={size} className="shrink-0" aria-hidden>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#E8ECF4" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
    </svg>
  );
}
