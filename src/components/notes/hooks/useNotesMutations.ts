import { useCallback } from 'react';
import { Note, createNoteApi, updateNoteApi, moveNoteToTrashApi, restoreNoteApi, sortNotes } from '../../../lib/notesApi';
import { notify, dismissToast } from '../../../lib/notify';
import {
  registerReversibleAction,
  removeReversibleAction,
  undoAction,
} from '../../../lib/actionHistory';

async function createNoteAction(
  userId: string,
  partial: Partial<Note>,
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>,
  setBusy: (b: boolean) => void,
  setError: (err: string | null) => void
) {
  setBusy(true);
  setError(null);
  try {
    const data = await createNoteApi(userId, partial);
    setNotes((prev) => sortNotes([data, ...prev]));
  } catch (err) {
    setError('Nie utworzono notatki w chmurze. Sprawdź połączenie.');
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
    let committed = false;
    const timer = window.setTimeout(async () => {
      committed = true;
      try {
        await updateNoteApi(id, { ...patch, updated_at: updatedAt });
      } catch (err) {
        setNotes((prev) => sortNotes(prev.map((n) => (n.id === id ? original : n))));
        setError(err instanceof Error ? err.message : 'Nie zapisano archiwizacji w chmurze.');
      }
    }, 5000);
    const actionId = registerReversibleAction({
      label: isArchiving ? 'Archiwizacja notatki' : 'Przywrócenie notatki',
      undo: async () => {
        clearTimeout(timer);
        setNotes((prev) => sortNotes(prev.map((n) => (n.id === id ? original : n))));
        if (committed) {
          await updateNoteApi(id, {
            is_archived: original.is_archived,
            updated_at: new Date().toISOString(),
          });
        }
      },
      redo: async () => {
        const redoUpdatedAt = new Date().toISOString();
        setNotes((prev) => sortNotes(prev.map((n) => (
          n.id === id ? { ...n, ...patch, updated_at: redoUpdatedAt } : n
        ))));
        await updateNoteApi(id, { ...patch, updated_at: redoUpdatedAt });
      },
    });
    const toastId = notify(isArchiving ? 'Zarchiwizowano' : 'Przywrócono', 'info', {
      duration: 5000,
      action: {
        label: 'Cofnij',
        onClick: () => {
          void undoAction(actionId).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : String(err));
          });
          dismissToast(toastId);
        },
      },
    });
    return;
  }
  try {
    await updateNoteApi(id, { ...patch, updated_at: updatedAt });
    setNotes((prev) => {
      return sortNotes(prev.map((n) => (n.id === id ? { ...n, ...patch, updated_at: updatedAt } : n)));
    });
  } catch (err) {
    setError('Nie zapisano w chmurze. Szkic pozostał na tym urządzeniu.');
    throw err;
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
  let committed = false;
  let actionId = '';
  const timer = window.setTimeout(async () => {
    if (cancelled) return;
    removeReversibleAction(actionId);
    try {
      await moveNoteToTrashApi(id);
      committed = true;
    } catch (err) {
      setNotes((prev) => sortNotes([...prev.filter(note => note.id !== id), noteToDelete]));
      setError(err instanceof Error ? err.message : 'Nie przeniesiono notatki do Kosza.');
    }
  }, 5000);
  actionId = registerReversibleAction({
    label: 'Przeniesienie notatki do kosza',
    undo: async () => {
      cancelled = true;
      clearTimeout(timer);
      setNotes((prev) => sortNotes([...prev, noteToDelete]));
      if (committed) await restoreNoteApi(id);
    },
  });
  const toastId = notify('Przeniesiono do kosza', 'info', {
    duration: 5000,
    action: {
      label: 'Cofnij',
      onClick: () => {
        void undoAction(actionId).catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err));
        });
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
      return sortNotes(prev.map((n) => (n.id === note.id ? { ...n, is_pinned: next } : n)));
    });
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Nie zapisano przypięcia w chmurze.');
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
    setError('Nie utworzono notatki w chmurze. Sprawdź połączenie.');
    throw err;
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
