import { Pressable } from '../ui/ControlPrimitives';
import { Archive, CheckSquare, Plus, Tag, Trash2 } from 'lucide-react';
import { Note } from '../../lib/notesApi';
import WorkspaceNavigation from '../shared/WorkspaceNavigation';
import WorkspaceSidebar from '../shared/WorkspaceSidebar';

interface KeepSidebarProps {
  notes: Note[];
  allTags: string[];
  sidebarTab: 'notes' | 'archive';
  setSidebarTab: (tab: 'notes' | 'archive') => void;
  activeTag: string | null;
  setActiveTag: (fn: (t: string | null) => string | null) => void;
  setSearch: (v: string) => void;
  goTo: (dest: string) => void;
  onPromptCreateTag: (e: React.MouseEvent) => void;
  onConfirmDeleteTag: (tag: string) => void;
}

export default function KeepSidebar({
  notes, allTags, sidebarTab, setSidebarTab, activeTag, setActiveTag, setSearch,
  goTo, onPromptCreateTag, onConfirmDeleteTag,
}: KeepSidebarProps) {
  return (
    <WorkspaceSidebar>
      <p className="keep-sidebar-section-label">Workspace</p>
      <WorkspaceNavigation active="keep" onNavigate={goTo} />
      <div className="keep-sidebar-separator" />

      <p className="keep-sidebar-section-label">Notatki</p>
      <Pressable
        className={`keep-sidebar-item ${sidebarTab === 'notes' && !activeTag ? 'active' : ''}`}
        onClick={() => { setSidebarTab('notes'); setActiveTag(() => null); setSearch(''); }}
      >
        <CheckSquare size={15} />
        <span>Notatki</span>
        {notes.filter(n => !n.is_archived).length > 0 && (
          <span className="keep-sidebar-count">{notes.filter(n => !n.is_archived).length}</span>
        )}
      </Pressable>
      <Pressable
        className={`keep-sidebar-item ${sidebarTab === 'archive' && !activeTag ? 'active' : ''}`}
        onClick={() => { setSidebarTab('archive'); setActiveTag(() => null); setSearch(''); }}
      >
        <Archive size={15} />
        <span>Archiwum</span>
        {notes.filter(n => n.is_archived).length > 0 && (
          <span className="keep-sidebar-count">{notes.filter(n => n.is_archived).length}</span>
        )}
      </Pressable>

      <div className="keep-sidebar-separator" />
      <div className="flex items-center justify-between keep-sidebar-section-label pr-1.5">
        <span>Tagi</span>
        <Pressable
          onClick={onPromptCreateTag}
          className="p-1 rounded hover:bg-surface-2 dark:hover:bg-on-accent/10 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          title="Dodaj nowy tag"
        >
          <Plus size={13} />
        </Pressable>
      </div>
      {allTags.map(tag => (
        <div
          key={tag}
          className={`group flex items-center justify-between keep-sidebar-item ${activeTag === tag ? 'active' : ''}`}
          onClick={() => { setSidebarTab('notes'); setActiveTag(t => (t === tag ? null : tag)); }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Tag size={13} className="shrink-0" />
            <span className="truncate">{tag}</span>
          </div>
          <Pressable
            type="button"
            onClick={(e) => { e.stopPropagation(); onConfirmDeleteTag(tag); }}
            className="hidden group-hover:flex p-1 rounded hover:bg-danger/10 text-text-muted hover:text-danger transition-colors cursor-pointer"
            title="Usuń tag ze wszystkich notatek"
          >
            <Trash2 size={12} />
          </Pressable>
        </div>
      ))}
      {allTags.length === 0 && (
        <p className="text-xs text-text-muted/40 px-3 py-1.5 italic">brak tagów</p>
      )}
    </WorkspaceSidebar>
  );
}
