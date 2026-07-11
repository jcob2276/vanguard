import { useEffect, useState } from 'react';
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
  const [loading, setLoading] = useState(true);
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

  // Initial load
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        // 1. Fetch open tasks due before the planning date (yesterday-and-older
        // when planning today; today's own leftovers too when planning tomorrow)
        const { data: pastData } = await supabase
          .from('todo_items')
          .select('id, title, priority, duration_minutes, due_date, scheduled_time, status')
          .eq('user_id', userId)
          .eq('status', 'open')
          .lt('due_date', planningDate)
          .order('priority', { ascending: true });

        // 2. Fetch the planning date's open tasks
        const orFilter = isPlanningTomorrow
          ? `due_date.eq.${planningDate}`
          : `due_date.eq.${planningDate},ai_bucket.eq.today`;
        const { data: currentData } = await supabase
          .from('todo_items')
          .select('id, title, priority, duration_minutes, due_date, scheduled_time, status')
          .eq('user_id', userId)
          .eq('status', 'open')
          .or(orFilter)
          .order('priority', { ascending: true });

        // 3. Fetch general inbox open tasks (no due date)
        const { data: inboxData } = await supabase
          .from('todo_items')
          .select('id, title, priority, duration_minutes, due_date, scheduled_time, status')
          .eq('user_id', userId)
          .eq('status', 'open')
          .is('due_date', null)
          .order('created_at', { ascending: false });

        setYesterdayTasks((pastData as TodoSlot[]) || []);
        setTodayTasks((currentData as TodoSlot[]) || []);
        setInboxTasks((inboxData as TodoSlot[]) || []);

        // Fetch nutrition target
        const { data: nutTarget } = await supabase
          .from('nutrition_targets')
          .select('target_kcal, protein_floor_g')
          .eq('user_id', userId)
          .eq('date', planningDate)
          .maybeSingle();
        setNutritionTarget(nutTarget);

        // Pre-fill durations and times
        const timesPreset: Record<string, string> = {};
        const durationsPreset: Record<string, number> = {};
        const allTasks = [...(pastData || []), ...(currentData || []), ...(inboxData || [])] as TodoSlot[];
        allTasks.forEach((t) => {
          durationsPreset[t.id] = t.duration_minutes || 30;
          if (t.scheduled_time) {
            timesPreset[t.id] = t.scheduled_time.split('T')[1]?.slice(0, 5) || '';
          }
        });
        setTimes(timesPreset);
        setDurations(durationsPreset);

        // 4. Fetch the planning date's daily win row (Power List)
        const { data: winData } = await supabase
          .from('daily_wins')
          .select('*, daily_win_tasks(*)')
          .eq('user_id', userId)
          .eq('date', planningDate)
          .maybeSingle();

        if (winData) {
          setTodayWinId(winData.id);
          // Match existing power list items if any
          const presetList: (TodoSlot | null)[] = [null, null, null, null, null];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join types are incomplete
          const tasks = (winData as any).daily_win_tasks || [];
          for (const t of tasks) {
            const i = t.slot; // 1-indexed slot
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

        // 5. Fetch the whole week's calendar + task-due counts (header strip + Step 3 timeline)
        const weekStartLocal = getWeekStartWarsaw(planningDate);
        const weekEndExclusive = shiftWeekStart(weekStartLocal, 1);

        const { data: weekCalData } = await supabase
          .from('vanguard_calendar')
          .select('start_time, end_time, summary')
          .eq('user_id', userId)
          .gte('start_time', weekStartLocal + 'T00:00:00')
          .lt('start_time', weekEndExclusive + 'T00:00:00');
        setWeekCalendarEvents((weekCalData as CalEvent[]) || []);

        const { data: weekTaskData } = await supabase
          .from('todo_items')
          .select('due_date')
          .eq('user_id', userId)
          .eq('status', 'open')
          .not('due_date', 'is', null)
          .gte('due_date', weekStartLocal)
          .lt('due_date', weekEndExclusive);
        const counts: Record<string, number> = {};
        (weekTaskData || []).forEach((t) => {
          if (t.due_date) counts[t.due_date] = (counts[t.due_date] || 0) + 1;
        });
        setWeekTaskCounts(counts);
      } catch (err: unknown) {
        console.error('[Action Error]', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, planningDate, isPlanningTomorrow]);

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
