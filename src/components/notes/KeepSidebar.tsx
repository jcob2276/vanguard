/**
 * @component KeepSidebar
 * @role Nawigacja boczna: tagi + przełącznik notatki/archiwum.
 * @usedBy Keep
 */
import { Pressable } from '../ui/ControlPrimitives';
import { Archive, CheckSquare, Tag, Trash2 } from 'lucide-react';
import { Note } from '../../lib/notesApi';
import WorkspaceNavigation from '../shared/WorkspaceNavigation';
import WorkspaceSidebar from '../shared/WorkspaceSidebar';
import SidebarSection from '../shared/SidebarSection';

interface KeepSidebarProps {
  notes: Note[];
  allTags: string[];
  sidebarTab: 'notes' | 'archive';
  setSidebarTab: (tab: 'notes' | 'archive') => void;
  activeTag: string | null;
  setActiveTag: (fn: (t: string | null) => string | null) => void;
  setSearch: (v: string) => void;
  goTo: (dest: string) => void;
  onPromptCreateTag: () => void;
  onConfirmDeleteTag: (tag: string) => void;
}

export default function KeepSidebar({
  notes, allTags, sidebarTab, setSidebarTab, activeTag, setActiveTag, setSearch,
  goTo, onPromptCreateTag, onConfirmDeleteTag,
}: KeepSidebarProps) {
  return (
    <WorkspaceSidebar>
      <WorkspaceNavigation active="keep" onNavigate={goTo} />
      <div className="keep-sidebar-separator" />

      <SidebarSection
        label="Notatki"
        items={[
          {
            id: 'notes',
            label: 'Notatki',
            icon: <CheckSquare size={15} />,
            count: notes.filter(n => !n.is_archived).length,
            active: sidebarTab === 'notes' && !activeTag,
            onClick: () => { setSidebarTab('notes'); setActiveTag(() => null); setSearch(''); },
          },
          {
            id: 'archive',
            label: 'Archiwum',
            icon: <Archive size={15} />,
            count: notes.filter(n => n.is_archived).length,
            active: sidebarTab === 'archive' && !activeTag,
            onClick: () => { setSidebarTab('archive'); setActiveTag(() => null); setSearch(''); },
          },
        ]}
      />

      <SidebarSection
        label="Tagi"
        bordered
        onAdd={onPromptCreateTag}
        addTitle="Dodaj nowy tag"
        emptyLabel="brak tagów"
        items={allTags.map((tag) => ({
          id: tag,
          label: tag,
          icon: <Tag size={13} />,
          active: activeTag === tag,
          onClick: () => { setSidebarTab('notes'); setActiveTag((t) => (t === tag ? null : tag)); },
          actions: (
            <Pressable
              type="button"
              onClick={(e) => { e.stopPropagation(); onConfirmDeleteTag(tag); }}
              className="p-1 rounded hover:bg-danger/10 text-text-muted hover:text-danger transition-colors cursor-pointer"
              title="Usuń tag ze wszystkich notatek"
            >
              <Trash2 size={12} />
            </Pressable>
          ),
        }))}
      />
    </WorkspaceSidebar>
  );
}
