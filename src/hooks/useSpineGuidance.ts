import { useCallback, useEffect, useMemo, useState } from 'react';
import { getTodayWarsaw, getYesterdayWarsaw } from '../lib/date';
import {
  currentWeekStart,
  fetchGoalSpine,
  fetchLatestWeeklyKpiWeekStart,
  fetchWeeklyReviewFull,
  type GoalSpine,
  type WeeklyReviewRow,
} from '../lib/goalSpine';
import {
  dayWinStateFromRow,
  deriveSpineGuidance,
  type SpineGuidance,
} from '../lib/goalSpineGuide';
import { useGoalSpineInvalidation } from './useGoalSpineInvalidation';
import { supabase } from '../lib/supabase';

function daysSince(fromDate: string, toDate: string): number {
  const d1 = new Date(`${toDate}T12:00:00Z`);
  const d2 = new Date(`${fromDate}T12:00:00Z`);
  return Math.round((d1.getTime() - d2.getTime()) / 86400000);
}

export function useSpineGuidance(
  userId: string | undefined,
  todayWin?: Record<string, unknown> | null,
) {
  const weekStart = useMemo(() => currentWeekStart(), []);
  const [spine, setSpine] = useState<GoalSpine | null>(null);
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReviewRow | null>(null);
  const [kpiOverdueDays, setKpiOverdueDays] = useState<number | null>(null);
  const [yesterdayBlocked, setYesterdayBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setSpine(null);
      setWeeklyReview(null);
      setKpiOverdueDays(null);
      setYesterdayBlocked(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const today = getTodayWarsaw();
      const [spineData, review, lastKpiWeek] = await Promise.all([
        fetchGoalSpine(userId, weekStart),
        fetchWeeklyReviewFull(userId, weekStart),
        fetchLatestWeeklyKpiWeekStart(userId),
      ]);
      setSpine(spineData);
      setWeeklyReview(review);
      setKpiOverdueDays(lastKpiWeek ? daysSince(lastKpiWeek, today) : 999);
    } catch (e) {
      console.error('[useSpineGuidance]', e);
      setSpine(null);
    } finally {
      setLoading(false);
    }
  }, [userId, weekStart]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useGoalSpineInvalidation(reload);

  useEffect(() => {
    if (!userId || todayWin) {
      setYesterdayBlocked(false);
      return;
    }
    const yesterday = getYesterdayWarsaw();
    void supabase
      .from('daily_wins')
      .select('task_1, day_note')
      .eq('user_id', userId)
      .eq('date', yesterday)
      .maybeSingle()
      .then(({ data }) => {
        const needs =
          Boolean(typeof data?.task_1 === 'string' && data.task_1.trim()) &&
          !data?.day_note?.trim();
        setYesterdayBlocked(needs);
      });
  }, [userId, todayWin]);

  const guidance = useMemo<SpineGuidance | null>(() => {
    if (!spine) return null;
    return deriveSpineGuidance(spine, {
      weeklyReview,
      kpiOverdueDays,
      today: getTodayWarsaw(),
      day: dayWinStateFromRow(todayWin, yesterdayBlocked),
    });
  }, [spine, weeklyReview, kpiOverdueDays, todayWin, yesterdayBlocked]);

  return { guidance, loading, reload, spine };
}
