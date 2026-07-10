import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotes, Note, notesKeys, updateNoteApi, createNoteApi, sortNotes } from '../../../lib/notesApi';
import { notify } from '../../../lib/notify';
import { useNotesMutations } from './useNotesMutations';

function readLocalFallback(): Note[] {
  try {
    const local = localStorage.getItem('vanguard_local_keep_notes');
    return local ? (JSON.parse(local) as Note[]) : [];
  } catch {
    return [];
  }
}

/**
 * The react-query cache (keyed by notesKeys.list(userId)) is the single source of truth for
 * notes — there is no separate local useState<Note[]> to drift out of sync with it. `setNotes`
 * below is a queryClient.setQueryData wrapper with the exact Dispatch<SetStateAction<Note[]>>
 * shape useState would have given, so useNotesMutations.ts and every Keep.tsx callsite that
 * calls setNotes(...) work unchanged. See docs/FRONTEND_GUIDE.md.
 */
export function useNotesData(userId: string) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: serverNotes, isLoading: loading, isError, refetch: fetchNotes } = useNotes(userId);
  const notes = useMemo(
    () => (isError ? readLocalFallback() : (serverNotes ?? [])),
    [isError, serverNotes],
  );

  // Mirror every successful cache state to localStorage — the fallback an offline session reads.
  useEffect(() => {
    if (serverNotes !== undefined) {
      try {
        localStorage.setItem('vanguard_local_keep_notes', JSON.stringify(serverNotes));
      } catch {
        // ignore quota errors
      }
    }
  }, [serverNotes]);

  const setNotes = useCallback<React.Dispatch<React.SetStateAction<Note[]>>>((updater) => {
    queryClient.setQueryData<Note[]>(notesKeys.list(userId), (old) => {
      const base = old ?? [];
      return typeof updater === 'function' ? (updater as (prev: Note[]) => Note[])(base) : updater;
    });
  }, [queryClient, userId]);

  const {
    handleCreate,
    handleUpdate,
    handleDelete,
    handleTogglePin,
    handleNewNote,
  } = useNotesMutations({
    userId,
    notes,
    setNotes,
    setBusy,
    setError,
  });

  const handleDeleteTag = useCallback(async (tagToDelete: string) => {
    setBusy(true);
    setError(null);
    try {
      const notesToUpdate = notes.filter((n) => n.tags?.includes(tagToDelete));
      for (const note of notesToUpdate) {
        const nextTags = (note.tags || []).filter((t) => t !== tagToDelete);
        await updateNoteApi(note.id, { tags: nextTags, updated_at: new Date().toISOString() });
      }
      const updatedNotes = notes.map((n) =>
        n.tags?.includes(tagToDelete)
          ? {
              ...n,
              tags: (n.tags || []).filter((t) => t !== tagToDelete),
              updated_at: new Date().toISOString(),
            }
          : n
      );
      setNotes(sortNotes(updatedNotes));
      notify(`Tag "${tagToDelete}" został usunięty ze wszystkich notatek.`, 'info');
    } catch (err: unknown) {
      console.error('Error deleting tag:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg || 'Nie udało się usunąć tagu.');
    } finally {
      setBusy(false);
    }
  }, [notes, setNotes]);

  const handleCreateTag = useCallback(async (newTag: string) => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title: `Tag: ${newTag}`,
        content: `Pusta notatka utworzona automatycznie dla tagu #${newTag}.`,
        tags: [newTag],
        color: 'default',
        is_pinned: false,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const data = await createNoteApi(userId, payload);
      setNotes((prev) => sortNotes([data, ...prev]));
      notify(`Utworzono tag: "${newTag}"!`, 'info');
    } catch (err: unknown) {
      console.error('Error creating tag:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg || 'Nie udało się utworzyć tagu.');
    } finally {
      setBusy(false);
    }
  }, [userId, setNotes]);

  const handleReorder = useCallback((dragId: string, overId: string) => {
    setNotes((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((n) => n.id === dragId);
      const toIdx = arr.findIndex((n) => n.id === overId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      if (arr[fromIdx].is_pinned !== arr[toIdx].is_pinned) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
  }, [setNotes]);

  return {
    notes,
    setNotes,
    loading,
    error,
    setError,
    busy,
    setBusy,
    fetchNotes,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleTogglePin,
    handleNewNote,
    handleDeleteTag,
    handleCreateTag,
    handleReorder,
  };
}
