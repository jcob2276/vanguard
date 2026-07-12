/**
 * Pure data-fetching layer for useDirection.
 * All Supabase queries for the Direction view are here.
 */
import {
  addDays,
  endOfWeek,
  format,
  startOfWeek,
  subDays,
} from 'date-fns';
import { supabase } from '../../../../lib/supabase';
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
} from '../../../../lib/goal/goalSpine';
import { monthThemeSourceStart } from '../../../../lib/growth/monthReview';
import { getTodayWarsaw, warsawDayBoundsISO } from '../../../../lib/date';
import type { Tables } from '../../../../lib/database.types';
import type { WeeklyReviewRow } from '../../../../lib/goal/goalSpine.types';
import type { MonthlyReviewRow } from '../../../../lib/growth/monthReview';
import type { MonthFacts } from '../../../../lib/growth/monthReview';
import type { SprintReview } from '../../../../lib/goal/goalSpine.types';
import type { SprintFacts } from '../../../../lib/growth/sprintReview';

type DailyWinRow = Tables<'daily_wins'>;
type CalendarEventRow = Pick<Tables<'vanguard_calendar'>, 'summary' | 'start_time' | 'end_time'>;
type OuraSummaryRow = Pick<Tables<'oura_daily_summary'>, 'total_sleep_hours' | 'readiness_score'>;
type StravaRunRow = Pick<Tables<'strava_activities'>, 'distance'>;
type NutritionRow = Pick<Tables<'daily_nutrition'>, 'calories'>;
type NutritionTargetRow = Pick<Tables<'nutrition_targets'>, 'target_kcal'>;
type DoneTaskRow = Pick<Tables<'todo_items'>, 'title' | 'status'>;
type ActiveProjectRow = Pick<Tables<'projects'>, 'id' | 'name'>;

export interface DirectionRawData {
  historyData: DailyWinRow[] | null;
  reviewData: WeeklyReviewRow | null;
  planReviewData: WeeklyReviewRow | null;
  calData: CalendarEventRow[] | null;
  prevReviewData: WeeklyReviewRow | null;
  ouraData: OuraSummaryRow[] | null;
  runsData: StravaRunRow[] | null;
  nutritionData: NutritionRow[] | null;
  nutritionTargetData: NutritionTargetRow | null;
  doneTasksData: DoneTaskRow[] | null;
  projectsData: ActiveProjectRow[] | null;
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
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const monthStart = closingMonthStartForReview(today);

  const [
    ,
    { data: historyData },
    reviewData,
    planReviewData,
    { data: calData },
    prevReviewData,
    { data: ouraData },
    { data: runsData },
    { data: nutritionData },
    { data: nutritionTargetData },
    { data: doneTasksData },
    { data: projectsData },
    monthReviewData,
    monthFactsData,
    sprintReviewData,
    sprintFactsData,
    activeThemeReviewData,
  ] = await Promise.all([
    supabase.from('daily_wins').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
    supabase.from('daily_wins').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(60),
    fetchWeeklyReviewFull(userId, currentWeekStart),
    planWeekStartStr ? fetchWeeklyReviewFull(userId, planWeekStartStr) : Promise.resolve(null),
    supabase.from('vanguard_calendar').select('summary, start_time, end_time').eq('user_id', userId).gte('start_time', calFrom).lt('start_time', calTo).order('start_time'),
    fetchWeeklyReviewFull(userId, prevWeekStartStr),
    supabase.from('oura_daily_summary').select('total_sleep_hours, readiness_score').eq('user_id', userId).gte('date', currentWeekStart).lte('date', weekEnd),
    supabase.from('strava_activities').select('distance').eq('user_id', userId).gte('start_date', warsawDayBoundsISO(currentWeekStart).fromISO).lte('start_date', warsawDayBoundsISO(weekEnd).toISO),
    supabase.from('daily_nutrition').select('calories').eq('user_id', userId).gte('date', currentWeekStart).lte('date', weekEnd),
    supabase.from('nutrition_targets').select('target_kcal').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('todo_items').select('title, status').eq('user_id', userId).in('status', ['done', 'dropped']).gte('updated_at', warsawDayBoundsISO(currentWeekStart).fromISO).lte('updated_at', warsawDayBoundsISO(weekEnd).toISO),
    supabase.from('projects').select('id, name').eq('user_id', userId).eq('status', 'active'),
    monthStart ? fetchMonthlyReview(userId, monthStart) : Promise.resolve(null),
    monthStart ? gatherMonthFacts(userId, monthStart) : Promise.resolve(null),
    sprintClosingWeek ? fetchSprintReview(userId) : Promise.resolve(null),
    sprintClosingWeek ? gatherSprintFacts(userId) : Promise.resolve(null),
    isSundayFetch ? fetchMonthlyReview(userId, monthThemeSourceStart(today)) : Promise.resolve(null),
  ]);

  // Mark past unfinished wins as partial (side effect, but fits cleanly here)
  const pastUnfinished = (historyData ?? []).filter((d) => d.date && d.date < today && d.result === null);
  let refreshedHistory: DailyWinRow[] | null = historyData;
  if (pastUnfinished.length > 0) {
    try {
      await markDailyWinsPartial(userId, pastUnfinished.map((d) => d.id));
      const { data: updated } = await supabase
        .from('daily_wins')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(60);
      refreshedHistory = updated;
    } catch (err: unknown) {
      console.warn('[directionFetcher] Failed to mark past daily wins as partial:', err);
    }
  }

  return {
    historyData: refreshedHistory,
    reviewData,
    planReviewData,
    calData,
    prevReviewData,
    ouraData,
    runsData,
    nutritionData,
    nutritionTargetData,
    doneTasksData,
    projectsData,
    monthReviewData,
    monthFactsData,
    sprintReviewData,
    sprintFactsData,
    activeThemeReviewData,
    pastUnfinished,
  };
}
