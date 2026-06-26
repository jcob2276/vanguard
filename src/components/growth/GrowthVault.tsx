import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { GrowthLinkRow } from '../../hooks/useGrowthData';
import { inferResourceType, RESOURCE_TYPE_META, type GrowthResourceType } from '../../lib/growth';

export default function GrowthVault({
  unreadLinks,
  readLinks,
  onPinLink,
  readOnly,
  expanded = false,
}: {
  unreadLinks: GrowthLinkRow[];
  readLinks: GrowthLinkRow[];
  onPinLink: (linkId: string) => void;
  readOnly: boolean;
  expanded?: boolean;
}) {
  const [open, setOpen] = useState(expanded);
  const isOpen = expanded || open;
  const [tab, setTab] = useState<'triage' | 'archive'>('triage');

  const triage = unreadLinks.filter((l) =>
    ['Kariera', 'Biznes', 'Technologia'].includes(l.category),
  );

  return (
    <section className="rounded-2xl border border-border-custom overflow-hidden">
      {!expanded && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-surface/30 cursor-pointer"
        >
          <div className="text-left">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">Skarbnica</p>
            <p className="text-[11px] text-text-secondary mt-0.5">
              {triage.length} do triażu · {readLinks.length} przeczytane
            </p>
          </div>
          {isOpen ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
        </button>
      )}

      {isOpen && (
        <div className={`p-4 space-y-3 ${expanded ? '' : 'border-t border-border-custom'}`}>
          {expanded && (
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">
              Skarbnica · {triage.length} do triażu
            </p>
          )}
          <div className="flex gap-1">
            {(['triage', 'archive'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex-1 rounded-lg py-1.5 text-[10px] font-black uppercase cursor-pointer ${
                  tab === id ? 'bg-primary/10 text-primary' : 'text-text-muted'
                }`}
              >
                {id === 'triage' ? 'Do triażu' : 'Archiwum'}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[min(60vh,480px)] overflow-y-auto">
            {(tab === 'triage' ? triage : readLinks).length === 0 ? (
              <p className="text-[11px] text-text-muted text-center py-4">Pusto</p>
            ) : (
              (tab === 'triage' ? triage : readLinks).map((link) => {
                const rt = (link.resource_type as GrowthResourceType) || inferResourceType(link.url, link.domain);
                const meta = RESOURCE_TYPE_META[rt] ?? RESOURCE_TYPE_META.article;
                return (
                  <div
                    key={link.id}
                    className="flex items-start gap-2 rounded-xl border border-border-custom p-2.5"
                  >
                    <span className="text-base">{meta.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-text-primary line-clamp-2">{link.title || link.url}</p>
                      <p className="text-[9px] text-text-muted">{link.category}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {link.url && (
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-text-muted hover:text-primary"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                      {tab === 'triage' && !readOnly && (
                        <button
                          type="button"
                          onClick={() => onPinLink(link.id)}
                          className="rounded-lg bg-primary/10 px-2 py-1 text-[9px] font-black uppercase text-primary cursor-pointer"
                        >
                          Pin
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Link
            to="/"
            onClick={() => {
              try {
                localStorage.setItem('vanguard_view', 'links');
              } catch {
                /* ignore */
              }
            }}
            className="block text-center text-[10px] font-black uppercase tracking-wider text-primary hover:underline"
          >
            Pełny Pocket →
          </Link>
        </div>
      )}
    </section>
  );
}
