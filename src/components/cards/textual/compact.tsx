interface CompactCardData {
  title: string;
  body?: string;
  badge?: string;
  badgeColor?: string;
  timestamp?: string;
}

export function CompactCard({ data }: { data: CompactCardData }) {
  return (
    <div className="flex gap-3 items-start">
      {data.badge && (
        <span
          className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5"
          style={{ background: data.badgeColor ? `${data.badgeColor}18` : 'rgba(91,108,255,0.1)', color: data.badgeColor ?? 'var(--color-primary)' }}
        >
          {data.badge}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{data.title}</p>
        {data.body && <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{data.body}</p>}
      </div>
      {data.timestamp && (
        <span className="flex-shrink-0 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{data.timestamp}</span>
      )}
    </div>
  );
}
