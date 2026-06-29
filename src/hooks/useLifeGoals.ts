import { useCallback, useEffect, useState } from 'react';
import { fetchLongTermGoals } from '../lib/goalSpine';
import { useGoalSpineInvalidation } from './useGoalSpineInvalidation';
import type { LifeGoalDisplayRow } from '../lib/lifeGoals';

export function useLifeGoals(userId: string) {
  const [displayRows, setDisplayRows] = useState<LifeGoalDisplayRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const longTerm = await fetchLongTermGoals(userId);
      setDisplayRows(longTerm.projects);
    } catch {
      setDisplayRows([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useGoalSpineInvalidation(refresh);

  return { displayRows, loading, refresh };
}
