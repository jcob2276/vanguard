interface ProgressData { label: string; value: number; max?: number; unit?: string; color?: string; }
export function ProgressCard({ data }: { data: ProgressData }) {
  const max = data.max ?? 100;
  const pct = Math.min(100, (data.value / max) * 100);
  const color = data.color ?? 'var(--color-primary)';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{data.label}</p>
        <span className="text-sm font-bold" style={{ color }}>{data.value}{data.unit ? ` ${data.unit}` : ''}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(153,161,175,0.15)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="text-xs text-right" style={{ color: 'var(--color-text-tertiary)' }}>{Math.round(pct)}% z {max}{data.unit ? ` ${data.unit}` : ''}</p>
    </div>
  );
}
