import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Note } from '../../../lib/notesApi';
import { convertNoteToTodoItem, exportNoteChecklistsToTodos } from '../../../lib/behavior/captureBridge';
import { notify, confirmDialog } from '../../../lib/notify';
import { useKeepPageEffects } from './useKeepPageEffects';

type KeepViewMode = 'grid' | 'list' | 'split';

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
  handleCreateTag: (tag: string) => Promise<void>;
  onBack?: () => void;
  onNavigateTo?: (dest: string) => void;
}

export function useKeepView({
  userId, notes, setNotes, busy, setBusy, handleCreate, handleUpdate, handleDelete,
  handleTogglePin, handleReorder, handleNewNote, handleDeleteTag, handleCreateTag,
  onBack, onNavigateTo,
}: UseKeepViewProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'notes' | 'archive'>('notes');
  
  const [viewMode, setViewMode] = useState<KeepViewMode>(() => {
    try {
      const saved = localStorage.getItem(keepViewStorageKey());
      if (saved === 'grid' || saved === 'list' || saved === 'split') return saved;
    } catch {
      // storage unavailable
    }
    return isMobileNotesView() ? 'split' : 'grid';
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

  const handleCloseCard = useCallback(() => {
    setEditingId(null);
    if (!searchParams.has('note')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('note');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const allTags = Array.from(new Set(notes.flatMap(n => n.tags))).sort();

  const handleConfirmDeleteTag = useCallback(async (tagToDelete: string) => {
    const ok = await confirmDialog(`Czy na pewno chcesz usunąć tag "${tagToDelete}" ze wszystkich notatek?`);
    if (!ok) return;
    await handleDeleteTag(tagToDelete);
    setActiveTag(t => (t === tagToDelete ? null : t));
  }, [handleDeleteTag]);

  const handlePromptCreateTag = useCallback(async () => {
    const newTagRaw = window.prompt('Wpisz nazwę nowego tagu:');
    if (!newTagRaw) return;
    const newTag = newTagRaw.trim().toLowerCase().replace(/[\s#]/g, '_');
    if (!newTag) return;

    if (allTags.includes(newTag)) {
      notify('Ten tag już istnieje.', 'error');
      return;
    }
    await handleCreateTag(newTag);
  }, [allTags, handleCreateTag]);

  const filtered = notes.filter(n => {
    const matchTab = sidebarTab === 'notes' ? !n.is_archived : !!n.is_archived;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q));
    const matchTag = !activeTag || n.tags.includes(activeTag);
    return matchTab && matchSearch && matchTag;
  });

  const pinned = sidebarTab === 'notes' ? filtered.filter(n => n.is_pinned) : [];
  const others = sidebarTab === 'notes' ? filtered.filter(n => !n.is_pinned) : filtered;
  const visibleOthers = others.slice(0, visibleCount);

  const handleTagClick = useCallback((tag: string) => {
    setSidebarTab('notes');
    setSearch('');
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
    onOpenCard: setEditingId,
    onClickTag: handleTagClick,
    onConvertToTodo: sidebarTab === 'notes' ? handleConvertToTodo : undefined,
    search,
  };

  return {
    search, setSearch,
    activeTag, setActiveTag,
    sidebarTab, setSidebarTab,
    viewMode, setViewMode: setViewModeWithPersist,
    editingId, setEditingId,
    visibleCount, setVisibleCount,
    goTo, goBack,
    handleCloseCard,
    allTags,
    handleConfirmDeleteTag,
    handlePromptCreateTag,
    filtered, pinned, others, visibleOthers,
    handleExportChecklists,
    sharedGridProps,
  };
}
