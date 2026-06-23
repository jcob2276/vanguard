interface ArticleData { title: string; body: string; author?: string; date?: string; readingTime?: number; }
export function ArticleCard({ data }: { data: ArticleData }) {
  return (
    <div className="space-y-2">
      <p className="text-[16px] font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>{data.title}</p>
      {(data.author || data.date || data.readingTime) && (
        <div className="flex gap-2 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
          {data.author && <span>{data.author}</span>}
          {data.date && <span>· {data.date}</span>}
          {data.readingTime && <span>· {data.readingTime} min</span>}
        </div>
      )}
      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{data.body}</p>
    </div>
  );
}
