import { supabase } from '../supabase';
import type {
  WeeklyReviewRow,
  WeeklyPlanFields,
  WeeklyReflectionFields,
  CompleteWeeklyReviewOptions,
  MonthlyReviewFields,
  MonthlyReviewRow,
  DailyWinRow,
  DailyWinUpdate,
  DailyWinInsert,
} from './goalSpine.types';
import { invalidateGoalSpineCache } from './goalSpine.queries';
import { currentWeekStart } from './goalSpine.queries';
import type { Json } from '../database.types';

export * from './goalSpineSprint.mutations';
export * from './goalSpineKpi.mutations';

export async function saveWeeklyReviewReflection(
  userId: string,
  weekStart: string,
  fields: WeeklyReflectionFields,
): Promise<WeeklyReviewRow | null> {
  if (weekStart > currentWeekStart()) {
    throw new Error(`Cannot save weekly reflection for a future week: ${weekStart}`);
  }
  const { data, error } = await supabase
    .from('weekly_reviews')
    .upsert({ user_id: userId, week_start: weekStart, ...fields }, { onConflict: 'user_id,week_start' })
    .select()
    .maybeSingle();
  if (error) throw error;
  invalidateGoalSpineCache(userId);
  return data;
}

export async function completeWeeklyReview(
  userId: string,
  closingWeekStart: string,
  fields: WeeklyPlanFields,
  options?: CompleteWeeklyReviewOptions,
): Promise<WeeklyReviewRow | null> {
  const completedAt = new Date().toISOString();
  const planWeekStart = options?.planWeekStart ?? closingWeekStart;
  const planFields = {
    week_intention: fields.week_intention ?? null,
    week_commitment: fields.week_commitment ?? null,
    week_goal_cialo: fields.week_goal_cialo ?? null,
    week_goal_duch: fields.week_goal_duch ?? null,
    week_goal_konto: fields.week_goal_konto ?? null,
  };

  if (planWeekStart === closingWeekStart) {
    const { data, error } = await supabase
      .from('weekly_reviews')
      .upsert(
        {
          user_id: userId,
          week_start: closingWeekStart,
          ...planFields,
          deepening_answers: fields.deepening_answers ?? null,
          review_completed_at: completedAt,
        },
        { onConflict: 'user_id,week_start' },
      )
      .select()
      .maybeSingle();
    if (error) throw error;
    invalidateGoalSpineCache(userId);
    return data;
  }

  const [closingRes, planRes] = await Promise.all([
    supabase
      .from('weekly_reviews')
      .upsert(
        {
          user_id: userId,
          week_start: closingWeekStart,
          deepening_answers: fields.deepening_answers ?? null,
          review_completed_at: completedAt,
        },
        { onConflict: 'user_id,week_start' },
      )
      .select()
      .maybeSingle(),
    supabase
      .from('weekly_reviews')
      .upsert(
        { user_id: userId, week_start: planWeekStart, ...planFields },
        { onConflict: 'user_id,week_start' },
      )
      .select()
      .maybeSingle(),
  ]);

  if (closingRes.error) throw closingRes.error;
  if (planRes.error) throw planRes.error;
  invalidateGoalSpineCache(userId);
  return closingRes.data;
}

export async function completeMonthlyReview(
  userId: string,
  monthStart: string,
  fields: MonthlyReviewFields,
  ritualStats?: Json | null,
): Promise<MonthlyReviewRow | null> {
  const completedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('monthly_reviews')
    .upsert(
      {
        user_id: userId,
        month_start: monthStart,
        ...fields,
        ritual_stats: ritualStats ?? fields.ritual_stats ?? null,
        completed_at: completedAt,
        updated_at: completedAt,
      },
      { onConflict: 'user_id,month_start' },
    )
    .select()
    .maybeSingle();
  if (error) throw error;
  invalidateGoalSpineCache(userId);
  return data;
}

/** Canonical write path for daily_wins — invalidates spine cache for SpineGuideStrip / dashboard. */
export async function updateDailyWin(
  userId: string,
  id: string,
  patch: DailyWinUpdate,
): Promise<DailyWinRow> {
  const { data, error } = await supabase
    .from('daily_wins')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  invalidateGoalSpineCache(userId);
  return data;
}

export async function insertDailyWin(
  userId: string,
  entry: DailyWinInsert,
): Promise<DailyWinRow> {
  const { data, error } = await supabase
    .from('daily_wins')
    .upsert({ ...entry, user_id: userId }, { onConflict: 'user_id,date' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  invalidateGoalSpineCache(userId);
  return data;
}

/** Auto-mark past unfinished days as partial (result = P). */
export async function markDailyWinsPartial(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('daily_wins').update({ result: 'P' }).in('id', ids);
  if (error) throw new Error(error.message);
  invalidateGoalSpineCache(userId);
}
