import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { fetchSprintReview, type SprintReview } from './goal/goalSpine';
import type { Database } from './database.types';

export type DreamRow = Database['public']['Tables']['dreams']['Row'];
export type VisionBoardItemRow = Database['public']['Tables']['vision_board_items']['Row'];

const dreamsKeys = {
  all: ['dreams'] as const,
  list: (userId: string) => [...dreamsKeys.all, 'list', userId] as const,
};

const visionItemsKeys = {
  all: ['visionItems'] as const,
  list: (userId: string) => [...visionItemsKeys.all, 'list', userId] as const,
};

const sprintReviewKeys = {
  all: ['sprintReview'] as const,
  forUser: (userId: string, loading: boolean) => [...sprintReviewKeys.all, userId, loading] as const,
};

// ── QUERIES ──

export function useDreamsQuery(userId: string) {
  return useQuery({
    queryKey: dreamsKeys.list(userId),
    queryFn: async () => {
      const { data } = await supabase.from('dreams').select('*').eq('user_id', userId)
        .order('is_done', { ascending: true })
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });
}

export function useVisionItemsQuery(userId: string) {
  return useQuery({
    queryKey: visionItemsKeys.list(userId),
    queryFn: async () => {
      const { data } = await supabase.from('vision_board_items').select('*').eq('user_id', userId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });
}

export function useSprintReviewQuery(userId: string, loading: boolean) {
  return useQuery<SprintReview | null>({
    queryKey: sprintReviewKeys.forUser(userId, loading),
    queryFn: () => fetchSprintReview(userId),
    enabled: !!userId,
  });
}

// ── MUTATIONS ──

export function useAddDreamMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; category: string; lifeGoal: string | null }) => {
      const { data, error } = await supabase.from('dreams')
        .insert({ user_id: userId, title: input.title, category: input.category, life_goal: input.lifeGoal } as never)
        .select().single();
      if (error) throw error;
      return data as DreamRow;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<DreamRow[]>(dreamsKeys.list(userId), (prev = []) => [data, ...prev]);
    },
  });
}

export function useToggleDreamMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dream: DreamRow) => {
      const is_done = !dream.is_done;
      const { data, error } = await supabase.from('dreams')
        .update({ is_done, done_at: is_done ? new Date().toISOString() : null })
        .eq('id', dream.id).select().single();
      if (error) throw error;
      return data as DreamRow;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<DreamRow[]>(dreamsKeys.list(userId), (prev = []) =>
        prev.map((d) => (d.id === data.id ? data : d)));
    },
  });
}

export function useToggleTop5Mutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dream: DreamRow) => {
      const { data, error } = await supabase.from('dreams').update({ is_top5: !dream.is_top5 }).eq('id', dream.id).select().single();
      if (error) throw error;
      return data as DreamRow;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<DreamRow[]>(dreamsKeys.list(userId), (prev = []) =>
        prev.map((d) => (d.id === data.id ? data : d)));
    },
  });
}

export function useDeleteDreamMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('dreams').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<DreamRow[]>(dreamsKeys.list(userId), (prev = []) => prev.filter((d) => d.id !== id));
    },
  });
}

export function useSaveDreamEditMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; title: string; description: string | null; category: string; lifeGoal: string | null }) => {
      const { data, error } = await supabase.from('dreams')
        .update({ title: input.title, description: input.description, category: input.category, life_goal: input.lifeGoal } as never)
        .eq('id', input.id).select().single();
      if (error) throw error;
      return data as DreamRow;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<DreamRow[]>(dreamsKeys.list(userId), (prev = []) =>
        prev.map((d) => (d.id === data.id ? data : d)));
    },
  });
}

export function useAddVisionItemMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { content: string; type: string; color: string }) => {
      const { data, error } = await supabase.from('vision_board_items')
        .insert({ user_id: userId, type: input.type, content: input.content, color: input.color })
        .select().single();
      if (error) throw error;
      return data as VisionBoardItemRow;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<VisionBoardItemRow[]>(visionItemsKeys.list(userId), (prev = []) => [data, ...prev]);
    },
  });
}

export function useDeleteVisionItemMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vision_board_items').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<VisionBoardItemRow[]>(visionItemsKeys.list(userId), (prev = []) => prev.filter((v) => v.id !== id));
    },
  });
}
