import { useCallback } from 'react';
import { Note, createNoteApi, updateNoteApi, deleteNoteApi, sortNotes, isNetworkOrTableError } from '../../../lib/notesApi';
import { notify, dismissToast } from '../../../lib/notify';
import { isOfflineError, queueOfflineWrite } from '../../../lib/offlineQueue';
import { STORAGE_KEYS } from '../../../lib/constants';

async function createNoteAction(
  userId: string,
  partial: Partial<Note>,
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>,
  setBusy: (b: boolean) => void,
  setError: (err: string | null) => void
) {
  setBusy(true);
  setError(null);
  const payload = { user_id: userId, ...partial };
  try {
    const data = await createNoteApi(userId, partial);
    setNotes((prev) => sortNotes([data, ...prev]));
  } catch (err) {
    if (isNetworkOrTableError(err)) {
      const id = crypto.randomUUID();
      const local: Note = {
        id, user_id: userId, title: partial.title || '', content: partial.content || '',
        color: partial.color || 'default', is_pinned: partial.is_pinned || false,
        is_archived: partial.is_archived || false, tags: partial.tags || [],
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      if (isOfflineError(err)) await queueOfflineWrite('table:insert:vanguard_notes', { payload: { id, ...payload } }, 'Dodanie notatki');
      setNotes((prev) => {
        const updated = sortNotes([local, ...prev]);
        localStorage.setItem(STORAGE_KEYS.KEEP_NOTES_LOCAL, JSON.stringify(updated));
        return updated;
      });
      return;
    }
    throw err;
  } finally { setBusy(false); }
}

async function updateNoteAction(
  id: string,
  patch: Partial<Note>,
  notes: Note[],
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>,
  setError: (err: string | null) => void
) {
  const updatedAt = new Date().toISOString();
  if ('is_archived' in patch) {
    const original = notes.find((n) => n.id === id);
    if (!original) return;
    const isArchiving = patch.is_archived && !original.is_archived;
    setNotes((prev) => sortNotes(prev.map((n) => (n.id === id ? { ...n, ...patch, updated_at: updatedAt } : n))));
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      try {
        await updateNoteApi(id, { ...patch, updated_at: updatedAt });
      } catch (err) {
        if (isOfflineError(err)) {
          await queueOfflineWrite('table:update:vanguard_notes', { match: { id }, payload: { ...patch, updated_at: updatedAt } }, 'Archiwizacja notatki');
        }
      }
    }, 5000);
    const toastId = notify(isArchiving ? 'Zarchiwizowano' : 'Przywrócono', 'info', {
      duration: 5000,
      action: {
        label: 'Cofnij',
        onClick: () => {
          cancelled = true;
          clearTimeout(timer);
          setNotes((prev) => sortNotes(prev.map((n) => (n.id === id ? original : n))));
          dismissToast(toastId);
        },
      },
    });
    return;
  }
  try {
    await updateNoteApi(id, { ...patch, updated_at: updatedAt });
    setNotes((prev) => {
      const updated = sortNotes(prev.map((n) => (n.id === id ? { ...n, ...patch, updated_at: updatedAt } : n)));
      if (!navigator.onLine) localStorage.setItem(STORAGE_KEYS.KEEP_NOTES_LOCAL, JSON.stringify(updated));
      return updated;
    });
  } catch (err) {
    if (isOfflineError(err)) {
      await queueOfflineWrite('table:update:vanguard_notes', { match: { id }, payload: { ...patch, updated_at: updatedAt } }, 'Edycja notatki');
    }
    setNotes((prev) => {
      const updated = sortNotes(prev.map((n) => (n.id === id ? { ...n, ...patch, updated_at: updatedAt } : n)));
      localStorage.setItem(STORAGE_KEYS.KEEP_NOTES_LOCAL, JSON.stringify(updated));
      return updated;
    });
    setError('Brak połączenia. Zaktualizowano lokalnie.');
  }
}

