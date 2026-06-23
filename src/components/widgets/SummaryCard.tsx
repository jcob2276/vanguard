interface SummaryItem { label: string; value: string | number; color?: string; }
interface SummaryProps { title?: string; items: SummaryItem[]; footer?: string; }
export function SummaryCard({ title, items, footer }: SummaryProps) {
  return (
    <div className="space-y-2">
      {title && <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>}
      <div className="grid grid-cols-2 gap-2">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl p-2.5" style={{ background: 'rgba(153,161,175,0.06)' }}>
            <p className="text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>{item.label}</p>
            <p className="text-[16px] font-[800] leading-tight" style={{ color: item.color ?? 'var(--text-primary)' }}>{item.value}</p>
          </div>
        ))}
      </div>
      {footer && <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{footer}</p>}
    </div>
  );
}
