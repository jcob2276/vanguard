import { useCallback, useEffect, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ExternalLink,
  Inbox,
  Link2,
  ListTodo,
  Loader2,
  PenLine,
  Plus,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { notify, confirmDialog } from '../../lib/notify';
import { convertLinkToKeepNote, convertLinkToTodoItem } from '../../lib/captureBridge';
import { NETWORK_TIMEOUT_MS } from '../../lib/constants';
import { usePersistentDraft } from '../../hooks/usePersistentDraft';

interface SavedLink {
  id: string;
  url: string;
  title: string;
  description: string;
  takeaways: string[];
  notes: string;
  category: string;
  domain: string;
  status: 'unread' | 'read';
  created_at: string;
  thumbnail_url?: string;
  channel_name?: string;
}

const CATEGORY_COLORS: Record<string, { pill: string }> = {
  Kariera:    { pill: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  Zdrowie:    { pill: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  Technologia:{ pill: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  Biznes:     { pill: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  Inne:       { pill: 'bg-slate-500/10 text-slate-500 dark:text-slate-400' },
};

const STATUS_TABS: { id: 'unread' | 'read' | 'all'; label: string }[] = [
  { id: 'unread', label: 'Nieprzeczytane' },
  { id: 'read',   label: 'Przeczytane' },
  { id: 'all',    label: 'Wszystkie' },
];

const CATEGORIES = ['Kariera', 'Zdrowie', 'Technologia', 'Biznes', 'Inne'];

function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function LinksInbox({ session, onBack, onNavigateTo }: { session: Session; onBack: () => void; onNavigateTo?: (dest: string) => void }) {
  const [links, setLinks] = useState<SavedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('unread');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);
  const [sharingStatus, setSharingStatus] = useState<string | null>(null);
  // Persisted — in-progress per-link notes and the URL being added must survive a
  // backgrounded-tab kill before they're saved.
  const [notesDrafts, setNotesDrafts] = usePersistentDraft<Record<string, string>>(`vanguard_link_notes_drafts_${session.user.id}`, {});
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [addUrl, setAddUrl] = usePersistentDraft(`vanguard_link_add_url_draft_${session.user.id}`, '');
  const [showAddForm, setShowAddForm] = useState(() => Boolean(addUrl.trim()));
  const [addLoading, setAddLoading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [bouncingIds, setBouncingIds] = useState<Set<string>>(new Set());
  const [convertingLinkId, setConvertingLinkId] = useState<string | null>(null);

  const haptic = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const goTo = (view: string) => {
    try { localStorage.setItem('vanguard_view', view); } catch (e) {}
    if (onNavigateTo) onNavigateTo(view);
  };

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vanguard_links')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLinks((data as any) || []);
    } catch (err) {
      console.error('[LinksInbox] Error fetching links:', err);
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  const saveSharedLink = useCallback(async (actualUrl: string) => {
    setLoading(true);
    setSharingStatus('Zapisywanie udostępnionego linku...');
    try {
      const base = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${base}/functions/v1/vanguard-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: 'save_link', url: actualUrl }),
        signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      setSharingStatus('Zapisano!');
      setTimeout(() => setSharingStatus(null), 2500);
    } catch (err) {
      console.error('[LinksInbox] Failed to process shared link:', err);
      notify(`Błąd zapisu linku: ${(err as Error).message}`, 'error');
      setSharingStatus(null);
    } finally {
      fetchLinks();
    }
  }, [session.access_token, fetchLinks]);

  const handleAddLink = async () => {
    const raw = addUrl.trim();
    const urlMatch = raw.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) return;
    setAddLoading(true);
    try {
      const base = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${base}/functions/v1/vanguard-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: 'save_link', url: urlMatch[0] }),
        signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      setAddUrl('');
      setShowAddForm(false);
      await fetchLinks();
    } catch (err) {
      notify(`Błąd: ${(err as Error).message}`, 'error');
    } finally {
      setAddLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCandidate = params.get('share_url') || params.get('share_text') || '';
    const match = urlCandidate.match(/https?:\/\/[^\s]+/);
    if (match) {
      window.history.replaceState({}, document.title, '/');
      saveSharedLink(match[0]);
    } else {
      fetchLinks();
    }
  }, [fetchLinks, saveSharedLink]);

  const toggleReadStatus = async (id: string, current: 'unread' | 'read') => {
    haptic(current === 'unread' ? [8, 20, 8] : [5]);
    setBouncingIds(prev => new Set([...prev, id]));
    setTimeout(() => setBouncingIds(prev => { const n = new Set(prev); n.delete(id); return n; }), 400);
    const next = current === 'unread' ? 'read' : 'unread';
    setLinks(prev => prev.map(l => l.id === id ? { ...l, status: next } : l));
    const { error } = await supabase
      .from('vanguard_links').update({ status: next, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) fetchLinks();
  };

  const saveNotes = async (id: string) => {
    const draft = notesDrafts[id];
    if (draft === undefined) return;
    const link = links.find(l => l.id === id);
    if (!link || draft === (link.notes ?? '')) return;
    await supabase
      .from('vanguard_links')
      .update({ notes: draft, updated_at: new Date().toISOString() }).throwOnError()
      .eq('id', id);
    setLinks(prev => prev.map(l => l.id === id ? { ...l, notes: draft } : l));
    setSavedNoteId(id);
    setTimeout(() => setSavedNoteId(null), 1800);
  };

  const deleteLink = async (id: string) => {
    if (!(await confirmDialog('Usuń ten link?'))) return;
    haptic([12, 50, 18]);
    setDeletingIds(prev => new Set([...prev, id]));
    setTimeout(async () => {
      setLinks(prev => prev.filter(l => l.id !== id));
      setDeletingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      const { error } = await supabase.from('vanguard_links').delete().eq('id', id);
      if (error) console.warn('[LinksInbox] delete failed:', error.message);
    }, 260);
  };

  const updateLinkCategory = async (id: string, newCategory: string) => {
    try {
      const { error } = await supabase
        .from('vanguard_links')
        .update({ category: newCategory, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setLinks(prev => prev.map(l => l.id === id ? { ...l, category: newCategory } : l));
    } catch (err) {
      console.error('[LinksInbox] Failed to update category:', err);
    }
  };

  const handleLinkToTodo = async (link: SavedLink) => {
    setConvertingLinkId(link.id);
    try {
      await convertLinkToTodoItem(session.user.id, link);
      setLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: 'read' as const } : l));
      notify('Dodano do zadań', 'success');
    } catch (err) {
      notify((err as Error).message || 'Nie udało się dodać do zadań', 'error');
    } finally {
      setConvertingLinkId(null);
    }
  };

  const handleLinkToNote = async (link: SavedLink) => {
    setConvertingLinkId(link.id);
    try {
      await convertLinkToKeepNote(session.user.id, link);
      setLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: 'read' as const } : l));
      notify('Zapisano w notatkach', 'success');
    } catch (err) {
      notify((err as Error).message || 'Nie udało się zapisać notatki', 'error');
    } finally {
      setConvertingLinkId(null);
    }
  };

  const filteredLinks = links.filter(link => {
    const matchesStatus = statusFilter === 'all' || link.status === statusFilter;
    const matchesCategory = !categoryFilter || link.category === categoryFilter;
    return matchesStatus && matchesCategory;
  });

  const unreadCount = links.filter(l => l.status === 'unread').length;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-text-primary">
      <style>{`
        @keyframes pop-check {
          0%   { transform: scale(1); }
          30%  { transform: scale(0.88); }
          65%  { transform: scale(1.12); }
          85%  { transform: scale(0.97); }
          100% { transform: scale(1); }
        }
        @keyframes pop-delete {
          0%   { transform: scale(1); }
          40%  { transform: scale(0.80); }
          70%  { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .animate-pop-check { animation: pop-check 0.38s cubic-bezier(.36,.07,.19,.97) both; }
        .animate-pop-delete { animation: pop-delete 0.25s cubic-bezier(.36,.07,.19,.97) both; }
        .btn-press { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
      `}</style>

      {/* Sidebar */}
      <aside className="keep-sidebar">
        <p className="keep-sidebar-section-label">Workspace</p>
        <button className="keep-sidebar-item" onClick={() => onNavigateTo?.('keep')}>
          <StickyNote size={15} /><span>Notatki</span>
        </button>
        <button className="keep-sidebar-item" onClick={() => goTo('todo')}>
          <ListTodo size={15} /><span>Zadania</span>
        </button>
        <button className="keep-sidebar-item active">
          <BookOpen size={15} /><span>Pocket</span>
        </button>

        {CATEGORIES.length > 0 && (
          <>
            <div className="keep-sidebar-separator" />
            <p className="keep-sidebar-section-label">Kategorie</p>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`keep-sidebar-item ${categoryFilter === cat ? 'active' : ''}`}
                onClick={() => setCategoryFilter(p => p === cat ? null : cat)}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${
                  cat === 'Kariera' ? 'bg-indigo-500' :
                  cat === 'Zdrowie' ? 'bg-emerald-500' :
                  cat === 'Technologia' ? 'bg-sky-500' :
                  cat === 'Biznes' ? 'bg-amber-500' : 'bg-slate-400'
                }`} />
                <span>{cat}</span>
              </button>
            ))}
          </>
        )}
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-custom/60 bg-background/90 px-5 py-4 backdrop-blur-xl">
          <button onClick={onBack} className="flex items-center gap-1 text-primary font-medium text-[16px]">
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-bold text-text-primary tracking-tight">Pocket</h1>
            <p className="text-[12px] text-text-muted">
              {unreadCount > 0 ? `${unreadCount} nieprzeczytanych` : 'Wszystko przeczytane'}
            </p>
          </div>
          <button
            onClick={() => { setShowAddForm(p => !p); setAddUrl(''); }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            {showAddForm ? <X size={15} /> : <Plus size={15} />}
          </button>
        </header>

        {/* Inline add-link form */}
        <div
          className={`grid-expand-wrapper ${showAddForm ? 'expanded' : ''}`}
        >
          <div className="grid-expand-content border-b border-border-custom/60 bg-surface/60 backdrop-blur-sm">
            <div className="max-w-[640px] mx-auto flex items-center gap-2 px-5 py-3.5">
              <Link2 size={14} className="shrink-0 text-text-muted" />
              <input
                autoFocus
                type="url"
                value={addUrl}
                onChange={e => setAddUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); if (e.key === 'Escape') setShowAddForm(false); }}
                placeholder="Wklej URL i naciśnij Enter..."
                className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted/50 outline-none"
              />
              {addLoading
                ? <Loader2 size={15} className="shrink-0 text-primary animate-spin" />
                : <button
                    onClick={handleAddLink}
                    disabled={!addUrl.trim()}
                    className="shrink-0 text-[12px] font-semibold text-primary disabled:opacity-30 hover:opacity-70 transition-opacity"
                  >
                    Zapisz
                  </button>
              }
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[640px] mx-auto px-5 py-5 pb-24 space-y-4">

            {/* Status tabs */}
            <div className="flex gap-0.5 p-1 rounded-[14px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { haptic([4]); setStatusFilter(tab.id); }}
                  className={`btn-press flex-1 py-1.5 text-[12px] font-semibold rounded-[10px] transition-all duration-150 active:scale-[0.93] ${
                    statusFilter === tab.id
                      ? 'bg-background text-text-primary shadow-sm'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {sharingStatus && (
              <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary text-[12px] font-semibold rounded-[14px] animate-pulse">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
                {sharingStatus}
              </div>
            )}

            {/* Links */}
            {loading ? (
              <div className="flex min-h-[240px] items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredLinks.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[280px] text-center rounded-[24px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <Inbox size={28} className="text-text-muted/40 mb-3" />
                <p className="text-[14px] font-semibold text-text-secondary">Brak linków</p>
                <p className="text-[12px] text-text-muted mt-1 max-w-[200px] leading-relaxed">
                  Wyślij link na Telegramie — pojawi się tutaj automatycznie.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLinks.map(link => {
                  const catStyle = CATEGORY_COLORS[link.category] || CATEGORY_COLORS['Inne'];
                  const isExpanded = expandedLinkId === link.id;
                  const isDeleting = deletingIds.has(link.id);
                  const youtubeId = getYouTubeId(link.url);

                  return (
                    <div
                      key={link.id}
                      className={`transition-all duration-[250ms] ease-in-out ${
                        isDeleting ? 'opacity-0 scale-[0.93] -translate-y-2 pointer-events-none' : 'opacity-100 scale-100'
                      }`}
                    >
                    <div
                      className={`pocket-card ${
                        link.status === 'read' ? 'opacity-60 hover:opacity-90' : ''
                      }`}
                    >
                      {/* Thumbnail (YouTube) */}
                      {link.thumbnail_url && (
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="block -mx-4 -mt-4 mb-3 rounded-t-[24px] overflow-hidden">
                          <img
                            src={link.thumbnail_url}
                            alt={link.title}
                            className="w-full h-[180px] object-cover"
                            loading="lazy"
                          />
                        </a>
                      )}

                      {/* Top row */}
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpandedLinkId(p => p === link.id ? null : link.id)}>
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
                                setCategoryFilter(p => p === link.category ? null : link.category);
                              }}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold cursor-pointer hover:opacity-80 active:scale-95 transition-all ${catStyle.pill}`}
                            >
                              {link.category}
                            </span>
                            {(link.notes || notesDrafts[link.id]) && (
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
                          className="btn-press shrink-0 rounded-full p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-solid/60 transition-all duration-75 active:scale-[0.78] active:text-text-primary"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>

                      {/* Expanded: AI Takeaways + Przemyślenia + Kategoria */}
                      <div
                        className={`grid-expand-wrapper ${isExpanded ? 'expanded' : ''}`}
                      >
                        <div className="grid-expand-content">
                          <div className="mt-4 border-t border-border-custom/40 pt-3 space-y-4">
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
                                  {link.takeaways.map((t, i) => (
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
                              <button
                                type="button"
                                disabled={convertingLinkId === link.id}
                                onClick={() => handleLinkToTodo(link)}
                                className="btn-press flex flex-1 min-w-[120px] items-center justify-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-[11px] font-semibold text-primary hover:bg-primary/15 transition-all disabled:opacity-50"
                              >
                                {convertingLinkId === link.id ? <Loader2 size={12} className="animate-spin" /> : <ListTodo size={12} />}
                                Zrób zadanie
                              </button>
                              <button
                                type="button"
                                disabled={convertingLinkId === link.id}
                                onClick={() => handleLinkToNote(link)}
                                className="btn-press flex flex-1 min-w-[120px] items-center justify-center gap-1.5 rounded-xl border border-border-custom px-3 py-2 text-[11px] font-semibold text-text-muted hover:text-text-primary transition-all disabled:opacity-50"
                              >
                                <StickyNote size={12} />
                                Do notatek
                              </button>
                            </div>

                            {/* Kategoria */}
                            <div className="border-t border-border-custom/40 pt-3 space-y-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Kategoria</p>
                              <div className="flex flex-wrap gap-1.5">
                                {CATEGORIES.map(cat => {
                                  const isActive = link.category === cat;
                                  const cStyle = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Inne'];
                                  return (
                                    <button
                                      key={cat}
                                      onClick={() => updateLinkCategory(link.id, cat)}
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
                                {savedNoteId === link.id && (
                                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
                                    <Check size={10} /> Zapisano
                                  </span>
                                )}
                              </div>
                              <textarea
                                value={notesDrafts[link.id] ?? (link.notes || '')}
                                onChange={e => setNotesDrafts(prev => ({ ...prev, [link.id]: e.target.value }))}
                                onBlur={() => saveNotes(link.id)}
                                onFocus={e => {
                                  if (notesDrafts[link.id] === undefined) {
                                    setNotesDrafts(prev => ({ ...prev, [link.id]: link.notes || '' }));
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

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-custom/30">
                        <button
                          onClick={() => { haptic([3]); setExpandedLinkId(p => p === link.id ? null : link.id); }}
                          className="btn-press flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-text-secondary transition-all duration-75 active:scale-[0.88]"
                        >
                          {isExpanded
                            ? <><ChevronUp size={13} /> Zwiń</>
                            : link.takeaways?.length > 0
                              ? <><ChevronDown size={13} /> Wnioski · notatka</>
                              : <><PenLine size={12} /> Notatka</>
                          }
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleReadStatus(link.id, link.status)}
                            className={`btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-75 active:scale-[0.88] ${
                              bouncingIds.has(link.id) ? 'animate-pop-check' : ''
                            } ${
                              link.status === 'unread'
                                ? 'bg-primary/10 text-primary hover:bg-primary/15'
                                : 'bg-surface-solid/60 text-text-muted hover:text-text-secondary'
                            }`}
                          >
                            {link.status === 'unread' ? (
                              <><Check size={12} /> Przeczytane</>
                            ) : (
                              <><BookOpen size={12} /> Cofnij</>
                            )}
                          </button>
                          <button
                            onClick={() => deleteLink(link.id)}
                            className="btn-press rounded-full p-1.5 text-text-muted/50 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-75 active:scale-[0.75]"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex border-t border-border-custom bg-background/95 backdrop-blur-xl">
        <button onClick={() => { haptic([4]); onNavigateTo?.('keep'); }} className="btn-press flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted transition-transform duration-75 active:scale-[0.88]">
          <StickyNote size={22} />
          <span className="text-[11px] font-semibold">Notatki</span>
        </button>
        <button onClick={() => { haptic([4]); onNavigateTo?.('todo'); }} className="btn-press flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted transition-transform duration-75 active:scale-[0.88]">
          <ListTodo size={22} />
          <span className="text-[11px] font-semibold">Zadania</span>
        </button>
        <button className="btn-press flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-primary transition-transform duration-75 active:scale-[0.88]">
          <BookOpen size={22} />
          <span className="text-[11px] font-semibold">Pocket</span>
        </button>
      </nav>
    </div>
  );
}
