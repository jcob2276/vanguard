import { getSprintInfo } from '../components/desktop/desktopUtils';
import { supabase } from './supabase';
import type {
  WeeklyReviewRow,
  WeeklyPlanFields,
  WeeklyReflectionFields,
  CompleteWeeklyReviewOptions,
  GoalKpiRow,
  RollupDecision,
  MonthlyReviewFields,
  MonthlyReviewRow,
  DailyWinRow,
  DailyWinUpdate,
  DailyWinInsert,
  SprintProjectDecision,
  LifeGoalDeclarations,
} from './goalSpine.types';
import { invalidateGoalSpineCache } from './goalSpine.cache';
import { currentWeekStart } from './goalSpine.queries';
import type { Json } from './database.types';

async function saveSprintGoal(
  userId: string,
  goalText: string,
  opts?: { personalYear?: number; sprintNumber?: number; focusProjectIds?: string[] },
): Promise<void> {
  const sprint = getSprintInfo();
  const personalYear = opts?.personalYear ?? sprint.personalYear;
  const sprintNumber = opts?.sprintNumber ?? sprint.sprintNumber;
  const { error } = await supabase.from('sprint_goals').upsert(
    {
      user_id: userId,
      personal_year: personalYear,
      sprint_number: sprintNumber,
      goal_text: goalText,
      focus_project_ids: opts?.focusProjectIds ?? [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,personal_year,sprint_number' },
  );
  if (error) throw error;
  invalidateGoalSpineCache(userId);
}

/** Canonical write path for the one-row-per-user yearly BHAG declarations (life_goals). */
export async function saveLifeGoalDeclarations(
  userId: string,
  fields: LifeGoalDeclarations,
): Promise<void> {
  const { error } = await supabase.from('life_goals').upsert(
    { user_id: userId, ...fields },
    { onConflict: 'user_id' },
  );
  if (error) throw new Error(error.message);
  invalidateGoalSpineCache(userId);
}

async function saveSprintReview(
  userId: string,
  reflection: string,
  opts?: { complete?: boolean },
): Promise<void> {
  const sprint = getSprintInfo();
  const { error } = await supabase.from('sprint_reviews').upsert(
    {
      user_id: userId,
      personal_year: sprint.personalYear,
      sprint_number: sprint.sprintNumber,
      reflection: reflection.trim() || null,
      completed_at: opts?.complete ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,personal_year,sprint_number' },
  );
  if (error) throw error;
  invalidateGoalSpineCache(userId);
}

export async function completeSprintClose(
  userId: string,
  opts: {
    reflection?: string | null;
    nextSprintGoal: string;
    projectDecisions?: Record<string, SprintProjectDecision>;
  },
): Promise<void> {
  const sprint = getSprintInfo();
  await saveSprintReview(userId, opts.reflection?.trim() ?? '', { complete: true });
  const continuingIds = opts.projectDecisions
    ? Object.entries(opts.projectDecisions)
        .filter(([, d]) => d === 'continue')
        .map(([id]) => id)
    : [];
  await saveSprintGoal(userId, opts.nextSprintGoal.trim(), {
    personalYear: sprint.personalYear,
    sprintNumber: sprint.sprintNumber + 1,
    focusProjectIds: continuingIds,
  });

  if (opts.projectDecisions) {
    const deferIds = Object.entries(opts.projectDecisions)
      .filter(([, d]) => d === 'defer')
      .map(([id]) => id);
    if (deferIds.length > 0) {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'paused' })
        .eq('user_id', userId)
        .in('id', deferIds);
      if (error) throw error;
    }
  }
  invalidateGoalSpineCache(userId);
}

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

export async function addProjectKpi(
  userId: string,
  projectId: string,
  pillar: string,
  fields: { name: string; unit: string; target?: number | null },
): Promise<GoalKpiRow> {
  const { data, error } = await supabase
    .from('goal_kpis')
    .insert({
      user_id: userId,
      project_id: projectId,
      pillar,
      name: fields.name.trim(),
      unit: fields.unit.trim(),
      target: fields.target ?? null,
      higher_is_better: true,
    })
    .select()
    .single();
  if (error) throw error;
  invalidateGoalSpineCache(userId);
  return data;
}

export async function setProjectKpiTarget(userId: string, kpiId: string, target: number | null): Promise<void> {
  const { error } = await supabase.from('goal_kpis').update({ target }).eq('id', kpiId);
  if (error) throw error;
  invalidateGoalSpineCache(userId);
}

/** Pure decision: does this daily task completion roll up into a project KPI? */
export function rollupTaskCompletion(
  targetValue: string | null | undefined,
  projectKpis: GoalKpiRow[] | null | undefined,
  sign: 1 | -1,
  preferredKpiId?: string | null,
): RollupDecision {
  const trimmed = targetValue?.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) return null;
  if (!projectKpis?.length) return null;

  const picked = pickRollupKpi(projectKpis, preferredKpiId);
  if (!picked) return null;

  const amount = parseFloat(trimmed);
  if (!Number.isFinite(amount) || amount === 0) return null;
  return { kpiId: picked.id, delta: amount * sign };
}

function pickRollupKpi(
  kpis: GoalKpiRow[],
  preferredKpiId?: string | null,
): GoalKpiRow | null {
  if (!kpis.length) return null;
  if (preferredKpiId) {
    const hit = kpis.find((k) => k.id === preferredKpiId);
    if (hit) return hit;
  }
  if (kpis.length === 1) return kpis[0];
  const scored = kpis
    .filter((k) => k.target != null && Number.isFinite(k.target) && k.target > 0)
    .sort((a, b) => (b.target ?? 0) - (a.target ?? 0));
  return scored[0] ?? kpis[0];
}

export async function applyKpiRollup(
  userId: string,
  kpiId: string,
  weekStart: string,
  delta: number,
): Promise<void> {
  const { error } = await supabase.rpc('increment_kpi_entry_for_week', {
    p_kpi_id: kpiId,
    p_week_start: weekStart,
    p_delta: delta,
  });
  if (error) throw error;
  invalidateGoalSpineCache(userId);
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
