interface Bubble { label: string; value: number; color?: string; }
interface BubbleChartProps { data: Bubble[]; title?: string; }
export function BubbleChart({ data, title }: BubbleChartProps) {
  const max = Math.max(...data.map(b => b.value), 1);
  const COLORS = ['#5B6CFF', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#06B6D4'];
  return (
    <div>
      {title && <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</p>}
      <div className="flex flex-wrap gap-2 items-end">
        {data.map((b, i) => {
          const size = 24 + (b.value / max) * 44;
          const color = b.color ?? COLORS[i % COLORS.length];
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div className="rounded-full flex items-center justify-center text-white font-bold" style={{ width: size, height: size, background: color, fontSize: size * 0.28 }}>
                {b.value}
              </div>
              <span className="text-[9px] text-center max-w-[56px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
