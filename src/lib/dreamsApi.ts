import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { fetchSprintReview, type SprintReview } from './goal/goalSpine';
import { isOfflineError, queueOfflineWrite } from './offlineQueue';
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
      const payload = { user_id: userId, title: input.title, category: input.category, life_goal: input.lifeGoal };
      try {
        const { data, error } = await supabase.from('dreams').insert(payload as never).select().single();
        if (error) throw error;
        return data as DreamRow;
      } catch (err: unknown) {
        if (!isOfflineError(err)) throw err;
        const local = { id: crypto.randomUUID(), is_done: false, is_top5: false, ...payload } as DreamRow;
        await queueOfflineWrite('table:insert:dreams', { payload: local }, 'Dodanie marzenia');
        return local;
      }
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
      const done_at = is_done ? new Date().toISOString() : null;
      try {
        const { data, error } = await supabase.from('dreams')
          .update({ is_done, done_at })
          .eq('id', dream.id).select().single();
        if (error) throw error;
        return data as DreamRow;
      } catch (err: unknown) {
        if (!isOfflineError(err)) throw err;
        await queueOfflineWrite('table:update:dreams', { match: { id: dream.id }, payload: { is_done, done_at } }, 'Odznaczenie marzenia');
        return { ...dream, is_done, done_at };
      }
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
      const is_top5 = !dream.is_top5;
      try {
        const { data, error } = await supabase.from('dreams').update({ is_top5 }).eq('id', dream.id).select().single();
        if (error) throw error;
        return data as DreamRow;
      } catch (err: unknown) {
        if (!isOfflineError(err)) throw err;
        await queueOfflineWrite('table:update:dreams', { match: { id: dream.id }, payload: { is_top5 } }, 'Zmiana top5 marzenia');
        return { ...dream, is_top5 };
      }
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
      try {
        const { error } = await supabase.from('dreams').delete().eq('id', id);
        if (error) throw error;
      } catch (err: unknown) {
        if (!isOfflineError(err)) throw err;
        await queueOfflineWrite('table:delete:dreams', { match: { id } }, 'Usunięcie marzenia');
      }
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
      const payload = { title: input.title, description: input.description, category: input.category, life_goal: input.lifeGoal };
      try {
        const { data, error } = await supabase.from('dreams')
          .update(payload as never)
          .eq('id', input.id).select().single();
        if (error) throw error;
        return data as DreamRow;
      } catch (err: unknown) {
        if (!isOfflineError(err)) throw err;
        await queueOfflineWrite('table:update:dreams', { match: { id: input.id }, payload }, 'Edycja marzenia');
        const prevList = queryClient.getQueryData<DreamRow[]>(dreamsKeys.list(userId)) ?? [];
        const prevDream = prevList.find((d) => d.id === input.id);
        return { ...prevDream, ...payload, id: input.id } as DreamRow;
      }
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
      const payload = { user_id: userId, type: input.type, content: input.content, color: input.color };
      try {
        const { data, error } = await supabase.from('vision_board_items').insert(payload).select().single();
        if (error) throw error;
        return data as VisionBoardItemRow;
      } catch (err: unknown) {
        if (!isOfflineError(err)) throw err;
        const local = { id: crypto.randomUUID(), sort_order: 0, ...payload } as VisionBoardItemRow;
        await queueOfflineWrite('table:insert:vision_board_items', { payload: local }, 'Dodanie elementu tablicy wizji');
        return local;
      }
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
      try {
        const { error } = await supabase.from('vision_board_items').delete().eq('id', id);
        if (error) throw error;
      } catch (err: unknown) {
        if (!isOfflineError(err)) throw err;
        await queueOfflineWrite('table:delete:vision_board_items', { match: { id } }, 'Usunięcie elementu tablicy wizji');
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<VisionBoardItemRow[]>(visionItemsKeys.list(userId), (prev = []) => prev.filter((v) => v.id !== id));
    },
  });
}
