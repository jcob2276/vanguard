import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../lib/database.types';

export type TimeBudget = Database['public']['Tables']['vanguard_time_budgets']['Row'];

export function useTimeBudgets(userId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<TimeBudget[]>({
    queryKey: ['time-budgets', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('vanguard_time_budgets')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const budgets = query.data || [];
  const loading = query.isLoading;

  const mutation = useMutation({
    mutationFn: async ({
      category,
      minHours,
      maxHours,
    }: {
      category: string;
      minHours: number | null;
      maxHours: number | null;
    }) => {
      if (!userId) throw new Error('User ID is required');
      const { data, error } = await supabase
        .from('vanguard_time_budgets')
        .upsert(
          {
            user_id: userId,
            category,
            min_hours: minHours,
            max_hours: maxHours,
          },
          {
            onConflict: 'user_id,category',
          }
        )
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Failed to upsert budget');
      return data[0];
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['time-budgets', userId] });
    },
  });

  const saveBudget = useCallback(
    async (category: string, minHours: number | null, maxHours: number | null) => {
      return mutation.mutateAsync({ category, minHours, maxHours });
    },
    [mutation]
  );

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return { budgets, loading, saveBudget, refresh };
}

