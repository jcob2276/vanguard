interface HighlightData { value: string | number; label: string; subLabel?: string; icon?: string; color?: string; }
export function HighlightCard({ data }: { data: HighlightData }) {
  const color = data.color ?? '#5B6CFF';
  return (
    <div className="flex flex-col gap-1 p-4 rounded-2xl" style={{ background: `${color}0C`, border: `1px solid ${color}20` }}>
      {data.icon && <span className="text-2xl">{data.icon}</span>}
      <span className="text-[28px] font-[800] leading-none tracking-[-1px]" style={{ color }}>{data.value}</span>
      <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{data.label}</span>
      {data.subLabel && <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{data.subLabel}</span>}
    </div>
  );
}
