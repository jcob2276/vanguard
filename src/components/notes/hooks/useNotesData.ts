import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useNotes, useTrashedNotes, Note, updateNoteApi,
  restoreNoteApi, deleteNoteApi, moveNoteToTrashApi, sortNotes,
} from '../../../lib/notesApi';
import { notesKeys } from '../../../lib/queryKeys';
import { notify } from '../../../lib/notify';
import { STORAGE_KEYS } from '../../../lib/constants';
import { useNotesMutations } from './useNotesMutations';
import { deleteAllNoteAttachmentFiles } from '../../../lib/noteAttachmentsApi';
import { createNoteFolder, deleteNoteFolder, useNoteFolders } from '../../../lib/noteFoldersApi';
import { decryptNotePayload, encryptNotePayload } from '../../../lib/noteLockCrypto';
import { getNoteLockBlockReason } from '../../../lib/noteLockRules';

function readLocalFallback(): Note[] {
  try {
    const local = localStorage.getItem(STORAGE_KEYS.KEEP_NOTES_LOCAL);
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
  const [unlockedPayloads, setUnlockedPayloads] = useState(
    new Map<string, { title: string; content: string; tags: string[] }>(),
  );
  const unlockSecretsRef = useRef(new Map<string, string>());
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: serverNotes, isLoading: loading, isError, refetch: fetchNotes } = useNotes(userId);
  const { data: trashedNotes = [], isLoading: trashLoading } = useTrashedNotes(userId);
  const { data: folders = [], isLoading: foldersLoading } = useNoteFolders(userId);
  const storedNotes = useMemo(
    () => (isError ? readLocalFallback() : (serverNotes ?? [])),
    [isError, serverNotes],
  );
  const notes = useMemo(() => storedNotes.map(note => {
    const payload = unlockedPayloads.get(note.id);
    return payload ? { ...note, ...payload } : note;
  }), [storedNotes, unlockedPayloads]);
  const unlockedNoteIds = useMemo(() => new Set(unlockedPayloads.keys()), [unlockedPayloads]);

  // Mirror every successful cache state to localStorage — the fallback an offline session reads.
  useEffect(() => {
    if (serverNotes !== undefined) {
      try {
        localStorage.setItem(STORAGE_KEYS.KEEP_NOTES_LOCAL, JSON.stringify(serverNotes));
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
    handleUpdate: handlePlainUpdate,
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

  const lockNow = useCallback(() => {
    unlockSecretsRef.current.clear();
    setUnlockedPayloads(new Map());
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = null;
  }, []);

  const refreshLockTimer = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(lockNow, 5 * 60 * 1000);
  }, [lockNow]);

  useEffect(() => () => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    unlockSecretsRef.current.clear();
  }, []);

  const handleUpdate = useCallback(async (id: string, patch: Partial<Note>) => {
    const stored = storedNotes.find(note => note.id === id);
    const secret = unlockSecretsRef.current.get(id);
    if (!stored?.is_locked || !secret) {
      await handlePlainUpdate(id, patch);
      return;
    }

    const current = unlockedPayloads.get(id);
    if (!current) throw new Error('Sesja zablokowanej notatki wygasła.');
    const payload = {
      title: patch.title ?? current.title,
      content: patch.content ?? current.content,
      tags: patch.tags ?? current.tags,
    };
    const encrypted = await encryptNotePayload(payload, secret);
    await updateNoteApi(id, {
      title: payload.title,
      content: '',
      tags: [],
      is_locked: true,
      ...encrypted,
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.folder_id !== undefined ? { folder_id: patch.folder_id } : {}),
    });
    setUnlockedPayloads(previous => new Map(previous).set(id, payload));
    setNotes(previous => previous.map(note => note.id === id ? {
      ...note,
      title: payload.title,
      content: '',
      tags: [],
      is_locked: true,
      ...encrypted,
    } : note));
    refreshLockTimer();
  }, [handlePlainUpdate, refreshLockTimer, setNotes, storedNotes, unlockedPayloads]);

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

  const handleRestore = useCallback(async (id: string) => {
    await restoreNoteApi(id);
    await queryClient.invalidateQueries({ queryKey: notesKeys.all });
    notify('Notatka przywrócona', 'success');
  }, [queryClient]);

  const handlePermanentDelete = useCallback(async (id: string) => {
    await deleteAllNoteAttachmentFiles(id);
    await deleteNoteApi(id);
    queryClient.setQueryData<Note[]>(
      notesKeys.trash(userId),
      previous => (previous ?? []).filter(note => note.id !== id),
    );
    notify('Notatka usunięta trwale', 'info');
  }, [queryClient, userId]);

  const handleDiscardEmpty = useCallback(async (id: string) => {
    await moveNoteToTrashApi(id);
    setNotes(previous => previous.filter(note => note.id !== id));
    await queryClient.invalidateQueries({ queryKey: notesKeys.trash(userId) });
  }, [queryClient, setNotes, userId]);

  const handleCreateFolder = useCallback(async (name: string) => {
    await createNoteFolder(userId, name);
    await queryClient.invalidateQueries({ queryKey: notesKeys.folders(userId) });
  }, [queryClient, userId]);

  const handleDeleteFolder = useCallback(async (id: string) => {
    await deleteNoteFolder(id);
    await queryClient.invalidateQueries({ queryKey: notesKeys.all });
    notify('Folder usunięty; notatki pozostały w Wszystkich', 'info');
  }, [queryClient]);

  const handleLockNote = useCallback(async (note: Note, passphrase: string) => {
    const blockReason = getNoteLockBlockReason(note);
    if (blockReason) throw new Error(blockReason);
    const encrypted = await encryptNotePayload({
      title: note.title,
      content: note.content,
      tags: note.tags,
    }, passphrase);
    const patch: Partial<Note> = {
      title: note.title,
      content: '',
      tags: [],
      attachment_names: [],
      is_locked: true,
      ...encrypted,
    };
    await updateNoteApi(note.id, patch);
    setNotes(previous => previous.map(item => item.id === note.id ? { ...item, ...patch } : item));
    unlockSecretsRef.current.delete(note.id);
    setUnlockedPayloads(previous => {
      const next = new Map(previous);
      next.delete(note.id);
      return next;
    });
  }, [setNotes]);

  const handleUnlockNote = useCallback(async (note: Note, passphrase: string): Promise<void> => {
    if (!note.locked_payload || !note.lock_salt || !note.lock_iv) {
      throw new Error('Brak danych potrzebnych do odblokowania notatki.');
    }
    const payload = await decryptNotePayload({
      locked_payload: note.locked_payload,
      lock_salt: note.lock_salt,
      lock_iv: note.lock_iv,
    }, passphrase);
    unlockSecretsRef.current.set(note.id, passphrase);
    setUnlockedPayloads(previous => new Map(previous).set(note.id, payload));
    refreshLockTimer();
  }, [refreshLockTimer]);

  return {
    notes,
    trashedNotes,
    folders,
    setNotes,
    loading,
    trashLoading,
    foldersLoading,
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
    handleReorder,
    handleRestore,
    handlePermanentDelete,
    handleDiscardEmpty,
    handleCreateFolder,
    handleDeleteFolder,
    handleLockNote,
    handleUnlockNote,
    lockNow,
    unlockedNoteIds,
  };
}
