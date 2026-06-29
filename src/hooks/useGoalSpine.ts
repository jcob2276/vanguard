import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  currentWeekStart,
  fetchGoalSpine,
  type GoalSpine,
} from '../lib/goalSpine';
import { useGoalSpineInvalidation } from './useGoalSpineInvalidation';

export function useGoalSpine(userId: string | undefined, weekStart?: string) {
  const resolvedWeek = useMemo(() => weekStart ?? currentWeekStart(), [weekStart]);
  const [spine, setSpine] = useState<GoalSpine | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setSpine(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchGoalSpine(userId, resolvedWeek);
      setSpine(data);
    } catch (e) {
      console.error('[useGoalSpine]', e);
      setSpine(null);
    } finally {
      setLoading(false);
    }
  }, [userId, resolvedWeek]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useGoalSpineInvalidation(reload);

  return { spine, loading, reload, weekStart: resolvedWeek };
}
