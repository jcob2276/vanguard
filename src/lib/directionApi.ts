/**
 * DAL for Direction view — keeps supabase.from out of components.
 * Hooks under components/.../hooks may orchestrate, but table access lives here.
 */
import {
  addDays,
  endOfWeek,
  startOfWeek,
  subDays,
} from 'date-fns';
import { supabase } from './supabase';
import {
  closingMonthStartForReview,
  fetchMonthlyReview,
  fetchSprintReview,
  fetchWeeklyReviewFull,
  gatherMonthFacts,
  gatherSprintFacts,
  markDailyWinsPartial,
  nextWeekStart,
  previousWeekStart,
} from './goal/goalSpine';
import { monthThemeSourceStart } from './growth/monthReview';
import { getTodayWarsaw } from './date';
import type { Tables } from './database.types';
import type { WeeklyReviewRow } from './goal/goalSpine.types';
import type { MonthlyReviewRow } from './growth/monthReview';
import type { MonthFacts } from './growth/monthReview';
import type { SprintReview } from './goal/goalSpine.types';
import type { SprintFacts } from './growth/sprintReview';

type DailyWinRow = Tables<'daily_wins'>;
type CalendarEventRow = Pick<Tables<'vanguard_calendar'>, 'summary' | 'start_time' | 'end_time'>;

export interface DirectionRawData {
  historyData: DailyWinRow[] | null;
  reviewData: WeeklyReviewRow | null;
  planReviewData: WeeklyReviewRow | null;
  calData: CalendarEventRow[] | null;
  prevReviewData: WeeklyReviewRow | null;
  monthReviewData: MonthlyReviewRow | null;
  monthFactsData: MonthFacts | null;
  sprintReviewData: SprintReview | null;
  sprintFactsData: SprintFacts | null;
  activeThemeReviewData: MonthlyReviewRow | null;
  pastUnfinished: DailyWinRow[];
}

export async function fetchDirectionData(
  userId: string,
  currentWeekStart: string,
  sprintClosingWeek: boolean,
): Promise<DirectionRawData> {
  const today = getTodayWarsaw();
  const now = new Date(today + 'T12:00:00');
  const isSundayFetch = now.getDay() === 0;
  const planWeekStartStr = isSundayFetch ? nextWeekStart(currentWeekStart) : null;

  const calFrom = subDays(startOfWeek(now, { weekStartsOn: 1 }), 1).toISOString();
  const calTo = addDays(endOfWeek(addDays(now, 7), { weekStartsOn: 1 }), 1).toISOString();
  const prevWeekStartStr = previousWeekStart(currentWeekStart);
  const monthStart = closingMonthStartForReview(today);

  const [
    ,
    { data: historyData },
    reviewData,
    planReviewData,
    { data: calData },
    prevReviewData,
    monthReviewData,
    monthFactsData,
    sprintReviewData,
    sprintFactsData,
    activeThemeReviewData,
  ] = await Promise.all([
    supabase.from('daily_wins').select('*, daily_win_tasks(*)').eq('user_id', userId).eq('date', today).maybeSingle(),
    supabase.from('daily_wins').select('*, daily_win_tasks(*)').eq('user_id', userId).order('date', { ascending: false }).limit(60),
    fetchWeeklyReviewFull(userId, currentWeekStart),
    planWeekStartStr ? fetchWeeklyReviewFull(userId, planWeekStartStr) : Promise.resolve(null),
    supabase.from('vanguard_calendar').select('summary, start_time, end_time').eq('user_id', userId).gte('start_time', calFrom).lt('start_time', calTo).order('start_time'),
    fetchWeeklyReviewFull(userId, prevWeekStartStr),
    monthStart ? fetchMonthlyReview(userId, monthStart) : Promise.resolve(null),
    monthStart ? gatherMonthFacts(userId, monthStart) : Promise.resolve(null),
    sprintClosingWeek ? fetchSprintReview(userId) : Promise.resolve(null),
    sprintClosingWeek ? gatherSprintFacts(userId) : Promise.resolve(null),
    isSundayFetch ? fetchMonthlyReview(userId, monthThemeSourceStart(today)) : Promise.resolve(null),
  ]);

  const pastUnfinished = (historyData ?? []).filter((d) => d.date && d.date < today && d.result === null);
  let refreshedHistory: DailyWinRow[] | null = historyData;
  if (pastUnfinished.length > 0) {
    try {
      await markDailyWinsPartial(userId, pastUnfinished.map((d) => d.id));
      const { data } = await supabase
        .from('daily_wins')
        .select('*, daily_win_tasks(*)')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(60);
      refreshedHistory = data;
    } catch {
      /* non-fatal */
    }
  }

  return {
    historyData: refreshedHistory,
    reviewData,
    planReviewData,
    calData,
    prevReviewData,
    monthReviewData,
    monthFactsData,
    sprintReviewData,
    sprintFactsData,
    activeThemeReviewData,
    pastUnfinished,
  };
}

export async function fetchActiveProjects(userId: string): Promise<Array<{
  id: string;
  name: string;
  goal: string | null;
  status: string;
  primary_skill_id?: string | null;
}>> {
  const withSkill = await supabase
    .from('projects')
    .select('id, name, goal, status, primary_skill_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (!withSkill.error) {
    return (withSkill.data ?? []) as Array<{
      id: string;
      name: string;
      goal: string | null;
      status: string;
      primary_skill_id?: string | null;
    }>;
  }

  const fallback = await supabase
    .from('projects')
    .select('id, name, goal, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (fallback.error) throw fallback.error;
  return (fallback.data ?? []).map((p) => ({ ...p, primary_skill_id: null }));
}

export async function fetchDirectionWeekBoard(userId: string, weekStart: string, weekEnd: string, weekFromISO: string) {
  return Promise.all([
    supabase.from('learning_week_pins').select('id, slot, done, entity_type, entity_id, manual_title, project_id').eq('user_id', userId).eq('week_start', weekStart).order('sort_order'),
    supabase.from('goal_kpis').select('id, project_id, name, target').eq('user_id', userId),
    supabase.from('daily_wins').select('date, task_1, task_2, task_3, task_4, task_5, done_1, done_2, done_3, done_4, done_5, daily_win_tasks(slot, title, done)').eq('user_id', userId).gte('date', weekStart).lt('date', weekEnd),
    supabase.from('learning_week_focus').select('skill_id, subskill_id, target_level').eq('user_id', userId).eq('week_start', weekStart).maybeSingle(),
    supabase.from('learning_skills').select('id, key, label, parent_id').eq('user_id', userId).eq('active', true),
    supabase.from('vanguard_links').select('id, title').eq('user_id', userId).limit(80),
    supabase.from('todo_items').select('id, title, priority, due_date, section_id, status').eq('user_id', userId).neq('status', 'done').order('created_at', { ascending: false }).limit(60),
    supabase.from('todo_sections').select('id, project_id').eq('user_id', userId),
    supabase.from('todo_items').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_milestone', true).eq('status', 'done').gte('completed_at', weekFromISO),
    supabase.from('todo_items').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_milestone', true).in('status', ['pending', 'open']).lte('due_date', weekEnd),
  ]);
}
