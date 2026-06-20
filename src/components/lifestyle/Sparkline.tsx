export interface SparklineProps {
  data: number[];
  higherIsBetter: boolean;
}

export default function Sparkline({ data, higherIsBetter }: SparklineProps) {
  if (data.length < 2) return null;
  const w = 56;
  const h = 22;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (w - pad * 2));
  const ys = data.map((v) => h - pad - ((v - min) / range) * (h - pad * 2));
  const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const lastDelta = data[data.length - 1] - data[data.length - 2];
  const neutral = Math.abs(lastDelta) < 0.01;
  const good = neutral ? null : (higherIsBetter ? lastDelta > 0 : lastDelta < 0);
  const color = good === null ? 'stroke-[var(--color-text-muted)]/30' : good ? 'stroke-emerald-500' : 'stroke-rose-400';
  const dotColor = good === null ? 'fill-[var(--color-text-muted)]/30' : good ? 'fill-emerald-500' : 'fill-rose-400';

  return (
    <svg width={w} height={h} className="shrink-0 opacity-80">
      <polyline
        points={points}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={color}
      />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.5" className={dotColor} />
    </svg>
  );
}
