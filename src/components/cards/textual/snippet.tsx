interface SnippetData { code: string; language?: string; title?: string; }
export function SnippetCard({ data }: { data: SnippetData }) {
  return (
    <div>
      {data.title && <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>{data.title}</p>}
      <pre className="text-[11px] leading-relaxed overflow-x-auto rounded-xl p-3" style={{ background: 'rgba(10,10,10,0.06)', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
        <code>{data.code}</code>
      </pre>
      {data.language && <p className="text-[9px] mt-1 text-right" style={{ color: 'var(--color-text-tertiary)' }}>{data.language}</p>}
    </div>
  );
}
