interface SnippetData { code: string; language?: string; title?: string; }
export function SnippetCard({ data }: { data: SnippetData }) {
  return (
    <div>
      {data.title && <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>{data.title}</p>}
      <pre className="text-xs leading-relaxed overflow-x-auto rounded-xl p-3" style={{ background: 'var(--legacy-color-056)', color: 'var(--text-primary)', fontFamily: 'var(--legacy-inline-style-016)' }}>
        <code>{data.code}</code>
      </pre>
      {data.language && <p className="text-2xs mt-1 text-right" style={{ color: 'var(--color-text-tertiary)' }}>{data.language}</p>}
    </div>
  );
}
