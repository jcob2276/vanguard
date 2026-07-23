import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Note } from '../../../lib/notesApi';
import { convertNoteToTodoItem, exportNoteChecklistsToTodos } from '../../../lib/behavior/captureBridge';
import { notify, confirmDialog, promptDialog } from '../../../lib/notify';
import { useKeepPageEffects } from './useKeepPageEffects';
import { matchesNoteSearch } from '../keepUtils';

type KeepViewMode = 'list' | 'gallery';

const isMobileNotesView = () => window.matchMedia('(max-width: 767px)').matches;
const keepViewStorageKey = () => `vanguard_keep_view_mode_${isMobileNotesView() ? 'mobile' : 'desktop'}`;

interface UseKeepViewProps {
  userId: string;
  notes: Note[];
  setNotes: (updater: Note[] | ((prev: Note[]) => Note[])) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  handleCreate: (note: { title: string; content: string; tags?: string[] }) => void;
  handleUpdate: (id: string, patch: Partial<Note>) => void;
  handleDelete: (id: string) => void;
  handleTogglePin: (note: Note) => void;
  handleReorder: (dragId: string, overId: string) => void;
  handleNewNote: () => Promise<string | null | undefined>;
  handleDeleteTag: (tag: string) => Promise<void>;
  handleDiscardEmpty: (id: string) => Promise<void>;
  handleUnlockNote: (note: Note, passphrase: string) => Promise<void>;
  unlockedNoteIds: Set<string>;
  onBack?: () => void;
  onNavigateTo?: (dest: string) => void;
}

export function useKeepView({
  userId, notes, setNotes, busy, setBusy, handleCreate, handleUpdate, handleDelete,
  handleTogglePin, handleReorder, handleNewNote, handleDeleteTag, handleDiscardEmpty, handleUnlockNote,
  unlockedNoteIds,
  onBack, onNavigateTo,
}: UseKeepViewProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'notes' | 'archive' | 'trash'>('notes');
  
  const [viewMode, setViewMode] = useState<KeepViewMode>(() => {
    try {
      const saved = localStorage.getItem(keepViewStorageKey());
      if (saved === 'list' || saved === 'gallery') return saved;
      if (saved === 'grid') return 'gallery';
      if (saved === 'split') return 'list';
    } catch {
      // storage unavailable
    }
    return 'list';
  });

  const setViewModeWithPersist = useCallback((val: KeepViewMode | ((prev: KeepViewMode) => KeepViewMode)) => {
    setViewMode((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem(keepViewStorageKey(), next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);
  const [columns, setColumns] = useState(3);
  const [editingId, setEditingId] = useState<string | null>(() => searchParams.get('note'));
  const [visibleCount, setVisibleCount] = useState(30);

  useKeepPageEffects({
    search, activeTag, sidebarTab, viewMode, editingId, setEditingId,
    setVisibleCount, setColumns, handleNewNote, handleCreate,
  });

  const goTo = useCallback((dest: string) => {
    if (onNavigateTo) {
      onNavigateTo(dest);
    } else {
      navigate('/');
    }
  }, [onNavigateTo, navigate]);

  const goBack = useCallback(() => (onBack ? onBack() : navigate('/')), [onBack, navigate]);

  const handleCloseCard = useCallback((isEmpty = false) => {
    const closingId = editingId;
    setEditingId(null);
    if (isEmpty && closingId) {
      void handleDiscardEmpty(closingId).catch(error => {
        notify(error instanceof Error ? error.message : 'Nie usunięto pustej notatki', 'error');
      });
    }
    if (!searchParams.has('note')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('note');
    setSearchParams(next, { replace: true });
  }, [editingId, handleDiscardEmpty, searchParams, setSearchParams]);

  const handleOpenNote = useCallback(async (id: string) => {
    const note = notes.find(item => item.id === id);
    if (!note) return;
    if (note.is_locked && !unlockedNoteIds.has(note.id)) {
      const passphrase = await promptDialog('Hasło do zablokowanej notatki');
      if (passphrase === null) return;
      setBusy(true);
      try {
        await handleUnlockNote(note, passphrase);
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Nie udało się odblokować notatki', 'error');
        return;
      } finally {
        setBusy(false);
      }
    }
    setEditingId(id);
  }, [handleUnlockNote, notes, setBusy, unlockedNoteIds]);

  const allTags = Array.from(new Set(notes.flatMap(n => n.tags))).sort();

  const handleConfirmDeleteTag = useCallback(async (tagToDelete: string) => {
    const ok = await confirmDialog(`Czy na pewno chcesz usunąć tag "${tagToDelete}" ze wszystkich notatek?`);
    if (!ok) return;
    await handleDeleteTag(tagToDelete);
    setActiveTag(t => (t === tagToDelete ? null : t));
  }, [handleDeleteTag]);

  const filtered = notes.filter(n => {
    const matchTab = sidebarTab === 'notes' ? !n.is_archived : sidebarTab === 'archive' && !!n.is_archived;
    const matchSearch = matchesNoteSearch(n, search);
    const matchTag = !activeTag || n.tags.includes(activeTag);
    const matchFolder = !activeFolderId || n.folder_id === activeFolderId;
    return matchTab && matchSearch && matchTag && matchFolder;
  });

  const pinned = sidebarTab === 'notes' ? filtered.filter(n => n.is_pinned) : [];
  const others = sidebarTab === 'notes' ? filtered.filter(n => !n.is_pinned) : filtered;
  const visibleOthers = others.slice(0, visibleCount);

  const handleTagClick = useCallback((tag: string) => {
    setSidebarTab('notes');
    setSearch('');
    setActiveFolderId(null);
    setActiveTag(t => (t === tag ? null : tag));
  }, []);

  const handleConvertToTodo = useCallback(async (note: Note) => {
    setBusy(true);
    try {
      await convertNoteToTodoItem(userId, note);
      setNotes(prev => prev.map(n => (
        n.id === note.id ? { ...n, is_archived: true, is_pinned: false } : n
      )));
      notify('Dodano do zadań', 'success');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Nie udało się dodać do zadań', 'error');
    } finally {
      setBusy(false);
    }
  }, [userId, setNotes, setBusy]);

  const handleExportChecklists = useCallback(async (note: Note) => {
    setBusy(true);
    try {
      const created = await exportNoteChecklistsToTodos(userId, note);
      notify(`Dodano ${created.length} zadań`, 'success');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Eksport nie powiódł się', 'error');
    } finally {
      setBusy(false);
    }
  }, [userId, setBusy]);

  const sharedGridProps = {
    onDelete: handleDelete,
    onTogglePin: handleTogglePin,
    onUpdate: handleUpdate,
    onReorder: handleReorder,
    busy,
    columns,
    editingId,
    onOpenCard: (id: string) => { void handleOpenNote(id); },
    onClickTag: handleTagClick,
    onConvertToTodo: sidebarTab === 'notes' ? handleConvertToTodo : undefined,
    search,
  };

  return {
    search, setSearch,
    activeTag, setActiveTag,
    activeFolderId, setActiveFolderId,
    sidebarTab, setSidebarTab,
    viewMode, setViewMode: setViewModeWithPersist,
    editingId, setEditingId,
    visibleCount, setVisibleCount,
    goTo, goBack,
    handleCloseCard,
    handleOpenNote,
    allTags,
    handleConfirmDeleteTag,
    filtered, pinned, others, visibleOthers,
    handleExportChecklists,
    sharedGridProps,
  };
}
