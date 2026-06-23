interface QuoteData { text: string; author?: string; source?: string; }
export function QuoteCard({ data }: { data: QuoteData }) {
  return (
    <div className="border-l-2 pl-4" style={{ borderColor: '#5B6CFF' }}>
      <p className="text-[14px] italic leading-relaxed" style={{ color: 'var(--text-primary)' }}>"{data.text}"</p>
      {(data.author || data.source) && (
        <p className="mt-2 text-[11px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
          — {data.author}{data.author && data.source ? ', ' : ''}{data.source}
        </p>
      )}
    </div>
  );
}
