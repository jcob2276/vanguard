import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTodayWarsaw, getYesterdayWarsaw } from '../../../lib/date';
import {
  currentWeekStart,
  fetchGoalSpine,
  fetchLatestCompletedWeeklyReviewDate,
  fetchWeeklyReviewFull,
} from '../../../lib/goal/goalSpine';
import { useWarsawDayChange } from '../../../hooks/useWarsawDayChange';
import {
  dayWinStateFromRow,
  deriveSpineGuidance,
  type SpineGuidance,
} from '../../../lib/goal/goalSpineGuide';
import { useGoalSpineInvalidation } from '../../../hooks/useGoalSpineInvalidation';
import { supabase } from '../../../lib/supabase';

function daysSince(fromDate: string, toDate: string): number {
  const d1 = new Date(`${toDate}T12:00:00Z`);
  const d2 = new Date(`${fromDate}T12:00:00Z`);
  return Math.round((d1.getTime() - d2.getTime()) / 86400000);
}

export function useSpineGuidance(
  userId: string | undefined,
  todayWin?: Record<string, unknown> | null,
) {
  const query = useQuery({
    queryKey: ['spine-guidance', userId],
    queryFn: async () => {
      if (!userId) {
        return {
          spine: null,
          weeklyReview: null,
          weekReflectionOverdueDays: null,
          yesterdayBlocked: false,
        };
      }

      const today = getTodayWarsaw();
      const weekStart = currentWeekStart();
      const yesterday = getYesterdayWarsaw();

      const [spineData, review, lastReflectionAt, winsRes] = await Promise.all([
        fetchGoalSpine(userId, weekStart, today),
        fetchWeeklyReviewFull(userId, weekStart),
        fetchLatestCompletedWeeklyReviewDate(userId),
        supabase
          .from('daily_wins')
          .select('task_1, day_note')
          .eq('user_id', userId)
          .eq('date', yesterday)
          .maybeSingle(),
      ]);

      const overdueDays = lastReflectionAt ? daysSince(lastReflectionAt.slice(0, 10), today) : 999;

      const data = winsRes.data;
      const yesterdayBlocked = Boolean(typeof data?.task_1 === 'string' && data.task_1.trim()) && !data?.day_note?.trim();

      return {
        spine: spineData,
        weeklyReview: review,
        weekReflectionOverdueDays: overdueDays,
        yesterdayBlocked,
      };
    },
    enabled: !!userId,
  });

  const spine = query.data?.spine ?? null;
  const weeklyReview = query.data?.weeklyReview ?? null;
  const weekReflectionOverdueDays = query.data?.weekReflectionOverdueDays ?? null;
  const yesterdayBlocked = todayWin ? false : (query.data?.yesterdayBlocked ?? false);
  const loading = query.isLoading;

  const reload = useCallback(async () => {
    await query.refetch();
  }, [query]);

  useWarsawDayChange(() => {
    void query.refetch();
  });

  useGoalSpineInvalidation(reload);

  const guidance = useMemo<SpineGuidance | null>(() => {
    if (!spine) return null;

    return deriveSpineGuidance(spine, {
      weeklyReview,
      weekReflectionOverdueDays,
      today: getTodayWarsaw(),
      day: dayWinStateFromRow(todayWin, yesterdayBlocked),
    });
  }, [spine, weeklyReview, weekReflectionOverdueDays, todayWin, yesterdayBlocked]);

  return { guidance, loading, reload, spine };
}



