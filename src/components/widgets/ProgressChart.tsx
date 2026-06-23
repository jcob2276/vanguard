interface ProgressItem { label: string; value: number; max?: number; color?: string; }
interface ProgressChartProps { items: ProgressItem[]; title?: string; }

export function ProgressChart({ items, title }: ProgressChartProps) {
  return (
    <div className="space-y-2">
      {title && <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>}
      {items.map((item, i) => {
        const pct = Math.min(100, (item.value / (item.max ?? 100)) * 100);
        const color = item.color ?? '#5B6CFF';
        return (
          <div key={i}>
            <div className="flex justify-between mb-0.5">
              <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
              <span className="text-[11px] font-medium" style={{ color }}>{item.value}{item.max ? `/${item.max}` : `%`}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(153,161,175,0.15)' }}>
              <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: '999px', transition: 'width 0.7s' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
