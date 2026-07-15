interface SnippetData { code: string; language?: string; title?: string; }
export function SnippetCard({ data }: { data: SnippetData }) {
  return (
    <div>
      {data.title && <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>{data.title}</p>}
      <pre className="text-xs leading-relaxed overflow-x-auto rounded-xl p-3" style={{ background: 'var(--color-theme-hex-ba101010006)', color: 'var(--text-primary)', fontFamily: 'var(--ds-inline-style-monospace)' }}>
        <code>{data.code}</code>
      </pre>
      {data.language && <p className="text-2xs mt-1 text-right" style={{ color: 'var(--color-text-tertiary)' }}>{data.language}</p>}
    </div>
  );
}
