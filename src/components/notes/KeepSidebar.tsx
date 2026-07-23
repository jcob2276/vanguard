/**
 * @component KeepSidebar
 * @role Nawigacja boczna: tagi + przełącznik notatki/archiwum.
 * @usedBy Keep
 */
import { Pressable } from '../ui/ControlPrimitives';
import { Archive, CheckSquare, Folder, Tag, Trash2 } from 'lucide-react';
import { Note } from '../../lib/notesApi';
import type { NoteFolder } from '../../lib/noteFoldersApi';
import WorkspaceNavigation from '../shared/WorkspaceNavigation';
import WorkspaceSidebar from '../shared/WorkspaceSidebar';
import SidebarSection from '../shared/SidebarSection';
import { useState } from 'react';
import { confirmDialog, notify } from '../../lib/notify';
import SidebarInlineCreate from './SidebarInlineCreate';

interface KeepSidebarProps {
  notes: Note[];
  trashCount: number;
  folders: NoteFolder[];
  foldersLoading: boolean;
  allTags: string[];
  sidebarTab: 'notes' | 'archive' | 'trash';
  setSidebarTab: (tab: 'notes' | 'archive' | 'trash') => void;
  activeTag: string | null;
  setActiveTag: (fn: (t: string | null) => string | null) => void;
  setSearch: (v: string) => void;
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  goTo: (dest: string) => void;
  onConfirmDeleteTag: (tag: string) => void;
}

export default function KeepSidebar({
  notes, trashCount, folders, foldersLoading, allTags, sidebarTab, setSidebarTab,
  activeTag, setActiveTag, setSearch, activeFolderId, setActiveFolderId,
  onCreateFolder, onDeleteFolder, goTo, onConfirmDeleteTag,
}: KeepSidebarProps) {
  const [creatingFolder, setCreatingFolder] = useState(false);

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
            active: sidebarTab === 'notes' && !activeTag && !activeFolderId,
            onClick: () => { setSidebarTab('notes'); setActiveTag(() => null); setActiveFolderId(null); setSearch(''); },
          },
          {
            id: 'archive',
            label: 'Archiwum',
            icon: <Archive size={15} />,
            count: notes.filter(n => n.is_archived).length,
            active: sidebarTab === 'archive' && !activeTag,
            onClick: () => { setSidebarTab('archive'); setActiveTag(() => null); setActiveFolderId(null); setSearch(''); },
          },
          {
            id: 'trash',
            label: 'Kosz',
            icon: <Trash2 size={15} />,
            count: trashCount,
            active: sidebarTab === 'trash',
            onClick: () => { setSidebarTab('trash'); setActiveTag(() => null); setActiveFolderId(null); setSearch(''); },
          },
        ]}
      />

      <SidebarSection
        label="Foldery"
        bordered
        isLoading={foldersLoading}
        onAdd={() => setCreatingFolder(true)}
        addTitle="Dodaj folder"
        trailingAdd={creatingFolder ? (
          <SidebarInlineCreate
            placeholder="Nazwa folderu"
            onCancel={() => setCreatingFolder(false)}
            onSubmit={async name => {
              try {
                await onCreateFolder(name);
                setCreatingFolder(false);
              } catch (error) {
                notify(error instanceof Error ? error.message : 'Nie udało się utworzyć folderu', 'error');
              }
            }}
          />
        ) : undefined}
        emptyLabel="brak folderów"
        items={folders.map(folder => ({
          id: folder.id,
          label: folder.name,
          icon: <Folder size={13} />,
          count: notes.filter(note => note.folder_id === folder.id).length,
          active: activeFolderId === folder.id,
          onClick: () => {
            setSidebarTab('notes');
            setActiveTag(() => null);
            setActiveFolderId(folder.id);
            setSearch('');
          },
          actions: (
            <Pressable
              variant="ghost"
              size="sm"
              title="Usuń folder"
              className="text-danger"
              onClick={event => {
                event.stopPropagation();
                void confirmDialog('Usunąć folder? Notatki pozostaną w widoku Wszystkie.')
                  .then(async confirmed => {
                    if (confirmed) await onDeleteFolder(folder.id);
                  });
              }}
            >
              <Trash2 size={12} />
            </Pressable>
          ),
        }))}
      />

      <SidebarSection
        label="Tagi"
        bordered
        emptyLabel="brak tagów"
        items={allTags.map((tag) => ({
          id: tag,
          label: tag,
          icon: <Tag size={13} />,
          active: activeTag === tag,
          onClick: () => { setSidebarTab('notes'); setActiveFolderId(null); setActiveTag((t) => (t === tag ? null : tag)); },
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
