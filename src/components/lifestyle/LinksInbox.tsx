import {
  BookOpen,
  ChevronLeft,
  Grid3X3,
  Inbox,
  LayoutList,
  Link2,
  ListTodo,
  Plus,
  Search,
  StickyNote,
  X,
  Sparkles,
} from 'lucide-react';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';
import { useHaptics } from '../../hooks/useHaptics';
import { useLinksInboxData } from './links/useLinksInboxData';
import { LinksTriagePanel } from './LinksTriagePanel';
import { LinksInboxItem } from './links/LinksInboxItem';

const CATEGORY_COLORS: Record<string, { pill: string }> = {
  Kariera:    { pill: 'bg-primary/10 text-primary dark:text-primary' },
  Zdrowie:    { pill: 'bg-success/10 text-success dark:text-success' },
  Technologia:{ pill: 'bg-info/10 text-info dark:text-info' },
  Biznes:     { pill: 'bg-warning/10 text-warning dark:text-warning' },
  Inne:       { pill: 'bg-slate-500/10 text-slate-500 dark:text-slate-400' },
};

const STATUS_TABS: { id: 'unread' | 'read' | 'all'; label: string }[] = [
  { id: 'unread', label: 'Nieprzeczytane' },
  { id: 'read',   label: 'Przeczytane' },
  { id: 'all',    label: 'Wszystkie' },
];

const CATEGORIES = ['Kariera', 'Zdrowie', 'Technologia', 'Biznes', 'Inne'];



export default function LinksInbox({ onBack, onNavigateTo }: { onBack: () => void; onNavigateTo?: (dest: string) => void }) {
  const haptics = useHaptics();
  const haptic = (pattern: number | number[]) => {
    haptics.vibrate(pattern);
  };
  const d = useLinksInboxData(haptic);

  const goTo = (view: string) => {
    if (onNavigateTo) onNavigateTo(view);
  };

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
                className={`keep-sidebar-item ${d.categoryFilter === cat ? 'active' : ''}`}
                onClick={() => d.setCategoryFilter(p => p === cat ? null : cat)}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${
                  cat === 'Kariera' ? 'bg-primary' :
                  cat === 'Zdrowie' ? 'bg-success' :
                  cat === 'Technologia' ? 'bg-info' :
                  cat === 'Biznes' ? 'bg-warning' : 'bg-slate-400'
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
              {d.unreadCount > 0 ? `${d.unreadCount} nieprzeczytanych` : 'Wszystko przeczytane'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => d.setViewMode(v => v === 'card' ? 'list' : 'card')}
            className="rounded-full p-2 text-text-muted hover:text-text-primary hover:bg-surface-solid/60 transition-colors"
            title={d.viewMode === 'card' ? 'Widok listy' : 'Widok kart'}
          >
            {d.viewMode === 'card' ? <LayoutList size={16} /> : <Grid3X3 size={16} />}
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={d.handleAiTriage}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-primary hover:bg-primary/20 transition-colors"
            title="Automatyczny Triage AI"
            icon={<Sparkles size={15} />}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { d.setShowAddForm(p => !p); d.setAddUrl(''); }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            icon={d.showAddForm ? <X size={15} /> : <Plus size={15} />}
          />
        </header>

        {/* Inline add-link form */}
        <div
          className={`grid-expand-wrapper ${d.showAddForm ? 'expanded' : ''}`}
        >
          <div className="grid-expand-content border-b border-border-custom/60 bg-surface/60 backdrop-blur-sm">
            <div className="max-w-[640px] mx-auto flex items-center gap-2 px-5 py-3.5">
              <Link2 size={14} className="shrink-0 text-text-muted" />
              <input
                autoFocus
                type="url"
                value={d.addUrl}
                onChange={e => d.setAddUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') d.handleAddLink(); if (e.key === 'Escape') d.setShowAddForm(false); }}
                placeholder="Wklej URL i naciśnij Enter..."
                className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted/50 outline-none"
              />
              {d.addLoading
                ? <Spinner size="sm" className="shrink-0" />
                : <Button
                    variant="ghost"
                    size="sm"
                    onClick={d.handleAddLink}
                    disabled={!d.addUrl.trim()}
                    className="shrink-0 text-[12px] font-semibold text-primary disabled:opacity-30 hover:opacity-70 transition-opacity"
                  >
                    Zapisz
                  </Button>
              }
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[640px] mx-auto px-5 py-5 pb-24 space-y-4">

            {/* Search Input Bar */}
            <div className="relative flex items-center gap-2.5 rounded-2xl bg-surface border border-border-custom/40 px-4 py-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
              <Search size={15} className="text-text-muted shrink-0" />
              <input
                value={d.search}
                onChange={e => d.setSearch(e.target.value)}
                placeholder="Szukaj po tytule, domenie lub kategorii..."
                className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted/40 outline-none w-full"
              />
              {d.search && (
                <Button variant="ghost" size="sm" onClick={() => d.setSearch('')} className="p-1 text-text-muted/50 hover:text-text-primary" icon={<X size={15} />} />
              )}
            </div>

            {/* Status tabs */}
            <div className="flex gap-0.5 p-1 rounded-[14px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { haptic([4]); d.setStatusFilter(tab.id); }}
                  className={`btn-press flex-1 py-1.5 text-[12px] font-semibold rounded-[10px] transition-all duration-150 active:scale-[0.93] ${
                    d.statusFilter === tab.id
                      ? 'bg-background text-text-primary shadow-sm'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {d.sharingStatus && (
              <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary text-[12px] font-semibold rounded-[14px] animate-pulse">
                <Spinner size="sm" className="shrink-0" />
                {d.sharingStatus}
              </div>
            )}

            {/* Links */}            {d.loading ? (
              <div className="flex min-h-[240px] items-center justify-center">
                <Spinner size="md" />
              </div>
            ) : d.filteredLinks.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[280px] text-center rounded-[24px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <Inbox size={28} className="text-text-muted/40 mb-3" />
                <p className="text-[14px] font-semibold text-text-secondary">Brak linków</p>
                <p className="text-[12px] text-text-muted mt-1 max-w-[200px] leading-relaxed">
                  Wyślij link na Telegramie — pojawi się tutaj automatycznie.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {d.filteredLinks.map(link => (
                  <LinksInboxItem
                    key={link.id}
                    link={link}
                    d={d}
                    haptic={haptic}
                    CATEGORY_COLORS={CATEGORY_COLORS}
                    CATEGORIES={CATEGORIES}
                  />
                ))}
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

      <LinksTriagePanel
        showTriagePanel={d.showTriagePanel}
        setShowTriagePanel={d.setShowTriagePanel}
        triageLoading={d.triageLoading}
        triageSuggestions={d.triageSuggestions}
        setTriageSuggestions={d.setTriageSuggestions}
        links={d.links}
        applyTriageSuggestion={d.applyTriageSuggestion}
      />
    </div>
  );
}
