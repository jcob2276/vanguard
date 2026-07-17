import { Pressable, ControlInput } from '../ui/ControlPrimitives';
import { useState } from 'react';
import { Plus, Inbox, CalendarDays, CalendarClock, ChevronDown, Pencil, Trash2, Bell, PanelLeft } from 'lucide-react';
import WorkspaceNavigation from '../shared/WorkspaceNavigation';
import type { WorkspaceDestination } from '../shared/WorkspaceNavigation';
import WorkspaceSidebar from '../shared/WorkspaceSidebar';
import SidebarSection from '../shared/SidebarSection';

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
  onNavigateTo?: (dest: WorkspaceDestination) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
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
  onQuickAdd: _onQuickAdd,
  onNavigateTo,
}: TodoSidebarProps) {
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
    <WorkspaceSidebar collapsed={collapsed} onCollapse={onToggleCollapse} className="gap-3">
      {/* Profile Header */}
      <div className="hidden">
        <div className="flex items-center gap-2 cursor-pointer hover:bg-text-primary/[0.04] p-1 rounded-lg transition-colors">
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-black text-primary">
            K
          </div>
          <span className="text-sm font-black text-text-primary">Kuba</span>
          <ChevronDown size={11} className="text-text-muted/60" />
        </div>
        <div className="flex items-center gap-1">
          <Pressable className="p-1.5 text-text-muted hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-colors cursor-pointer" title="Powiadomienia">
            <Bell size={14} />
          </Pressable>
          <Pressable
            onClick={onToggleCollapse}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-colors cursor-pointer"
            title="Zwiń panel boczny"
          >
            <PanelLeft size={14} />
          </Pressable>
        </div>
      </div>
      {/* Workspace Section */}
      <div className="flex flex-col gap-0.5">
        <p className="px-2.5 py-1 text-xs font-black uppercase tracking-wider text-text-muted/60">Workspace</p>
        <WorkspaceNavigation
          active="todo"
          onNavigate={(destination) => {
            if (destination === 'todo') onNavDest('overview');
            onNavigateTo?.(destination);
          }}
        />
      </div>


      <SidebarSection
        bordered
        items={[
          {
            id: 'inbox',
            label: 'Skrzynka',
            icon: <Inbox size={14} />,
            count: inboxCount,
            active: navDest === 'inbox',
            onClick: () => onNavDest('inbox'),
          },
          {
            id: 'today',
            label: 'Dziś',
            icon: <CalendarDays size={14} />,
            count: todayCount,
            active: navDest === 'today',
            onClick: () => onNavDest('today'),
          },
          {
            id: 'upcoming',
            label: 'Nadchodzące',
            icon: <CalendarClock size={14} />,
            count: upcomingCount,
            active: navDest === 'upcoming',
            onClick: () => onNavDest('upcoming'),
          },
        ]}
      />

      <SidebarSection
        key={adding ? 'projects-adding' : 'projects'}
        label="Moje projekty"
        collapsible
        defaultOpen
        onAdd={() => setAdding(true)}
        addTitle="Dodaj listę"
        bordered
        className="flex-1 min-h-0"
        items={sections.map((s) => ({
          id: s.id,
          label: s.name,
          active: navDest === 'overview' && activeSectionId === s.id,
          onClick: () => onSelectSection(s.id),
          editing: renamingId === s.id ? (
            <ControlInput
              autoFocus
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onBlur={() => commitRename(s.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(s.id);
                if (e.key === 'Escape') setRenamingId(null);
              }}
              className="flex-1 rounded-lg border border-primary/40 bg-surface-solid px-2 py-1 text-sm font-semibold text-primary outline-none"
            />
          ) : undefined,
          actions: renamingId === s.id ? undefined : (
            <>
              <Pressable
                onClick={() => {
                  setRenamingId(s.id);
                  setRenameVal(s.name);
                }}
                className="p-1 text-text-muted/40 hover:text-primary transition-colors"
                title="Zmień nazwę"
              >
                <Pencil size={10} />
              </Pressable>
              <Pressable
                onClick={() => onDeleteSection(s.id)}
                className="p-1 text-text-muted/40 hover:text-danger transition-colors"
                title="Usuń listę"
              >
                <Trash2 size={10} />
              </Pressable>
            </>
          ),
        }))}
        trailingAdd={
          adding ? (
            <ControlInput
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={commitAdd}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitAdd();
                if (e.key === 'Escape') { setAdding(false); setNewName(''); }
              }}
              placeholder="Nazwa listy…"
              className="mt-0.5 rounded-lg border border-primary/40 bg-surface-solid px-2 py-1 text-sm font-semibold text-primary outline-none"
            />
          ) : (
            <Pressable
              onClick={() => setAdding(true)}
              className="mt-0.5 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium text-text-muted/40 hover:text-text-primary transition-colors"
            >
              <Plus size={12} /> Nowa lista
            </Pressable>
          )
        }
      />
    </WorkspaceSidebar>
  );
}
