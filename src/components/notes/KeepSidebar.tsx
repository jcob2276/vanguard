import { Archive, BookOpen, Calendar, CheckSquare, ListTodo, Plus, Tag, Trash2 } from 'lucide-react';
import { Note } from '../../lib/notesApi';

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
    <aside className="keep-sidebar">
      <p className="keep-sidebar-section-label">Notatki</p>
      <button
        className={`keep-sidebar-item ${sidebarTab === 'notes' && !activeTag ? 'active' : ''}`}
        onClick={() => { setSidebarTab('notes'); setActiveTag(() => null); setSearch(''); }}
      >
        <CheckSquare size={15} />
        <span>Notatki</span>
        {notes.filter(n => !n.is_archived).length > 0 && (
          <span className="keep-sidebar-count">{notes.filter(n => !n.is_archived).length}</span>
        )}
      </button>
      <button
        className={`keep-sidebar-item ${sidebarTab === 'archive' && !activeTag ? 'active' : ''}`}
        onClick={() => { setSidebarTab('archive'); setActiveTag(() => null); setSearch(''); }}
      >
        <Archive size={15} />
        <span>Archiwum</span>
        {notes.filter(n => n.is_archived).length > 0 && (
          <span className="keep-sidebar-count">{notes.filter(n => n.is_archived).length}</span>
        )}
      </button>

      <div className="keep-sidebar-separator" />

      <p className="keep-sidebar-section-label">Nawigacja</p>
      <button className="keep-sidebar-item" onClick={() => goTo('todo')}>
        <ListTodo size={15} />
        <span>To Do</span>
      </button>
      <button className="keep-sidebar-item" onClick={() => goTo('kalendarz')}>
        <Calendar size={15} />
        <span>Kalendarz</span>
      </button>
      <button className="keep-sidebar-item" onClick={() => goTo('links')}>
        <BookOpen size={15} />
        <span>Pocket</span>
      </button>

      <div className="keep-sidebar-separator" />
      <div className="flex items-center justify-between keep-sidebar-section-label pr-1.5">
        <span>Tagi</span>
        <button
          onClick={onPromptCreateTag}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          title="Dodaj nowy tag"
        >
          <Plus size={13} />
        </button>
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
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onConfirmDeleteTag(tag); }}
            className="hidden group-hover:flex p-1 rounded hover:bg-danger/10 text-text-muted hover:text-danger transition-colors cursor-pointer"
            title="Usuń tag ze wszystkich notatek"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      {allTags.length === 0 && (
        <p className="text-[10.5px] text-text-muted/40 px-3 py-1.5 italic">brak tagów</p>
      )}
    </aside>
  );
}
