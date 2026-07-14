import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMorningPlanData } from '../../../lib/morningPlanApi';
import { TodoSlot, CalEvent } from './types';

export const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-danger',
  high: 'text-warning',
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
      const res = await fetchMorningPlanData(userId, planningDate, isPlanningTomorrow);
      return {
        pastTasks: res.pastTasks,
        currentTasks: res.currentTasks,
        inboxTasks: res.inboxTasks,
        nutTarget: res.nutritionTarget,
        winData: res.dailyWin,
        weekCalendarEvents: res.weekCalendarEvents,
        weekTaskData: res.weekTasks,
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
      type DailyWinTask = { slot: number; todo_id: string | null; title: string | null; done: boolean };
      const tasks = ((data.winData as Record<string, unknown>).daily_win_tasks as DailyWinTask[]) || [];
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
