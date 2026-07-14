import { getSprintInfo } from '../growth/sprintUtils';
import { listProjects } from '../projects/projects';
import { getTodayWarsaw } from '../date';
import { isCurrentWeek } from '../growth/growth';
import { lifeGoalDisplayRowsFromProjects } from '../projects/lifeGoals';
import { supabase } from '../supabase';
import {
  calendarMonthStart,
  closingMonthStartForReview,
  isMonthlyReviewDue,
  monthLabel,
  monthThemeSourceStart,
} from '../growth/monthReview';
import type {
  MonthlyReviewRow,
  WeekReviewRow,
  ResolvedWeekGoals,
  SprintContext,
  MonthlySpineSlice,
  SprintReview,
  LongTermGoals,
  ProjectRow,
  DreamRow,
} from './goalSpine.types';
import { queryClient } from '../queryClient';
import { goalSpineKeys } from '../queryKeys';
import { weekGoalsFromReview, weekGoalsAreEmpty, resolveWeekGoals, previousWeekStart, isSprintClosingWeek } from './goalSpine.derive';

const WEEK_GOAL_COLUMNS =
  'week_start, week_intention, week_commitment, week_goal_cialo, week_goal_duch, week_goal_konto' as const;

async function loadWeekGoals(userId: string, weekStart: string): Promise<ResolvedWeekGoals> {
  const { data: currentRow, error } = await supabase
    .from('weekly_reviews')
    .select(WEEK_GOAL_COLUMNS)
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error) throw error;

  let fallbackRow: WeekReviewRow | null = null;
  const currentGoals = weekGoalsFromReview(currentRow);
  const needsFallback = weekGoalsAreEmpty(currentGoals) && isCurrentWeek(weekStart);

  if (needsFallback) {
    const prevStart = previousWeekStart(weekStart);
    const { data, error: fbErr } = await supabase
      .from('weekly_reviews')
      .select(WEEK_GOAL_COLUMNS)
      .eq('user_id', userId)
      .eq('week_start', prevStart)
      .maybeSingle();
    if (fbErr) throw fbErr;
    fallbackRow = data;
  }

  return resolveWeekGoals(weekStart, currentRow, fallbackRow);
}

async function loadSprintContext(userId: string): Promise<SprintContext> {
  const sprint = getSprintInfo();
  const { data, error } = await supabase
    .from('sprint_goals')
    .select('goal_text, focus_project_ids')
    .eq('user_id', userId)
    .eq('personal_year', sprint.personalYear)
    .eq('sprint_number', sprint.sprintNumber)
    .maybeSingle();

  if (error) throw error;

  return {
    ...sprint,
    goalText: data?.goal_text ?? null,
    label: `Sprint ${sprint.sprintNumber}`,
    isClosingWeek: isSprintClosingWeek(sprint),
    focusProjectIds: (data?.focus_project_ids ?? []).filter(Boolean),
  };
}

export async function loadMonthlySlice(
  userId: string,
  today?: string,
): Promise<MonthlySpineSlice> {
  const t = today ?? getTodayWarsaw();
  const closingMonthStart = closingMonthStartForReview(t);
  const currentMonthStart = calendarMonthStart(t);
  const themeSourceStart = monthThemeSourceStart(t);

  const [closingReview, themeReview] = await Promise.all([
    closingMonthStart ? fetchMonthlyReview(userId, closingMonthStart) : Promise.resolve(null),
    fetchMonthlyReview(userId, themeSourceStart),
  ]);

  const activeTheme = themeReview?.month_theme?.trim() || null;

  return {
    closingMonthStart,
    review: closingReview,
    due: closingMonthStart ? isMonthlyReviewDue(t, closingReview) : false,
    activeTheme,
    activeMonthLabel: monthLabel(currentMonthStart),
  };
}

