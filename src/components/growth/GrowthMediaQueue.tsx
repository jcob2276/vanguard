import { Link } from 'react-router-dom';
import { ExternalLink, PlayCircle } from 'lucide-react';
import type { GrowthLinkRow } from './hooks/useGrowthData';
import { inferResourceType, RESOURCE_TYPE_META, type GrowthResourceType } from '../../lib/growth/growth';
import { Card } from '../ui/Card';

function linkMeta(row: GrowthLinkRow) {
  const rt = (row.resource_type as GrowthResourceType | null) ?? inferResourceType(row.url, row.domain);
  return RESOURCE_TYPE_META[rt] ?? RESOURCE_TYPE_META.article;
}

export default function GrowthMediaQueue({ links }: { links: GrowthLinkRow[] }) {
  const videos = links.filter((l) => {
    const rt = (l.resource_type as GrowthResourceType | null) ?? inferResourceType(l.url, l.domain);
    return rt === 'video' || rt === 'film';
  });
  const rest = links.filter((l) => !videos.includes(l));

  return (
    <Card variant="surface" padding="1rem" className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <p className="flex items-center gap-1.5 text-2xs font-black uppercase tracking-wider text-text-muted">
            <PlayCircle size={12} /> Do obejrzenia / przeczytania
          </p>
          <p className="text-xs text-text-muted mt-0.5">Kolejka z Keep · nieprzeczytane</p>
        </div>
        <Link
          to="/keep"
          className="text-2xs font-black uppercase text-primary hover:underline shrink-0"
        >
          Keep →
        </Link>
      </div>

      {links.length === 0 ? (
        <p className="text-sm text-text-muted">Brak w kolejce — wrzuć linki w Keep.</p>
      ) : (
        <div className="space-y-4 overflow-y-auto max-h-[var(--ds-h-520px)] pr-1 flex-1">
          {videos.length > 0 && (
            <div>
              <p className="text-2xs font-black uppercase text-text-muted mb-1.5">Filmy / wideo</p>
              <ul className="space-y-1.5">
                {videos.map((row) => (
                  <MediaRow key={row.id} row={row} />
                ))}
              </ul>
            </div>
          )}
          {rest.length > 0 && (
            <div>
              {videos.length > 0 && (
                <p className="text-2xs font-black uppercase text-text-muted mb-1.5">Reszta</p>
              )}
              <ul className="space-y-1.5">
                {rest.map((row) => (
                  <MediaRow key={row.id} row={row} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function MediaRow({ row }: { row: GrowthLinkRow }) {
  const meta = linkMeta(row);
  return (
    <li className="rounded-xl border border-border-custom bg-background/40 px-3 py-2.5 flex items-start gap-2">
      {row.thumbnail_url ? (
        <img
          src={row.thumbnail_url}
          alt=""
          className="w-14 h-9 object-cover rounded-md shrink-0 bg-border-custom"
        />
      ) : (
        <span className="w-14 h-9 rounded-md bg-border-custom/50 flex items-center justify-center text-lg shrink-0">
          {meta.emoji}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-text-primary line-clamp-2">{row.title || row.domain}</p>
        <p className="text-2xs text-text-muted mt-0.5">{meta.label}</p>
      </div>
      <a
        href={row.url}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1.5 text-text-muted hover:text-primary shrink-0"
        title="Otwórz"
      >
        <ExternalLink size={12} />
      </a>
    </li>
  );
}
