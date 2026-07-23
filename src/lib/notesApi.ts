import { useQuery } from '@tanstack/react-query';
import { buildNoteInsertRow } from '@vanguard/domain';
import { supabase } from './supabase';
import { notesKeys } from './queryKeys';

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  is_pinned: boolean;
  is_archived: boolean;
  color: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  folder_id: string | null;
  is_locked: boolean;
  locked_payload: string | null;
  lock_salt: string | null;
  lock_iv: string | null;
  attachment_names?: string[];
  attachment_text?: string;
}

type NoteQueryRow = Omit<Note, 'attachment_names' | 'attachment_text'> & {
  note_attachments: Array<{ file_name: string; ocr_text: string | null }>;
};

const mapNoteRows = (rows: unknown[] | null): Note[] => (
  ((rows ?? []) as Partial<NoteQueryRow>[]).map(({ note_attachments, ...note }) => ({
    ...(note as Note),
    attachment_names: note.is_locked ? [] : (note_attachments ?? []).map(item => item.file_name),
    attachment_text: note.is_locked ? '' : (note_attachments ?? []).map(item => item.ocr_text ?? '').join(' '),
  }))
);

// ── QUERIES ──

export function useNotes(userId: string) {
  return useQuery({
    queryKey: notesKeys.list(userId),
    queryFn: async () => {
      // Primary query trying note_attachments and deleted_at filter
      const primaryRes = await supabase
        .from('vanguard_notes')
        .select('*, note_attachments(file_name, ocr_text)')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (!primaryRes.error && primaryRes.data) {
        return mapNoteRows(primaryRes.data);
      }

      // Safe fallback query if DB schema lacks deleted_at column or note_attachments table
      const fallbackRes = await supabase
        .from('vanguard_notes')
        .select('*')
        .eq('user_id', userId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (fallbackRes.error) throw new Error(fallbackRes.error.message);
      return mapNoteRows(fallbackRes.data);
    },
    enabled: !!userId,
  });
}

// ── MUTATIONS ──

export async function createNoteApi(userId: string, partial: Partial<Note>): Promise<Note> {
  const payload = buildNoteInsertRow({
    user_id: userId,
    content: partial.content ?? '',
    title: partial.title,
    tags: partial.tags,
    is_pinned: partial.is_pinned,
    is_archived: partial.is_archived,
    color: partial.color,
  });

  const { data, error } = await supabase
    .from('vanguard_notes')
    .insert(payload as never)
    .select()
    .single();

  if (error) throw error;
  return data as Note;
}
export async function updateNoteApi(id: string, patch: Partial<Note>): Promise<void> {
  const { attachment_names: _attachmentNames, attachment_text: _attachmentText, ...dbPatch } = patch;
  const { error } = await supabase
    .from('vanguard_notes')
    .update(dbPatch)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteNoteApi(id: string): Promise<void> {
  const { error } = await supabase
    .from('vanguard_notes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function moveNoteToTrashApi(id: string): Promise<string> {
  const deletedAt = new Date().toISOString();
  await updateNoteApi(id, { deleted_at: deletedAt, is_pinned: false });
  return deletedAt;
}

export async function restoreNoteApi(id: string): Promise<void> {
  await updateNoteApi(id, { deleted_at: null });
}

export function useTrashedNotes(userId: string) {
  return useQuery({
    queryKey: notesKeys.trash(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vanguard_notes')
        .select('*, note_attachments(file_name, ocr_text)')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) return [];
      return mapNoteRows(data);
    },
    enabled: !!userId,
  });
}


// ── DOMAIN HELPERS ──

export function sortNotes(arr: Note[]): Note[] {
  return [...arr].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
