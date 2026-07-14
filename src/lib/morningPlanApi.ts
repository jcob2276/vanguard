import { supabase } from './supabase';
import { shiftDateStr } from './date';
import { getWeekStartWarsaw, shiftWeekStart } from './growth/growth';
import type { Tables, TablesInsert } from './database.types';

export interface MorningPlanTodo {
  id: string;
  title: string;
  priority: string;
  duration_minutes: number | null;
  due_date: string | null;
  scheduled_time: string | null;
  status: string;
}

export interface MorningPlanData {
  pastTasks: MorningPlanTodo[];
  currentTasks: MorningPlanTodo[];
  inboxTasks: MorningPlanTodo[];
  nutritionTarget: { target_kcal: number | null; protein_floor_g: number | null } | null;
  dailyWin: (Tables<'daily_wins'> & { daily_win_tasks: Tables<'daily_win_tasks'>[] }) | null;
  weekCalendarEvents: { start_time: string | null; end_time: string | null; summary: string | null }[];
  weekTasks: { due_date: string | null }[];
}

export async function fetchMorningPlanData(
  userId: string,
  planningDate: string,
  isPlanningTomorrow: boolean
): Promise<MorningPlanData> {
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
  if (nutRes.error) throw nutRes.error;
  if (winRes.error) throw winRes.error;
  if (weekCalRes.error) throw weekCalRes.error;
  if (weekTaskRes.error) throw weekTaskRes.error;

  return {
    pastTasks: (pastRes.data || []) as MorningPlanTodo[],
    currentTasks: (currentRes.data || []) as MorningPlanTodo[],
    inboxTasks: (inboxRes.data || []) as MorningPlanTodo[],
    nutritionTarget: nutRes.data,
    dailyWin: winRes.data,
    weekCalendarEvents: weekCalRes.data || [],
    weekTasks: weekTaskRes.data || [],
  };
}

export async function updateTodoDueDate(
  taskId: string,
  action: 'today' | 'later' | 'backlog' | 'drop' | 'done',
  planningDate: string
): Promise<void> {
  let updatePayload: Partial<Tables<'todo_items'>> = {};

  if (action === 'today') {
    updatePayload = { due_date: planningDate };
  } else if (action === 'later') {
    const laterDate = shiftDateStr(planningDate, 1);
    updatePayload = { due_date: laterDate };
  } else if (action === 'backlog') {
    updatePayload = { due_date: null };
  } else if (action === 'drop') {
    updatePayload = { status: 'dropped' };
  } else if (action === 'done') {
    updatePayload = { status: 'done', completed_at: new Date().toISOString() };
  }

  const { error } = await supabase
    .from('todo_items')
    .update(updatePayload)
    .eq('id', taskId);

  if (error) {
    throw error;
  }
}

export async function deleteDailyWinTasks(dayWinId: string): Promise<void> {
  const { error } = await supabase
    .from('daily_win_tasks')
    .delete()
    .eq('day_win_id', dayWinId);

  if (error) {
    throw error;
  }
}

export async function insertDailyWinTasks(entries: TablesInsert<'daily_win_tasks'>[]): Promise<void> {
  const { error } = await supabase
    .from('daily_win_tasks')
    .insert(entries);

  if (error) {
    throw error;
  }
}

export async function updateTodoScheduledTime(
  taskId: string,
  scheduledTime: string,
  durationMinutes: number
): Promise<void> {
  const { error } = await supabase
    .from('todo_items')
    .update({
      scheduled_time: scheduledTime,
      duration_minutes: durationMinutes,
    })
    .eq('id', taskId);

  if (error) {
    throw error;
  }
}
