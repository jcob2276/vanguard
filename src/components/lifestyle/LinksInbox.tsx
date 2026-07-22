import { Pressable } from '../ui/ControlPrimitives';
import {
  Grid3X3,
  Inbox,
  LayoutList,
  Link2,
  Plus,
  X,
  Sparkles,
} from 'lucide-react';
/**
 * @component LinksInbox
 * @role Share-target PWA — zapisywanie i triage linków z przeglądarki.
 * @composes LinksTriagePanel, links/LinksInboxItem
 * @folders links/ = useLinksInboxData, LinksInboxItem
 */
import Spinner from '../ui/Spinner';
import { useHaptics } from '../../hooks/useHaptics';
import { useLinksInboxData } from './links/useLinksInboxData';
import { LinksTriagePanel } from './LinksTriagePanel';
import { LinksInboxItem } from './links/LinksInboxItem';
import WorkspaceNavigation from '../shared/WorkspaceNavigation';
import { WorkspaceHeader } from '../shared/WorkspaceHeader';
import WorkspaceSidebar from '../shared/WorkspaceSidebar';
import SidebarSection from '../shared/SidebarSection';
import Input from '../ui/Input';

const CATEGORY_COLORS: Record<string, { pill: string }> = {
  Kariera:    { pill: 'bg-primary/10 text-primary dark:text-primary' },
  Zdrowie:    { pill: 'bg-success/10 text-success dark:text-success' },
  Technologia:{ pill: 'bg-info/10 text-info dark:text-info' },
  Biznes:     { pill: 'bg-warning/10 text-warning dark:text-warning' },
  Inne:       { pill: 'bg-surface-2/10 text-text-muted dark:text-text-muted' },
};

const CATEGORY_DOTS: Record<string, string> = {
  Kariera: 'var(--color-primary)',
  Zdrowie: 'var(--color-success)',
  Technologia: 'var(--color-info)',
  Biznes: 'var(--color-warning)',
  Inne: 'var(--color-surface-2)',
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
        .animate-pop-check { animation:var(--ds-inline-css-pop-check-0-38s-cubic-bezier-36-07-19-97-both); }
        .animate-pop-delete { animation:var(--ds-inline-css-pop-delete-0-25s-cubic-bezier-36-07-19-97-both); }
        .btn-press { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
      `}</style>

      {/* Sidebar */}
      <WorkspaceSidebar>
        <WorkspaceNavigation active="links" onNavigate={onNavigateTo} />

        {CATEGORIES.length > 0 && (
          <>
            <div className="keep-sidebar-separator" />
            <SidebarSection
              label="Kategorie"
              items={CATEGORIES.map(cat => ({
                id: cat,
                label: cat,
                active: d.categoryFilter === cat,
                colorDot: CATEGORY_DOTS[cat] ?? CATEGORY_DOTS.Inne,
                onClick: () => d.setCategoryFilter(p => p === cat ? null : cat),
              }))}
            />
          </>
        )}
      </WorkspaceSidebar>

      {/* Main column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        <WorkspaceHeader
          title="Pocket"
          subtitle={d.unreadCount > 0 ? `${d.unreadCount} nieprzeczytanych` : 'Wszystko przeczytane'}
          onBack={onBack}
          actions={
            <>
              <Pressable variant="ghost" size="sm" onClick={() => d.setViewMode(v => v === 'card' ? 'list' : 'card')} aria-label={d.viewMode === 'card' ? 'Widok listy' : 'Widok kart'}>
                {d.viewMode === 'card' ? <LayoutList size={16} /> : <Grid3X3 size={16} />}
              </Pressable>
              <Pressable variant="ghost" size="sm" onClick={d.handleAiTriage} title="Automatyczny Triage AI" icon={<Sparkles size={15} />} />
              <Pressable variant="tonal" size="sm" onClick={() => { d.setShowAddForm(p => !p); d.setAddUrl(''); }} aria-label={d.showAddForm ? 'Zamknij formularz dodawania linku' : 'Dodaj link'} icon={d.showAddForm ? <X size={15} /> : <Plus size={15} />} />
            </>
          }
          tabs={{
            items: STATUS_TABS.map((tab) => ({ key: tab.id, label: tab.label })),
            active: d.statusFilter,
            onChange: (key) => { haptic([4]); d.setStatusFilter(key as 'unread' | 'read' | 'all'); },
          }}
          secondaryRow={
            <div
              className={`grid-expand-wrapper ${d.showAddForm ? 'expanded' : ''}`}
            >
              <div className="grid-expand-content border-b border-border-custom/60 bg-surface/60 backdrop-blur-[var(--blur-sm)]">
                <div className="max-w-[var(--ds-maxw-640px)] mx-auto flex items-center gap-2 px-5 py-3.5">
                  <Link2 size={14} className="shrink-0 text-text-muted" />
                  <Input
                    autoFocus
                    type="url"
                    value={d.addUrl}
                    onChange={e => d.setAddUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') d.handleAddLink(); if (e.key === 'Escape') d.setShowAddForm(false); }}
                    placeholder="Wklej URL i naciśnij Enter..."
                    className="flex-1 border-0 bg-transparent text-sm shadow-none placeholder:text-text-muted/50"
                  />
                  {d.addLoading
                    ? <Spinner size="sm" className="shrink-0" />
                    : <Pressable
                        variant="ghost"
                        size="sm"
                        onClick={d.handleAddLink}
                        disabled={!d.addUrl.trim()}
                        className="shrink-0 text-sm font-semibold text-primary disabled:opacity-[var(--opacity-30)] hover:opacity-[var(--opacity-70)] transition-opacity"
                      >
                        Zapisz
                      </Pressable>
                  }
                </div>
              </div>
            </div>
          }
        />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[var(--ds-maxw-640px)] mx-auto px-5 py-5 pb-24 space-y-4">

            {d.sharingStatus && (
              <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary text-sm font-semibold rounded-[var(--radius-md)] animate-pulse">
                <Spinner size="sm" className="shrink-0" />
                {d.sharingStatus}
              </div>
            )}

            {/* Links */}
            {d.loading ? (
              <div className="flex min-h-[var(--ds-h-240px)] items-center justify-center">
                <Spinner size="md" />
              </div>
            ) : d.filteredLinks.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[var(--ds-h-280px)] text-center rounded-[var(--radius-xl)] bg-surface shadow-[var(--ds-shadow-0-1px-4px-rgba-0-0-0-0-06)]">
                <Inbox size={28} className="text-text-muted/40 mb-3" />
                <p className="text-base font-semibold text-text-secondary">Brak linków</p>
                <p className="text-sm text-text-muted mt-1 max-w-[var(--ds-maxw-200px)] leading-relaxed">
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
      <WorkspaceNavigation
        active="links"
        orientation="horizontal"
        onNavigate={(destination) => { haptic([4]); onNavigateTo?.(destination); }}
        className="md:hidden fixed bottom-0 inset-x-0 z-[var(--z-overlay)] border-t border-border-custom bg-background/95 backdrop-blur-[var(--blur-xl)]"
      />

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
