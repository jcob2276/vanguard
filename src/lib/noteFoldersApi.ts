import { useQuery } from '@tanstack/react-query';
import type { Database } from './database.types';
import { notesKeys } from './queryKeys';
import { supabase } from './supabase';

export type NoteFolder = Database['public']['Tables']['note_folders']['Row'];

export function useNoteFolders(userId: string) {
  return useQuery({
    queryKey: notesKeys.folders(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('note_folders')
        .select('*')
        .eq('user_id', userId)
        .order('name');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!userId,
  });
}

export async function createNoteFolder(userId: string, name: string): Promise<NoteFolder> {
  const normalized = name.trim();
  if (!normalized) throw new Error('Nazwa folderu nie może być pusta.');
  const { data, error } = await supabase
    .from('note_folders')
    .insert({ user_id: userId, name: normalized })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteNoteFolder(id: string): Promise<void> {
  const { error } = await supabase.from('note_folders').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
