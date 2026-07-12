import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLongTermGoals } from '../../../lib/goal/goalSpine';
import { useGoalSpineInvalidation } from '../../../hooks/useGoalSpineInvalidation';
import type { LifeGoalDisplayRow } from '../../../lib/projects/lifeGoals';

export function useLifeGoals(userId: string) {
  const query = useQuery<LifeGoalDisplayRow[]>({
    queryKey: ['life-goals', userId],
    queryFn: async () => {
      if (!userId) return [];
      try {
        const longTerm = await fetchLongTermGoals(userId);
        return longTerm.projects;
      } catch {
        return [];
      }
    },
    enabled: !!userId,
  });

  const displayRows = query.data || [];
  const loading = query.isLoading;

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  useGoalSpineInvalidation(refresh);

  return { displayRows, loading, refresh };
}

