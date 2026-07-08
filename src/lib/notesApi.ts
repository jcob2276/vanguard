import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  is_pinned: boolean;
  is_archived: boolean;
  color?: string;
  created_at: string;
  updated_at: string;
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

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      note,
    }: {
      userId: string;
      note: Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
    }) => {
      const { data, error } = await supabase
        .from('vanguard_notes')
        .insert({
          user_id: userId,
          ...note,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as Note;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: notesKeys.list(variables.userId) });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      noteId,
      updates,
    }: {
      userId: string;
      noteId: string;
      updates: Partial<Note>;
    }) => {
      const { data, error } = await supabase
        .from('vanguard_notes')
        .update(updates)
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as Note;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: notesKeys.list(variables.userId) });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, noteId }: { userId: string; noteId: string }) => {
      const { error } = await supabase
        .from('vanguard_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw new Error(error.message);
      return noteId;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: notesKeys.list(variables.userId) });
    },
  });
}