async function loadMonthlyReview(userId: string, monthStart: string): Promise<MonthlyReviewRow | null> {
  const { data, error } = await supabase
    .from('monthly_reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('month_start', monthStart)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadSprintReview(userId: string): Promise<SprintReview | null> {
  const sprint = getSprintInfo();
  const { data, error } = await supabase
    .from('sprint_reviews')
    .select('personal_year, sprint_number, reflection, completed_at')
    .eq('user_id', userId)
    .eq('personal_year', sprint.personalYear)
    .eq('sprint_number', sprint.sprintNumber)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadLongTermGoals(userId: string): Promise<LongTermGoals> {
  const [projects, dreamsRes, kpisRes, lifeGoalsRes] = await Promise.all([
    listProjects(userId),
    supabase.from('dreams').select('id, life_goal').eq('user_id', userId),
    supabase
      .from('goal_kpis')
      .select('id, project_id, name, target, unit')
      .eq('user_id', userId),
    supabase
      .from('life_goals')
      .select('goal_cialo, goal_duch, goal_konto, date_cialo, date_duch, date_konto, bhag_pillar')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (dreamsRes.error) throw dreamsRes.error;
  if (kpisRes.error) throw kpisRes.error;
  if (lifeGoalsRes.error) throw lifeGoalsRes.error;

  const latestKpiValues = await fetchLatestKpiValues(userId, (kpisRes.data ?? []).map((k) => k.id));
  const kpisWithCurrent = (kpisRes.data ?? []).map((k) => ({
    ...k,
    current_value: latestKpiValues.get(k.id) ?? null,
  }));

  const projectsDisplay = lifeGoalDisplayRowsFromProjects(
    (projects ?? []) as ProjectRow[],
    (dreamsRes.data ?? []) as DreamRow[],
    kpisWithCurrent,
  );

  return {
    declarations: lifeGoalsRes.data ?? null,
    projects: projectsDisplay,
  };
}

export async function fetchWeekGoals(
  userId: string,
  weekStart: string,
): Promise<ResolvedWeekGoals> {
  return queryClient.fetchQuery({
    queryKey: goalSpineKeys.week(userId, weekStart),
    queryFn: () => loadWeekGoals(userId, weekStart),
  });
}

export async function fetchSprintContext(userId: string): Promise<SprintContext> {
  return queryClient.fetchQuery({
    queryKey: goalSpineKeys.sprint(userId),
    queryFn: () => loadSprintContext(userId),
  });
}

export async function fetchLongTermGoals(userId: string): Promise<LongTermGoals> {
  return queryClient.fetchQuery({
    queryKey: goalSpineKeys.longTerm(userId),
    queryFn: () => loadLongTermGoals(userId),
  });
}

export async function fetchSprintReview(userId: string): Promise<SprintReview | null> {
  const sprint = getSprintInfo();
  return queryClient.fetchQuery({
    queryKey: goalSpineKeys.sprintReview(userId, sprint.personalYear, sprint.sprintNumber),
    queryFn: () => loadSprintReview(userId),
  });
}

export async function fetchMonthlyReview(
  userId: string,
  monthStart: string,
): Promise<MonthlyReviewRow | null> {
  return queryClient.fetchQuery({
    queryKey: goalSpineKeys.monthReview(userId, monthStart),
    queryFn: () => loadMonthlyReview(userId, monthStart),
  });
}

export async function fetchLatestKpiValues(
  userId: string,
  kpiIds: string[],
): Promise<Map<string, number | null>> {
  if (kpiIds.length === 0) return new Map();
  const sortedIds = kpiIds.slice().sort();
  return queryClient.fetchQuery({
    queryKey: goalSpineKeys.latestKpiValues(userId, sortedIds),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_entries')
        .select('kpi_id, week_start, value')
        .eq('user_id', userId)
        .in('kpi_id', kpiIds)
        .order('week_start', { ascending: false });
      if (error) throw error;
      const map = new Map<string, number | null>();
      for (const row of data ?? []) {
        if (!map.has(row.kpi_id)) map.set(row.kpi_id, row.value);
      }
      return map;
    },
  });
}
