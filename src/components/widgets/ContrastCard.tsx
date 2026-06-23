interface ContrastProps { leftLabel: string; leftValue: string | number; rightLabel: string; rightValue: string | number; title?: string; note?: string; }
export function ContrastCard({ leftLabel, leftValue, rightLabel, rightValue, title, note }: ContrastProps) {
  return (
    <div>
      {title && <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(91,108,255,0.08)' }}>
          <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--color-text-tertiary)' }}>{leftLabel}</p>
          <p className="text-[20px] font-[800] leading-none" style={{ color: '#5B6CFF' }}>{leftValue}</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(16,185,129,0.08)' }}>
          <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--color-text-tertiary)' }}>{rightLabel}</p>
          <p className="text-[20px] font-[800] leading-none" style={{ color: '#10B981' }}>{rightValue}</p>
        </div>
      </div>
      {note && <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--color-text-tertiary)' }}>{note}</p>}
    </div>
  );
}
