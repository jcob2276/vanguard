import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNudgeCounts } from '../../../lib/nudgeApi';
import { nudgeKeys } from '../../../lib/queryKeys';

export function useNudgeData(userId: string | undefined) {
  const queryClient = useQueryClient();
  const { data } = useNudgeCounts(userId);

  const refresh = useCallback(() => {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: nudgeKeys.counts(userId) });
  }, [queryClient, userId]);

  return {
    reviewOverdueDays: data?.reviewOverdueDays ?? null,
    urgentTodoCount: data?.urgentTodoCount ?? 0,
    unreadLinkCount: data?.unreadLinkCount ?? 0,
    staleNoteCount: data?.staleNoteCount ?? 0,
    pendingGrowthMustCount: data?.pendingGrowthMustCount ?? 0,
    refresh,
  };
}
