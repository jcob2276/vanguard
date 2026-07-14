import {
  Check,
  ExternalLink,
  Trash2,
  PenLine,
  ListTodo,
  StickyNote
} from 'lucide-react';
import Spinner from '../../ui/Spinner';
import Button from '../../ui/Button';
import type { SavedLink } from '../../../lib/linksApi';
import type { useLinksInboxData } from './useLinksInboxData';

interface LinksInboxItemProps {
  link: SavedLink;
  d: ReturnType<typeof useLinksInboxData>;
  haptic: (pattern: number | number[]) => void;
  CATEGORY_COLORS: Record<string, { pill: string }>;
  CATEGORIES: string[];
}

function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export function LinksInboxItem({
  link,
  d,
  haptic,
  CATEGORY_COLORS,
  CATEGORIES
}: LinksInboxItemProps) {
  const catStyle = CATEGORY_COLORS[link.category] || CATEGORY_COLORS['Inne'];
  const isExpanded = d.expandedLinkId === link.id;
  const isDeleting = d.deletingIds.has(link.id);
  const youtubeId = getYouTubeId(link.url);

  return (
    <div
      className={`transition-all duration-[250ms] ease-in-out ${
        isDeleting ? 'opacity-0 scale-[0.93] -translate-y-2 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {d.viewMode === 'list' ? (
        // List Mode
        <div
          className={`flex items-center justify-between gap-3 border border-border-custom/50 bg-surface/50 rounded-2xl px-4 py-3.5 transition-all duration-150 hover:bg-surface-solid/30 hover:shadow-md hover:scale-[1.005] ${
            link.status === 'read' ? 'opacity-60 hover:opacity-90' : ''
          }`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none" onClick={() => d.setExpandedLinkId((p: string | null) => p === link.id ? null : link.id)}>
            <img
              src={`https://www.google.com/s2/favicons?sz=32&domain=${link.domain}`}
              alt=""
              className="w-4 h-4 rounded-sm object-contain shrink-0"
              onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
            />
            <div className="min-w-0 flex-1">
              <h3 className={`text-[14px] font-semibold truncate leading-tight ${
                link.status === 'read' ? 'text-text-secondary line-through' : 'text-text-primary'
              }`}>
                {link.title}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[10px] text-text-muted">{link.domain}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[8.5px] font-bold ${catStyle.pill}`}>
                  {link.category}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => d.toggleReadStatus(link.id, link.status)}
              className={`btn-press rounded-full p-1.5 transition-all ${
                link.status === 'read'
                  ? 'bg-success/10 text-success'
                  : 'text-text-muted/40 hover:text-text-primary hover:bg-surface-solid/60'
              }`}
              title={link.status === 'unread' ? 'Oznacz jako przeczytane' : 'Oznacz jako nieprzeczytane'}
            >
              <Check size={13} className={d.bouncingIds.has(link.id) ? 'animate-pop-check' : ''} />
            </button>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => haptic([6])}
              className="btn-press rounded-full p-1.5 text-text-muted/40 hover:text-text-primary hover:bg-surface-solid/60"
            >
              <ExternalLink size={13} />
            </a>
            <button
              onClick={() => d.deleteLink(link.id)}
              className="btn-press rounded-full p-1.5 text-text-muted/40 hover:text-danger hover:bg-danger/10"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ) : (
        // Card Mode
        <div
          className={`pocket-card group transition-all duration-150 shadow-md hover:shadow-lg hover:bg-surface-solid/80 hover:scale-[1.005] ${
            link.status === 'read' ? 'opacity-60 hover:opacity-90' : ''
          }`}
        >
          {/* Thumbnail (YouTube) */}
          {link.thumbnail_url && (
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="block -mx-4 -mt-4 mb-3 rounded-t-[24px] overflow-hidden">
              <img
                src={link.thumbnail_url}
                alt={link.title}
                className="w-full aspect-video object-cover"
                loading="lazy"
              />
            </a>
          )}

          {/* Top row */}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => d.setExpandedLinkId((p: string | null) => p === link.id ? null : link.id)}>
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <div className="flex items-center gap-1 select-none">
                  <img
                    src={`https://www.google.com/s2/favicons?sz=32&domain=${link.domain}`}
                    alt=""
                    className="w-3.5 h-3.5 rounded-sm object-contain"
                    onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                  <span className="text-[11px] text-text-muted">{link.channel_name || link.domain || 'link'}</span>
                </div>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    d.setCategoryFilter((p: string | null) => p === link.category ? null : link.category);
                  }}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold cursor-pointer hover:opacity-80 active:scale-95 transition-all ${catStyle.pill}`}
                >
                  {link.category}
                </span>
                {(link.notes || d.notesDrafts[link.id]) && (
                  <span className="flex items-center gap-1 text-[10px] text-text-muted/60">
                    <PenLine size={9} />
                  </span>
                )}
              </div>
              <h3 className={`text-[15px] font-semibold leading-snug tracking-tight ${
                link.status === 'read' ? 'text-text-secondary' : 'text-text-primary'
              }`}>
                {link.title}
              </h3>
              {link.description && (
                <p className="mt-1 text-[12.5px] text-text-muted leading-relaxed line-clamp-2">
                  {link.description}
                </p>
              )}
            </div>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => haptic([6])}
              className="btn-press shrink-0 rounded-full p-1.5 text-text-muted/60 hover:text-text-primary hover:bg-surface-solid/60 opacity-60 hover:opacity-100 transition-all duration-150 active:scale-[0.78]"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}

      {/* Expanded: AI Takeaways + Przemyślenia + Kategoria */}
      <div
        className={`grid-expand-wrapper ${isExpanded ? 'expanded' : ''}`}
      >
        <div className="grid-expand-content">
          <div className={`mt-4 pt-3 space-y-4 ${d.viewMode === 'list' ? 'border border-t-0 border-border-custom/40 bg-surface-solid/5 rounded-b-2xl p-4 -mt-2' : 'border-t border-border-custom/40'}`}>
            {youtubeId && (
              <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-inner border border-border-custom/50">
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  title={link.title}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            {link.takeaways && link.takeaways.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Kluczowe wnioski</p>
                <ul className="space-y-2">
                  {link.takeaways.map((t: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-text-primary">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">{i + 1}</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Konwersja */}
            <div className="flex flex-wrap gap-2 border-t border-border-custom/40 pt-3">
              <Button
                variant="tonal"
                size="sm"
                type="button"
                disabled={d.convertingLinkId === link.id}
                onClick={() => d.handleLinkToTodo(link)}
                className="btn-press flex flex-1 min-w-[120px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition-all disabled:opacity-50"
                icon={d.convertingLinkId === link.id ? <Spinner size="sm" className="h-3 w-3" /> : <ListTodo size={12} />}
              >
                Zrób zadanie
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={d.convertingLinkId === link.id}
                onClick={() => d.handleLinkToNote(link)}
                className="btn-press flex flex-1 min-w-[120px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition-all disabled:opacity-50"
                icon={<StickyNote size={12} />}
              >
                Do notatek
              </Button>
            </div>

            {/* Kategoria */}
            <div className="border-t border-border-custom/40 pt-3 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Kategoria</p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat: string) => {
                  const isActive = link.category === cat;
                  const cStyle = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Inne'];
                  return (
                    <button
                      key={cat}
                      onClick={() => d.updateLinkCategory(link.id, cat)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-all ${
                        isActive
                          ? `${cStyle.pill} border-current ring-1 ring-current`
                          : 'border-border-custom bg-surface-solid text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Przemyślenia */}
            <div className="border-t border-border-custom/40 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  <PenLine size={10} /> Przemyślenia
                </p>
                {d.savedNoteId === link.id && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-success">
                    <Check size={10} /> Zapisano
                  </span>
                )}
              </div>
              <textarea
                value={d.notesDrafts[link.id] ?? (link.notes || '')}
                onChange={e => d.setNotesDrafts((prev) => ({ ...prev, [link.id]: e.target.value }))}
                onBlur={() => d.saveNotes(link.id)}
                onFocus={e => {
                  if (d.notesDrafts[link.id] === undefined) {
                    d.setNotesDrafts((prev) => ({ ...prev, [link.id]: link.notes || '' }));
                  }
                  e.currentTarget.style.height = 'auto';
                  e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                }}
                onInput={e => {
                  const t = e.currentTarget;
                  t.style.height = 'auto';
                  t.style.height = t.scrollHeight + 'px';
                }}
                placeholder="Co myślisz o tym materiale? Zapisz refleksje, pytania, co chcesz wdrożyć…"
                rows={3}
                className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-text-primary outline-none placeholder:text-text-muted/35"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
