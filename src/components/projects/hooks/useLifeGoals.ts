import { useCallback, useEffect, useState } from 'react';
import { fetchLongTermGoals } from '../../../lib/goal/goalSpine';
import { useGoalSpineInvalidation } from '../../../hooks/useGoalSpineInvalidation';
import type { LifeGoalDisplayRow } from '../../../lib/projects/lifeGoals';

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
    void (async () => { await refresh(); })();
  }, [refresh]);

  useGoalSpineInvalidation(refresh);

  return { displayRows, loading, refresh };
}
