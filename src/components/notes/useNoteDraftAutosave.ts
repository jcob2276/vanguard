import { useCallback, useEffect, useRef, useState } from 'react';
import type { Note } from './keepUtils';
import { removeEmergencyNoteDraft, saveEmergencyNoteDraft } from '../../lib/noteDraftStorage';
import { canonicalizeNoteContent, deriveNoteMetadata } from '../../lib/noteText';

export type NoteSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

type SavedDraft = Pick<Note, 'title' | 'content' | 'color' | 'tags' | 'folder_id'>;

interface DraftState extends Omit<SavedDraft, 'tags'> {
  tagsInput: string;
}

interface UseNoteDraftAutosaveOptions {
  note: Note;
  onSave: (id: string, patch: SavedDraft) => void | Promise<void>;
  delay?: number;
}

interface SaveJob {
  noteId: string;
  draft: SavedDraft;
}

const fromNote = (note: Note): DraftState => ({
  title: note.title,
  content: canonicalizeNoteContent(note.title, note.content),
  color: note.color,
  folder_id: note.folder_id,
  tagsInput: note.tags.join(', '),
});

const toSavedDraft = (draft: DraftState): SavedDraft => {
  const content = draft.content.trim();
  const metadata = deriveNoteMetadata(content);
  return {
    title: metadata.title,
    content,
    color: draft.color,
    folder_id: draft.folder_id,
    tags: metadata.tags,
  };
};

const draftsEqual = (left: SavedDraft, right: SavedDraft) => (
  left.title === right.title
  && left.content === right.content
  && left.color === right.color
  && left.folder_id === right.folder_id
  && JSON.stringify(left.tags) === JSON.stringify(right.tags)
);

export function useNoteDraftAutosave({
  note,
  onSave,
  delay = 1_000,
}: UseNoteDraftAutosaveOptions) {
  const initialDraft = fromNote(note);
  const initialSavedDraft = toSavedDraft(initialDraft);
  const [draft, setDraft] = useState(initialDraft);
  const [saveStatus, setSaveStatus] = useState<NoteSaveStatus>('idle');
  const draftRef = useRef(initialDraft);
  const baselineRef = useRef(initialSavedDraft);
  const savedDraftsRef = useRef(new Map([[note.id, initialSavedDraft]]));
  const noteIdRef = useRef(note.id);
  const saveRef = useRef(onSave);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedSaveRef = useRef<SaveJob | null>(null);
  const drainRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    saveRef.current = onSave;
  }, [onSave]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const startDrain = useCallback(() => {
    if (drainRef.current || !queuedSaveRef.current) return;

    const drain = async () => {
      while (queuedSaveRef.current) {
        const job = queuedSaveRef.current;
        queuedSaveRef.current = null;
        setSaveStatus('saving');
        try {
          const result = saveRef.current(job.noteId, job.draft);
          if (result instanceof Promise) await result;
          savedDraftsRef.current.set(job.noteId, job.draft);
          removeEmergencyNoteDraft(job.noteId);
          if (job.noteId === noteIdRef.current) {
            baselineRef.current = job.draft;
          }
        } catch {
          // Keep the newest queued draft. If nothing newer arrived, retry this job.
          queuedSaveRef.current ??= job;
          saveEmergencyNoteDraft(job.noteId, queuedSaveRef.current.draft);
          setSaveStatus('error');
          break;
        }
      }

      if (!queuedSaveRef.current) {
        const saved = savedDraftsRef.current.get(noteIdRef.current);
        const current = toSavedDraft(draftRef.current);
        setSaveStatus(saved && draftsEqual(saved, current) ? 'saved' : 'dirty');
      }
    };

    const activeDrain = drain();
    drainRef.current = activeDrain;
    void activeDrain.finally(() => {
      if (drainRef.current === activeDrain) drainRef.current = null;
    });
  }, []);

  const flush = useCallback(() => {
    clearTimer();
    const next = toSavedDraft(draftRef.current);
    const saved = savedDraftsRef.current.get(noteIdRef.current) ?? baselineRef.current;
    if (draftsEqual(saved, next) && !queuedSaveRef.current) return;

    queuedSaveRef.current = { noteId: noteIdRef.current, draft: next };
    startDrain();
  }, [clearTimer, startDrain]);

  const flushAndWait = useCallback(async () => {
    flush();
    while (drainRef.current) {
      await drainRef.current;
    }
  }, [flush]);

  const schedule = useCallback(() => {
    clearTimer();
    setSaveStatus('dirty');
    timerRef.current = setTimeout(flush, delay);
  }, [clearTimer, delay, flush]);

  const updateDraft = useCallback((patch: Partial<DraftState>) => {
    draftRef.current = { ...draftRef.current, ...patch };
    setDraft(draftRef.current);
    schedule();
  }, [schedule]);

  useEffect(() => {
    if (noteIdRef.current === note.id) return;
    flush();
    const next = fromNote(note);
    noteIdRef.current = note.id;
    draftRef.current = next;
    const saved = savedDraftsRef.current.get(note.id) ?? toSavedDraft(next);
    savedDraftsRef.current.set(note.id, saved);
    baselineRef.current = saved;
    setDraft(next);
    setSaveStatus('idle');
  }, [flush, note]);

  useEffect(() => () => flush(), [flush]);

  return {
    ...draft,
    saveStatus,
    flush,
    flushAndWait,
    retrySave: flush,
    setTitle: (title: string) => updateDraft({ title }),
    setContent: (content: string) => updateDraft({ content }),
    setColor: (color: string) => updateDraft({ color }),
    setFolderId: (folder_id: string | null) => updateDraft({ folder_id }),
    setTagsInput: (tagsInput: string) => updateDraft({ tagsInput }),
  };
}
