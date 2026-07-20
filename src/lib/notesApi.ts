import { useQuery } from '@tanstack/react-query';
import { buildNoteInsertRow } from '@vanguard/domain';
import { supabase } from './supabase';
import { isOfflineError, queueOfflineWrite } from './offlineQueue';
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
}

interface ApiError {
  code?: string;
  message: string;
}

// ── QUERIES ──

export function useNotes(userId: string) {
  return useQuery({
    queryKey: notesKeys.list(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vanguard_notes')
        .select('*')
        .eq('user_id', userId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return (data as Note[]) || [];
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

  try {
    const { data, error } = await supabase
      .from('vanguard_notes')
      .insert(payload as never)
      .select()
      .single();

    if (error) throw error;
    return data as Note;
  } catch (err: unknown) {
    if (isOfflineError(err)) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const local: Note = {
        id,
        user_id: userId,
        title: String(payload.title),
        content: String(payload.content),
        tags: (payload.tags as string[]) ?? [],
        is_pinned: Boolean(payload.is_pinned ?? false),
        is_archived: Boolean(payload.is_archived ?? false),
        color: String(payload.color ?? 'default'),
        created_at: now,
        updated_at: now,
      };
      await queueOfflineWrite('table:insert:vanguard_notes', { payload: local }, 'Dodanie notatki');
      return local;
    }
    throw err;
  }
}

export async function updateNoteApi(id: string, patch: Partial<Note>): Promise<void> {
  try {
    const { error } = await supabase
      .from('vanguard_notes')
      .update(patch)
      .eq('id', id);

    if (error) throw error;
  } catch (err: unknown) {
    if (isOfflineError(err)) {
      await queueOfflineWrite('table:update:vanguard_notes', { match: { id }, payload: patch }, 'Edycja notatki');
      return;
    }
    throw err;
  }
}

export async function deleteNoteApi(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('vanguard_notes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (err: unknown) {
    if (isOfflineError(err)) {
      await queueOfflineWrite('table:delete:vanguard_notes', { match: { id } }, 'Usunięcie notatki');
      return;
    }
    throw err;
  }
}

// ── DOMAIN HELPERS ──

export function sortNotes(arr: Note[]): Note[] {
  return [...arr].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function isNetworkOrTableError(err: unknown): boolean {
  if (!err) return false;
  const errorObj = err as ApiError;
  const msg = errorObj.message?.toLowerCase() || '';
  return (
    errorObj.code === 'PGRST205' ||
    errorObj.code === 'PGRST100' ||
    msg.includes('vanguard_notes') ||
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    !navigator.onLine
  );
}
