import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

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

export const notesKeys = {
  all: ['notes'] as const,
  list: (userId: string) => [...notesKeys.all, 'list', userId] as const,
};

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
  const { data, error } = await supabase
    .from('vanguard_notes')
    .insert({ user_id: userId, ...partial })
    .select()
    .single();

  if (error) throw error;
  return data as Note;
}

export async function updateNoteApi(id: string, patch: Partial<Note>): Promise<void> {
  const { error } = await supabase
    .from('vanguard_notes')
    .update(patch)
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
