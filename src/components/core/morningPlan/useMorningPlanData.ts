import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { getWeekStartWarsaw, shiftWeekStart } from '../../../lib/growth/growth';
import { TodoSlot, CalEvent } from './types';

export const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-rose-500',
  high: 'text-orange-400',
  normal: 'text-primary',
  low: 'text-text-muted',
};

export const CAPACITY_HOURS = 8;

interface UseMorningPlanDataArgs {
  userId: string | undefined;
  planningDate: string;
  isPlanningTomorrow: boolean;
}

export function useMorningPlanData({ userId, planningDate, isPlanningTomorrow }: UseMorningPlanDataArgs) {
  const [yesterdayTasks, setYesterdayTasks] = useState<TodoSlot[]>([]);
  const [todayTasks, setTodayTasks] = useState<TodoSlot[]>([]);
  const [inboxTasks, setInboxTasks] = useState<TodoSlot[]>([]);

  const [powerList, setPowerList] = useState<(TodoSlot | null)[]>([null, null, null, null, null]);
  const [todayWinId, setTodayWinId] = useState<string | null>(null);
  const [nutritionTarget, setNutritionTarget] = useState<{ target_kcal: number | null; protein_floor_g: number | null } | null>(null);

  const [times, setTimes] = useState<Record<string, string>>({});
  const [durations, setDurations] = useState<Record<string, number>>({});

  const [weekCalendarEvents, setWeekCalendarEvents] = useState<CalEvent[]>([]);
  const [weekTaskCounts, setWeekTaskCounts] = useState<Record<string, number>>({});

  const { data, isLoading: loading } = useQuery({
    queryKey: ['morning-plan-data', userId, planningDate, isPlanningTomorrow],
    queryFn: async () => {
      if (!userId) return null;

      const pastPromise = supabase
        .from('todo_items')
        .select('id, title, priority, duration_minutes, due_date, scheduled_time, status')
        .eq('user_id', userId)
        .eq('status', 'open')
        .lt('due_date', planningDate)
        .order('priority', { ascending: true });

      const orFilter = isPlanningTomorrow
        ? `due_date.eq.${planningDate}`
        : `due_date.eq.${planningDate},ai_bucket.eq.today`;
      const currentPromise = supabase
        .from('todo_items')
        .select('id, title, priority, duration_minutes, due_date, scheduled_time, status')
        .eq('user_id', userId)
        .eq('status', 'open')
        .or(orFilter)
        .order('priority', { ascending: true });

      const inboxPromise = supabase
        .from('todo_items')
        .select('id, title, priority, duration_minutes, due_date, scheduled_time, status')
        .eq('user_id', userId)
        .eq('status', 'open')
        .is('due_date', null)
        .order('created_at', { ascending: false });

      const nutPromise = supabase
        .from('nutrition_targets')
        .select('target_kcal, protein_floor_g')
        .eq('user_id', userId)
        .eq('date', planningDate)
        .maybeSingle();

      const winPromise = supabase
        .from('daily_wins')
        .select('*, daily_win_tasks(*)')
        .eq('user_id', userId)
        .eq('date', planningDate)
        .maybeSingle();

      const weekStartLocal = getWeekStartWarsaw(planningDate);
      const weekEndExclusive = shiftWeekStart(weekStartLocal, 1);

      const weekCalPromise = supabase
        .from('vanguard_calendar')
        .select('start_time, end_time, summary')
        .eq('user_id', userId)
        .gte('start_time', weekStartLocal + 'T00:00:00')
        .lt('start_time', weekEndExclusive + 'T00:00:00');

      const weekTaskPromise = supabase
        .from('todo_items')
        .select('due_date')
        .eq('user_id', userId)
        .eq('status', 'open')
        .not('due_date', 'is', null)
        .gte('due_date', weekStartLocal)
        .lt('due_date', weekEndExclusive);

      const [pastRes, currentRes, inboxRes, nutRes, winRes, weekCalRes, weekTaskRes] = await Promise.all([
        pastPromise,
        currentPromise,
        inboxPromise,
        nutPromise,
        winPromise,
        weekCalPromise,
        weekTaskPromise,
      ]);

      if (pastRes.error) throw pastRes.error;
      if (currentRes.error) throw currentRes.error;
      if (inboxRes.error) throw inboxRes.error;

      return {
        pastTasks: pastRes.data || [],
        currentTasks: currentRes.data || [],
        inboxTasks: inboxRes.data || [],
        nutTarget: nutRes.data || null,
        winData: winRes.data || null,
        weekCalendarEvents: weekCalRes.data || [],
        weekTaskData: weekTaskRes.data || [],
      };
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!data) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate sync of react-query data to local state
    setYesterdayTasks(data.pastTasks as TodoSlot[]);
    setTodayTasks(data.currentTasks as TodoSlot[]);
    setInboxTasks(data.inboxTasks as TodoSlot[]);
    setNutritionTarget(data.nutTarget);

    const timesPreset: Record<string, string> = {};
    const durationsPreset: Record<string, number> = {};
    const allTasks = [...data.pastTasks, ...data.currentTasks, ...data.inboxTasks] as TodoSlot[];
    allTasks.forEach((t) => {
      durationsPreset[t.id] = t.duration_minutes || 30;
      if (t.scheduled_time) {
        timesPreset[t.id] = t.scheduled_time.split('T')[1]?.slice(0, 5) || '';
      }
    });
    setTimes(timesPreset);
    setDurations(durationsPreset);

    if (data.winData) {
      setTodayWinId(data.winData.id);
      const presetList: (TodoSlot | null)[] = [null, null, null, null, null];
      const tasks = (data.winData as Record<string, unknown>).daily_win_tasks || [];
      for (const t of tasks) {
        const i = t.slot;
        if (i >= 1 && i <= 5 && t.todo_id) {
          const found = allTasks.find((item) => item.id === t.todo_id);
          presetList[i - 1] = found || {
            id: t.todo_id,
            title: t.title || 'Zadanie',
            priority: 'normal',
            duration_minutes: 30,
            due_date: planningDate,
            scheduled_time: null,
            status: t.done ? 'done' : 'open',
          };
        }
      }
      setPowerList(presetList);
    } else {
      setTodayWinId(null);
      setPowerList([null, null, null, null, null]);
    }

    setWeekCalendarEvents(data.weekCalendarEvents as CalEvent[]);

    const counts: Record<string, number> = {};
    data.weekTaskData.forEach((t: { due_date: string | null }) => {
      if (t.due_date) counts[t.due_date] = (counts[t.due_date] || 0) + 1;
    });
    setWeekTaskCounts(counts);
  }, [data, planningDate]);

  return {
    loading,
    yesterdayTasks,
    setYesterdayTasks,
    todayTasks,
    setTodayTasks,
    inboxTasks,
    setInboxTasks,
    powerList,
    setPowerList,
    todayWinId,
    setTodayWinId,
    nutritionTarget,
    times,
    setTimes,
    durations,
    setDurations,
    weekCalendarEvents,
    weekTaskCounts,
  };
}
