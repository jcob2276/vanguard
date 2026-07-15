import { ExternalLink } from 'lucide-react';
interface LinkCardData { url: string; title?: string; description?: string; favicon?: string; }
export function LinkCard({ data }: { data: LinkCardData }) {
  return (
    <a href={data.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 no-underline">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[color:var(--ds-bg-rgba-91-108-255-0-08)]">
        {data.favicon ? <img src={data.favicon} className="w-4 h-4 rounded" alt="" /> : <ExternalLink size={13} style={{ color: 'var(--color-primary)' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{data.title || data.url}</p>
        {data.description && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{data.description}</p>}
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>{data.url}</p>
      </div>
    </a>
  );
}
