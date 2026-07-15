import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMorningPlanData, type MorningPlanData } from '../../../lib/morningPlanApi';
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

interface MorningPlanLocalState {
  yesterdayTasks: TodoSlot[];
  todayTasks: TodoSlot[];
  inboxTasks: TodoSlot[];
  powerList: (TodoSlot | null)[];
  todayWinId: string | null;
  nutritionTarget: { target_kcal: number | null; protein_floor_g: number | null } | null;
  times: Record<string, string>;
  durations: Record<string, number>;
  weekCalendarEvents: CalEvent[];
  weekTaskCounts: Record<string, number>;
}

function deriveLocalState(data: MorningPlanData, planningDate: string): MorningPlanLocalState {
  const allTasks = [...data.pastTasks, ...data.currentTasks, ...data.inboxTasks] as TodoSlot[];

  const times: Record<string, string> = {};
  const durations: Record<string, number> = {};
  allTasks.forEach((t) => {
    durations[t.id] = t.duration_minutes || 30;
    if (t.scheduled_time) {
      times[t.id] = t.scheduled_time.split('T')[1]?.slice(0, 5) || '';
    }
  });

  let todayWinId: string | null = null;
  const powerList: (TodoSlot | null)[] = [null, null, null, null, null];
  if (data.dailyWin) {
    todayWinId = data.dailyWin.id;
    type DailyWinTask = { slot: number; todo_id: string | null; title: string | null; done: boolean };
    const tasks = ((data.dailyWin as Record<string, unknown>).daily_win_tasks as DailyWinTask[]) || [];
    for (const t of tasks) {
      const i = t.slot;
      if (i >= 1 && i <= 5 && t.todo_id) {
        const found = allTasks.find((item) => item.id === t.todo_id);
        powerList[i - 1] = found || {
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
  }

  const weekTaskCounts: Record<string, number> = {};
  data.weekTasks.forEach((t) => {
    if (t.due_date) weekTaskCounts[t.due_date] = (weekTaskCounts[t.due_date] || 0) + 1;
  });

  return {
    yesterdayTasks: data.pastTasks as TodoSlot[],
    todayTasks: data.currentTasks as TodoSlot[],
    inboxTasks: data.inboxTasks as TodoSlot[],
    powerList,
    todayWinId,
    nutritionTarget: data.nutritionTarget,
    times,
    durations,
    weekCalendarEvents: data.weekCalendarEvents as CalEvent[],
    weekTaskCounts,
  };
}

const EMPTY_STATE: MorningPlanLocalState = {
  yesterdayTasks: [],
  todayTasks: [],
  inboxTasks: [],
  powerList: [null, null, null, null, null],
  todayWinId: null,
  nutritionTarget: null,
  times: {},
  durations: {},
  weekCalendarEvents: [],
  weekTaskCounts: {},
};

function computeInitialFromCache(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  planningDate: string,
  isPlanningTomorrow: boolean,
): MorningPlanLocalState {
  const key = ['morning-plan-data', userId, planningDate, isPlanningTomorrow];
  const cached = queryClient.getQueryData<MorningPlanData>(key);
  if (!cached) return EMPTY_STATE;
  return deriveLocalState(cached, planningDate);
}

export function useMorningPlanData({ userId, planningDate, isPlanningTomorrow }: UseMorningPlanDataArgs) {
  const queryClient = useQueryClient();
  const initial = userId ? computeInitialFromCache(queryClient, userId, planningDate, isPlanningTomorrow) : EMPTY_STATE;

  const [yesterdayTasks, setYesterdayTasks] = useState<TodoSlot[]>(initial.yesterdayTasks);
  const [todayTasks, setTodayTasks] = useState<TodoSlot[]>(initial.todayTasks);
  const [inboxTasks, setInboxTasks] = useState<TodoSlot[]>(initial.inboxTasks);
  const [powerList, setPowerList] = useState<(TodoSlot | null)[]>(initial.powerList);
  const [todayWinId, setTodayWinId] = useState<string | null>(initial.todayWinId);
  const [nutritionTarget, setNutritionTarget] = useState(initial.nutritionTarget);
  const [times, setTimes] = useState<Record<string, string>>(initial.times);
  const [durations, setDurations] = useState<Record<string, number>>(initial.durations);
  const [weekCalendarEvents, setWeekCalendarEvents] = useState<CalEvent[]>(initial.weekCalendarEvents);
  const [weekTaskCounts, setWeekTaskCounts] = useState<Record<string, number>>(initial.weekTaskCounts);

  const { data, isLoading: loading } = useQuery({
    queryKey: ['morning-plan-data', userId, planningDate, isPlanningTomorrow],
    queryFn: async () => {
      if (!userId) return null;
      return fetchMorningPlanData(userId, planningDate, isPlanningTomorrow);
    },
    enabled: !!userId,
  });

  // Sync from query data when it arrives after initial cache miss.
  // Uses boolean guard to only sync once, protecting user edits from being overwritten.
  const [initialSyncDone, setInitialSyncDone] = useState(() => JSON.stringify(initial) !== JSON.stringify(EMPTY_STATE));

  if (data && !initialSyncDone) {
    setInitialSyncDone(true);
    const s = deriveLocalState(data, planningDate);
    setYesterdayTasks(s.yesterdayTasks);
    setTodayTasks(s.todayTasks);
    setInboxTasks(s.inboxTasks);
    setPowerList(s.powerList);
    setTodayWinId(s.todayWinId);
    setNutritionTarget(s.nutritionTarget);
    setTimes(s.times);
    setDurations(s.durations);
    setWeekCalendarEvents(s.weekCalendarEvents);
    setWeekTaskCounts(s.weekTaskCounts);
  }

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