async function deleteNoteAction(
  id: string,
  notes: Note[],
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>,
  setError: (err: string | null) => void
) {
  const noteToDelete = notes.find((n) => n.id === id);
  if (!noteToDelete) return;
  setNotes((prev) => prev.filter((n) => n.id !== id));
  let cancelled = false;
  const timer = window.setTimeout(async () => {
    if (cancelled) return;
    try {
      await deleteNoteApi(id);
    } catch (err) {
      if (isOfflineError(err)) await queueOfflineWrite('table:delete:vanguard_notes', { match: { id } }, 'Usunięcie notatki');
      setError('Brak połączenia. Usunięto lokalnie.');
      setNotes((prev) => {
        const updated = prev.filter((n) => n.id !== id);
        localStorage.setItem(STORAGE_KEYS.KEEP_NOTES_LOCAL, JSON.stringify(updated));
        return updated;
      });
    }
  }, 5000);
  const toastId = notify('Notatka usunięta', 'info', {
    duration: 5000,
    action: {
      label: 'Cofnij',
      onClick: () => {
        cancelled = true;
        clearTimeout(timer);
        setNotes((prev) => sortNotes([...prev, noteToDelete]));
        dismissToast(toastId);
      },
    },
  });
}

async function togglePinAction(
  note: Note,
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>,
  setError: (err: string | null) => void
) {
  const next = !note.is_pinned;
  try {
    await updateNoteApi(note.id, { is_pinned: next });
    setNotes((prev) => {
      const updated = sortNotes(prev.map((n) => (n.id === note.id ? { ...n, is_pinned: next } : n)));
      if (!navigator.onLine) localStorage.setItem(STORAGE_KEYS.KEEP_NOTES_LOCAL, JSON.stringify(updated));
      return updated;
    });
  } catch (err) {
    if (isOfflineError(err)) {
      await queueOfflineWrite('table:update:vanguard_notes', { match: { id: note.id }, payload: { is_pinned: next } }, 'Przypięcie notatki');
    }
    setNotes((prev) => {
      const updated = sortNotes(prev.map((n) => (n.id === note.id ? { ...n, is_pinned: next } : n)));
      localStorage.setItem(STORAGE_KEYS.KEEP_NOTES_LOCAL, JSON.stringify(updated));
      return updated;
    });
    setError('Brak połączenia. Zmieniono przypięcie lokalnie.');
  }
}

async function newNoteAction(
  userId: string,
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>,
  setBusy: (busy: boolean) => void,
  setError: (err: string | null) => void
): Promise<string> {
  setBusy(true);
  setError(null);
  const empty = { title: '', content: '', color: 'default', is_pinned: false, is_archived: false, tags: [] as string[] };
  try {
    const data = await createNoteApi(userId, empty);
    setNotes((prev) => sortNotes([data, ...prev]));
    return data.id;
  } catch (err) {
    const id = crypto.randomUUID();
    if (isOfflineError(err)) await queueOfflineWrite('table:insert:vanguard_notes', { payload: { id, user_id: userId, ...empty } }, 'Dodanie notatki');
    const local: Note = { id, user_id: userId, ...empty, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setNotes((prev) => {
      const updated = sortNotes([local, ...prev]);
      localStorage.setItem(STORAGE_KEYS.KEEP_NOTES_LOCAL, JSON.stringify(updated));
      return updated;
    });
    setError('Brak połączenia. Utworzono notatkę lokalnie.');
    return local.id;
  } finally { setBusy(false); }
}

interface UseNotesMutationsProps {
  userId: string;
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  setBusy: (busy: boolean) => void;
  setError: (err: string | null) => void;
}

export function useNotesMutations({
  userId,
  notes,
  setNotes,
  setBusy,
  setError,
}: UseNotesMutationsProps) {
  const handleCreate = useCallback(async (partial: Partial<Note>) => {
    await createNoteAction(userId, partial, setNotes, setBusy, setError);
  }, [userId, setNotes, setBusy, setError]);
  const handleUpdate = useCallback(async (id: string, patch: Partial<Note>) => {
    await updateNoteAction(id, patch, notes, setNotes, setError);
  }, [notes, setNotes, setError]);
  const handleDelete = useCallback(async (id: string) => {
    await deleteNoteAction(id, notes, setNotes, setError);
  }, [notes, setNotes, setError]);
  const handleTogglePin = useCallback(async (note: Note) => {
    await togglePinAction(note, setNotes, setError);
  }, [setNotes, setError]);
  const handleNewNote = useCallback(async () => {
    return await newNoteAction(userId, setNotes, setBusy, setError);
  }, [userId, setNotes, setBusy, setError]);

  return { handleCreate, handleUpdate, handleDelete, handleTogglePin, handleNewNote };
}
