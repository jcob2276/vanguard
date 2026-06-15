import { useEffect, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ExternalLink,
  Inbox,
  ListTodo,
  StickyNote,
  Trash2,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

interface SavedLink {
  id: string;
  url: string;
  title: string;
  description: string;
  takeaways: string[];
  category: string;
  domain: string;
  status: 'unread' | 'read';
  created_at: string;
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

export default function LinksInbox({ session, onBack }: { session: Session; onBack: () => void }) {
  const [links, setLinks] = useState<SavedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('unread');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);
  const [sharingStatus, setSharingStatus] = useState<string | null>(null);

  const goTo = (view: string) => {
    localStorage.setItem('vanguard_view', view);
    window.location.href = '/';
  };

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
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
  };

  const saveSharedLink = async (actualUrl: string) => {
    setLoading(true);
    setSharingStatus('Zapisywanie udostępnionego linku...');
    try {
      const base = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${base}/functions/v1/vanguard-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: 'share_target', url: actualUrl, userId: session.user.id }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      setSharingStatus('Zapisano!');
      setTimeout(() => setSharingStatus(null), 2500);
    } catch (err) {
      console.error('[LinksInbox] Failed to process shared link:', err);
      alert(`Błąd zapisu linku: ${(err as Error).message}`);
      setSharingStatus(null);
    } finally {
      fetchLinks();
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
  }, [session.user.id]);

  const toggleReadStatus = async (id: string, current: 'unread' | 'read') => {
    const next = current === 'unread' ? 'read' : 'unread';
    setLinks(prev => prev.map(l => l.id === id ? { ...l, status: next } : l));
    const { error } = await (supabase as any)
      .from('vanguard_links').update({ status: next, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) fetchLinks();
  };

  const deleteLink = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten link?')) return;
    setLinks(prev => prev.filter(l => l.id !== id));
    const { error } = await (supabase as any).from('vanguard_links').delete().eq('id', id);
    if (error) fetchLinks();
  };

  const filteredLinks = links.filter(link => {
    const matchesStatus = statusFilter === 'all' || link.status === statusFilter;
    const matchesCategory = !categoryFilter || link.category === categoryFilter;
    return matchesStatus && matchesCategory;
  });

  const unreadCount = links.filter(l => l.status === 'unread').length;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-text-primary">

      {/* Sidebar */}
      <aside className="keep-sidebar">
        <p className="keep-sidebar-section-label">Workspace</p>
        <a href="/keep" className="keep-sidebar-item">
          <StickyNote size={15} /><span>Notatki</span>
        </a>
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
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bookmark size={15} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[640px] mx-auto px-5 py-5 pb-24 space-y-4">

            {/* Status tabs */}
            <div className="flex gap-0.5 p-1 rounded-[14px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`flex-1 py-1.5 text-[12px] font-semibold rounded-[10px] transition-all ${
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
              <div className="flex flex-col items-center justify-center min-h-[280px] text-center rounded-[18px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
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

                  return (
                    <div
                      key={link.id}
                      className={`rounded-[18px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.07),0_2px_14px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_6px_rgba(0,0,0,0.25),0_2px_18px_rgba(0,0,0,0.18)] p-4 transition-opacity ${
                        link.status === 'read' ? 'opacity-60 hover:opacity-90' : ''
                      }`}
                    >
                      {/* Top row */}
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpandedLinkId(p => p === link.id ? null : link.id)}>
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="text-[11px] text-text-muted">{link.domain || 'link'}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${catStyle.pill}`}>
                              {link.category}
                            </span>
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
                          className="shrink-0 rounded-full p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-solid/60 transition-colors"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>

                      {/* AI Takeaways */}
                      {link.takeaways && link.takeaways.length > 0 && (
                        <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[400px] mt-4' : 'max-h-0'}`}>
                          <div className="border-t border-border-custom/40 pt-3 space-y-2">
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
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-custom/30">
                        {link.takeaways && link.takeaways.length > 0 ? (
                          <button
                            onClick={() => setExpandedLinkId(p => p === link.id ? null : link.id)}
                            className="flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-text-secondary transition-colors"
                          >
                            {isExpanded ? <><ChevronUp size={13} /> Zwiń</> : <><ChevronDown size={13} /> Wnioski</>}
                          </button>
                        ) : <div />}

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleReadStatus(link.id, link.status)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
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
                            className="rounded-full p-1.5 text-text-muted/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
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
    </div>
  );
}
