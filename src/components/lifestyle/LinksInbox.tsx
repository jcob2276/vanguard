import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  BookOpen,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Inbox,
  Filter
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

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Kariera': { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/10' },
  'Zdrowie': { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/10' },
  'Technologia': { bg: 'bg-sky-500/10 dark:bg-sky-500/20', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/10' },
  'Biznes': { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/10' },
  'Inne': { bg: 'bg-slate-500/10 dark:bg-slate-500/20', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/10' },
};

export default function LinksInbox({ session, onBack }: { session: Session; onBack: () => void }) {
  const [links, setLinks] = useState<SavedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('unread');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);

  const [sharingStatus, setSharingStatus] = useState<string | null>(null);

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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          type: 'share_target',
          url: actualUrl,
          userId: session.user.id
        })
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      setSharingStatus('Zapisano pomyślnie!');
      setTimeout(() => setSharingStatus(null), 3000);
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
    const sharedUrl = params.get('share_url');
    const sharedText = params.get('share_text');

    const urlCandidate = sharedUrl || sharedText || '';
    const match = urlCandidate.match(/https?:\/\/[^\s]+/);

    if (match) {
      const actualUrl = match[0];
      // Wyczyść URL w przeglądarce, aby nie przetwarzać ponownie przy odświeżeniu
      window.history.replaceState({}, document.title, '/');
      saveSharedLink(actualUrl);
    } else {
      fetchLinks();
    }
  }, [session.user.id]);

  const toggleReadStatus = async (id: string, currentStatus: 'unread' | 'read') => {
    const newStatus = currentStatus === 'unread' ? 'read' : 'unread';
    try {
      // Optimistic update
      setLinks(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));

      const { error } = await (supabase as any)
        .from('vanguard_links')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('[LinksInbox] Failed to update link status:', err);
      fetchLinks(); // Revert on failure
    }
  };

  const deleteLink = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten link?')) return;
    try {
      setLinks(prev => prev.filter(l => l.id !== id));
      const { error } = await (supabase as any).from('vanguard_links').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('[LinksInbox] Failed to delete link:', err);
      fetchLinks();
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedLinkId(prev => (prev === id ? null : id));
  };

  // Filter links
  const filteredLinks = links.filter(link => {
    const matchesStatus = statusFilter === 'all' || link.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || link.category === categoryFilter;
    return matchesStatus && matchesCategory;
  });

  const unreadCount = links.filter(l => l.status === 'unread').length;

  const categories = ['all', 'Kariera', 'Zdrowie', 'Technologia', 'Biznes', 'Inne'];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border-custom bg-background/80 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-full border border-border-custom bg-surface-solid/40 dark:bg-white/[0.03] p-2.5 text-text-secondary hover:text-text-primary active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="font-display text-sm font-black uppercase tracking-[0.25em] text-primary">Zapisane linki</h2>
            <p className="text-[10px] font-bold text-text-muted mt-0.5">
              {unreadCount > 0 ? `${unreadCount} nieprzeczytanych` : 'Wszystko przeczytane!'}
            </p>
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bookmark size={15} />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-5 pb-24 space-y-6">
        {/* Status filters */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-border-custom/30 border border-border-custom">
          {(['unread', 'read', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                statusFilter === f
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {f === 'unread' ? 'Nieprzeczytane' : f === 'read' ? 'Przeczytane' : 'Wszystkie'}
            </button>
          ))}
        </div>

        {/* Category tags filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-none">
          <div className="flex gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all shrink-0 cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-primary/10 border-primary/20 text-primary'
                    : 'bg-surface border-border-custom text-text-secondary hover:border-text-secondary/20'
                }`}
              >
                {cat === 'all' ? '🏷️ Wszystkie' : cat}
              </button>
            ))}
          </div>
        </div>

        {sharingStatus && (
          <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold rounded-[20px] animate-pulse">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
            <span>{sharingStatus}</span>
          </div>
        )}

        {/* Links list */}
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[320px] text-center p-8 rounded-[24px] border border-dashed border-border-custom bg-surface/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-border-custom/50 text-text-muted mb-4">
              <Inbox size={22} />
            </div>
            <p className="text-[13px] font-semibold text-text-secondary">Brak zapisanych linków</p>
            <p className="text-[10px] text-text-muted mt-1 max-w-[200px] leading-relaxed">
              Prześlij link na Telegramie, a pojawi się tutaj gotowy do przeczytania.
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
                  className={`group rounded-[24px] border border-border-custom bg-surface backdrop-blur-md p-4 transition-all duration-300 shadow-sm ${
                    link.status === 'read' ? 'opacity-70 hover:opacity-100' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1" onClick={() => toggleExpand(link.id)}>
                      {/* Meta badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-bold text-text-muted tracking-tight">
                          🌐 {link.domain || 'link'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-wide border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                          {link.category}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="font-display text-[14.5px] font-black tracking-tight text-text-primary mt-2 group-hover:text-primary transition-colors cursor-pointer leading-snug">
                        {link.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Open Link */}
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-2 text-text-secondary hover:text-text-primary hover:bg-border-custom/50 active:scale-90 transition-all"
                        title="Otwórz link"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>

                  {/* Description */}
                  {link.description && (
                    <p className="text-[11.5px] text-text-secondary leading-relaxed mt-2" onClick={() => toggleExpand(link.id)}>
                      {link.description}
                    </p>
                  )}

                  {/* AI Takeaways (Collapsible) */}
                  {link.takeaways && link.takeaways.length > 0 && (
                    <div 
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        isExpanded ? 'max-h-[300px] mt-4 pt-3 border-t border-border-custom' : 'max-h-0'
                      }`}
                    >
                      <h4 className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-2.5">
                        💡 AI Takeaways (Kluczowe Wnioski)
                      </h4>
                      <ul className="space-y-2">
                        {link.takeaways.map((takeaway, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-[12px] leading-relaxed text-text-primary">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[9px] font-bold text-primary">
                              {i + 1}
                            </span>
                            <span>{takeaway}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions footer */}
                  <div className="flex items-center justify-between border-t border-border-custom/40 mt-4 pt-3">
                    {link.takeaways && link.takeaways.length > 0 ? (
                      <button
                        onClick={() => toggleExpand(link.id)}
                        className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-text-muted hover:text-text-primary cursor-pointer"
                      >
                        {isExpanded ? (
                          <>Zwiń <ChevronUp size={12} /></>
                        ) : (
                          <>Wnioski <ChevronDown size={12} /></>
                        )}
                      </button>
                    ) : (
                      <div />
                    )}

                    <div className="flex items-center gap-2">
                      {/* Read status toggle */}
                      <button
                        onClick={() => toggleReadStatus(link.id, link.status)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9.5px] font-bold border transition-all cursor-pointer ${
                          link.status === 'unread'
                            ? 'bg-primary/5 hover:bg-primary/10 border-primary/10 text-primary'
                            : 'bg-surface-solid/40 hover:bg-surface-solid border-border-custom text-text-secondary'
                        }`}
                      >
                        {link.status === 'unread' ? (
                          <>
                            <Check size={11} /> Przeczytane
                          </>
                        ) : (
                          <>
                            <BookOpen size={11} /> Cofnij do nieprzeczytanych
                          </>
                        )}
                      </button>

                      {/* Delete link */}
                      <button
                        onClick={() => deleteLink(link.id)}
                        className="rounded-xl border border-border-custom bg-surface-solid/20 hover:bg-red-500/10 hover:text-red-500 p-2 text-text-secondary transition-all cursor-pointer"
                        title="Usuń"
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
      </main>
    </div>
  );
}
