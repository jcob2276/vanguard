import React, { useState } from 'react';
import { Plus, Search, Inbox, CalendarDays, CalendarClock, ChevronDown, Pencil, Trash2, StickyNote, ListTodo, Calendar, BookOpen, Bell, PanelLeft } from 'lucide-react';

export type TodoNavDest = 'overview' | 'inbox' | 'today' | 'upcoming';

export interface TodoSidebarProps {
  navDest: TodoNavDest;
  onNavDest: (dest: TodoNavDest) => void;
  inboxCount: number;
  todayCount: number;
  upcomingCount: number;
  sections: { id: string; name: string }[];
  activeSectionId: string | null;
  onSelectSection: (id: string) => void;
  onAddSection: (name: string) => void;
  onRenameSection: (id: string, name: string) => void;
  onDeleteSection: (id: string) => void;
  onQuickAdd: () => void;
  onFocusSearch: () => void;
  onNavigateTo?: (dest: 'todo' | 'keep' | 'links' | 'kalendarz') => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
        active ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-solid/50 hover:text-text-primary'
      }`}
    >
      <span className={active ? 'text-primary' : 'text-text-muted/60'}>{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
      {!!count && <span className="text-[10px] font-semibold text-text-muted/50 tabular-nums">{count}</span>}
    </button>
  );
}

export default function TodoSidebar({
  collapsed,
  onToggleCollapse,
  navDest,
  onNavDest,
  inboxCount,
  todayCount,
  upcomingCount,
  sections,
  activeSectionId,
  onSelectSection,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onQuickAdd,
  onFocusSearch,
  onNavigateTo,
}: TodoSidebarProps) {
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const commitAdd = () => {
    const n = newName.trim();
    if (n) onAddSection(n);
    setNewName('');
    setAdding(false);
  };

  const commitRename = (id: string) => {
    const n = renameVal.trim();
    if (n) onRenameSection(id, n);
    setRenamingId(null);
  };

  return (
    <aside className={`w-[230px] shrink-0 border-r border-border-custom/40 bg-surface/20 px-2.5 py-3 flex flex-col gap-3 overflow-y-auto transition-all duration-300 ${collapsed ? '!w-0 !px-0 !py-0 !border-r-0 overflow-hidden' : ''}`}>
      {/* Profile Header */}
      <div className="flex items-center justify-between px-2 py-1 mb-1 shrink-0">
        <div className="flex items-center gap-2 cursor-pointer hover:bg-text-primary/[0.04] p-1 rounded-lg transition-colors">
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-black text-primary">
            K
          </div>
          <span className="text-[13px] font-black text-text-primary">Kuba</span>
          <ChevronDown size={11} className="text-text-muted/60" />
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 text-text-muted hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-colors cursor-pointer" title="Powiadomienia">
            <Bell size={14} />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-colors cursor-pointer"
            title="Zwiń panel boczny"
          >
            <PanelLeft size={14} />
          </button>
        </div>
      </div>
      {/* Workspace Section */}
      <div className="flex flex-col gap-0.5">
        <p className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-text-muted/60">Workspace</p>
        <NavItem
          icon={<StickyNote size={14} />}
          label="Notatki"
          active={false}
          onClick={() => onNavigateTo?.('keep')}
        />
        <NavItem
          icon={<ListTodo size={14} />}
          label="Zadania"
          active={navDest === 'overview' && !activeSectionId}
          onClick={() => {
            onNavDest('overview');
            onNavigateTo?.('todo');
          }}
        />
        <NavItem
          icon={<Calendar size={14} />}
          label="Kalendarz"
          active={false}
          onClick={() => onNavigateTo?.('kalendarz')}
        />
        <NavItem
          icon={<BookOpen size={14} />}
          label="Pocket"
          active={false}
          onClick={() => onNavigateTo?.('links')}
        />
      </div>


      <button
        onClick={onFocusSearch}
        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-solid/50 hover:text-text-primary transition-colors"
      >
        <Search size={14} className="text-text-muted/60" />
        Szukaj
      </button>

      <div className="border-t border-border-custom/30 pt-2 flex flex-col gap-0.5">
        <NavItem
          icon={<Inbox size={14} />}
          label="Skrzynka"
          count={inboxCount}
          active={navDest === 'inbox'}
          onClick={() => onNavDest('inbox')}
        />
        <NavItem
          icon={<CalendarDays size={14} />}
          label="Dziś"
          count={todayCount}
          active={navDest === 'today'}
          onClick={() => onNavDest('today')}
        />
        <NavItem
          icon={<CalendarClock size={14} />}
          label="Nadchodzące"
          count={upcomingCount}
          active={navDest === 'upcoming'}
          onClick={() => onNavDest('upcoming')}
        />
      </div>

      <div className="border-t border-border-custom/30 pt-2 flex-1 min-h-0 flex flex-col">
        <button
          onClick={() => setProjectsOpen((v) => !v)}
          className="flex w-full items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-text-muted/60 hover:text-text-primary transition-colors"
        >
          <ChevronDown size={11} className={`transition-transform ${projectsOpen ? '' : '-rotate-90'}`} />
          Moje projekty
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              setProjectsOpen(true);
              setAdding(true);
            }}
            className="ml-auto p-0.5 text-text-muted/40 hover:text-primary transition-colors"
            title="Dodaj listę"
          >
            <Plus size={12} />
          </span>
        </button>

        {projectsOpen && (
          <div className="mt-0.5 flex flex-col gap-0.5 overflow-y-auto">
            {sections.map((s) => (
              <div key={s.id} className="group/sec relative flex items-center">
                {renamingId === s.id ? (
                  <input
                    autoFocus
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onBlur={() => commitRename(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(s.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    className="flex-1 rounded-lg border border-primary/40 bg-surface-solid px-2 py-1 text-[12px] font-semibold text-primary outline-none"
                  />
                ) : (
                  <>
                    <button
                      onClick={() => onSelectSection(s.id)}
                      className={`flex-1 min-w-0 truncate rounded-xl px-2.5 py-1 text-left text-[12px] font-semibold transition-colors ${
                        navDest === 'overview' && activeSectionId === s.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-text-secondary hover:bg-surface-solid/50 hover:text-text-primary'
                      }`}
                    >
                      {s.name}
                    </button>
                    <div className="absolute right-1 hidden items-center gap-0.5 group-hover/sec:flex bg-surface/20">
                      <button
                        onClick={() => {
                          setRenamingId(s.id);
                          setRenameVal(s.name);
                        }}
                        className="p-1 text-text-muted/40 hover:text-primary transition-colors"
                        title="Zmień nazwę"
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        onClick={() => onDeleteSection(s.id)}
                        className="p-1 text-text-muted/40 hover:text-rose-400 transition-colors"
                        title="Usuń listę"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {adding ? (
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={commitAdd}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitAdd();
                  if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                }}
                placeholder="Nazwa listy…"
                className="mt-0.5 rounded-lg border border-primary/40 bg-surface-solid px-2 py-1 text-[12px] font-semibold text-primary outline-none"
              />
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="mt-0.5 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-medium text-text-muted/40 hover:text-text-primary transition-colors"
              >
                <Plus size={12} /> Nowa lista
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
