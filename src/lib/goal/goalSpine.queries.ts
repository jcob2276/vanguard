import { getSprintInfo } from '../growth/sprintUtils';
import { listProjects } from '../projects/projects';
import { getTodayWarsaw } from '../date';
import { getWeekStartWarsaw, isCurrentWeek, shiftWeekStart } from '../growth/growth';
import {
  lifeGoalDisplayRowsFromProjects,
} from '../projects/lifeGoals';
import { supabase } from '../supabase';
import { primaryBhagLine } from './longTermBridge';
import {
  calendarMonthStart,
  closingMonthStartForReview,
  isMonthlyReviewDue,
  monthLabel,
  monthThemeSourceStart,
} from '../growth/monthReview';
import type { WeekDirectionGoals } from '../growth/growthWeek';
import type {
  MonthlyReviewRow,
  WeekReviewRow,
  WeeklyReviewRow,
  ResolvedWeekGoals,
  SprintContext,
  MonthlySpineSlice,
  SprintReview,
  LongTermGoals,
  GoalSpine,
  GoalSpineAiSnapshot,
  StrategicGaps,
  ProjectRow,
  DreamRow,
  GoalKpiRow,
  ProjectWeekKpi,
} from './goalSpine.types';
import { queryClient } from '../queryClient';

const WEEK_GOAL_COLUMNS =
  'week_start, week_intention, week_commitment, week_goal_cialo, week_goal_duch, week_goal_konto' as const;

export function formatSprintWeekBridge(
  sprintGoal: string | null | undefined,
  weekStep: string | null | undefined,
): string | null {
  const goal = sprintGoal?.trim();
  if (!goal) return null;
  const step = weekStep?.trim() || '—';
  return `Sprint: ${goal} — ten tydzień jeden krok: ${step}`;
}

export function weekGoalsFromReview(row: WeekReviewRow | null | undefined): WeekDirectionGoals {
  return {
    intention: row?.week_intention ?? null,
    commitment: row?.week_commitment ?? null,
    cialo: row?.week_goal_cialo ?? null,
    duch: row?.week_goal_duch ?? null,
    konto: row?.week_goal_konto ?? null,
  };
}

export function weekGoalsAreEmpty(goals: WeekDirectionGoals): boolean {
  return !(
    goals.intention?.trim() ||
    goals.commitment?.trim() ||
    goals.cialo?.trim() ||
    goals.duch?.trim() ||
    goals.konto?.trim()
  );
}

export function resolveWeekGoals(
  weekStart: string,
  currentRow: WeekReviewRow | null | undefined,
  fallbackRow: WeekReviewRow | null | undefined,
): ResolvedWeekGoals {
  const fromCurrent = weekGoalsFromReview(currentRow);
  if (!weekGoalsAreEmpty(fromCurrent)) {
    return {
      ...fromCurrent,
      weekStart,
      source: 'week',
      fallbackWeekStart: null,
    };
  }
  if (fallbackRow) {
    return {
      ...weekGoalsFromReview(fallbackRow),
      weekStart,
      source: 'fallback',
      fallbackWeekStart: fallbackRow.week_start ?? null,
    };
  }
  return {
    ...fromCurrent,
    weekStart,
    source: 'empty',
    fallbackWeekStart: null,
  };
}

export function currentWeekStart(): string {
  return getWeekStartWarsaw(getTodayWarsaw());
}

export function previousWeekStart(fromWeekStart?: string): string {
  const base = fromWeekStart ?? currentWeekStart();
  return shiftWeekStart(base, -1);
}

export function nextWeekStart(fromWeekStart?: string): string {
  const base = fromWeekStart ?? currentWeekStart();
  return shiftWeekStart(base, 1);
}

export function isSprintClosingWeek(sprint: Pick<SprintContext, 'weekInSprint'>): boolean {
  return sprint.weekInSprint === 12;
}

export function goalSpineAiSnapshot(spine: GoalSpine): GoalSpineAiSnapshot {
  return {
    week_start: spine.weekStart,
    week_goals: {
      intention: spine.week.intention,
      commitment: spine.week.commitment,
      cialo: spine.week.cialo,
      duch: spine.week.duch,
      konto: spine.week.konto,
    },
    week_source: spine.week.source,
    fallback_week_start: spine.week.fallbackWeekStart,
    sprint: {
      label: spine.sprint.label,
      goal: spine.sprint.goalText,
      number: spine.sprint.sprintNumber,
      personal_year: spine.sprint.personalYear,
      week_in_sprint: spine.sprint.weekInSprint,
      pct: spine.sprint.pct,
      is_closing_week: spine.sprint.isClosingWeek,
      review_completed: Boolean(spine.sprintReview?.completed_at),
      focus_project_ids: spine.sprint.focusProjectIds,
    },
    sprint_review: spine.sprintReview
      ? {
          reflection: spine.sprintReview.reflection,
          completed: Boolean(spine.sprintReview.completed_at),
        }
      : null,
    long_term: {
      declarations: spine.longTerm.declarations,
      projects: spine.longTerm.projects.map((p) => ({
        title: p.title,
        pillar: p.id,
        project_id: p.projectId ?? null,
        kpis: (p.kpis ?? []).map((k) => ({
          name: k.name,
          current: k.current,
          target: k.target,
          unit: k.unit ?? null,
        })),
      })),
    },
    month: {
      label: spine.month.activeMonthLabel ?? monthLabel(calendarMonthStart()),
      theme: spine.month.activeTheme,
      review_due: spine.month.due,
    },
    long_term_bhag: primaryBhagLine(spine.longTerm),
  };
}

export function strategicGapsFromSpine(
  spine: GoalSpine,
  openDreams: { id: string; title: string }[] = [],
  activeProjectDreamIds: Set<string> = new Set(),
): StrategicGaps {
  const projectRows = spine.longTerm.projects.filter((p) => p.projectId);
  const projectsWithoutKpi = projectRows
    .filter((p) => !p.kpis?.length)
    .map((p) => p.title);

  const pillars: Array<'cialo' | 'duch' | 'konto'> = ['cialo', 'duch', 'konto'];
  const pillarsWithDeclNoProject = pillars.filter((pillar) => {
    const decl = spine.longTerm.declarations?.[`goal_${pillar}`]?.trim();
    if (!decl) return false;
    return !projectRows.some((p) => p.id === pillar);
  });

  const dreamsWithoutActiveProject = openDreams
    .filter((d) => !activeProjectDreamIds.has(d.id))
    .map((d) => d.title);

  return {
    projects_without_kpi: projectsWithoutKpi,
    pillars_with_declaration_no_active_project: pillarsWithDeclNoProject,
    dreams_without_active_project: dreamsWithoutActiveProject,
  };
}

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

async function loadMonthlySlice(userId: string, today?: string): Promise<MonthlySpineSlice> {
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

async function fetchWeekGoals(
  userId: string,
  weekStart: string,
): Promise<ResolvedWeekGoals> {
  return queryClient.fetchQuery({
    queryKey: ['goalSpine', userId, 'week', weekStart],
    queryFn: () => loadWeekGoals(userId, weekStart),
  });
}

export async function fetchSprintContext(userId: string): Promise<SprintContext> {
  return queryClient.fetchQuery({
    queryKey: ['goalSpine', userId, 'sprint'],
    queryFn: () => loadSprintContext(userId),
  });
}

export async function fetchLongTermGoals(userId: string): Promise<LongTermGoals> {
  return queryClient.fetchQuery({
    queryKey: ['goalSpine', userId, 'longTerm'],
    queryFn: () => loadLongTermGoals(userId),
  });
}

export async function fetchSprintReview(userId: string): Promise<SprintReview | null> {
  const sprint = getSprintInfo();
  return queryClient.fetchQuery({
    queryKey: ['goalSpine', userId, 'sprintReview', sprint.personalYear, sprint.sprintNumber],
    queryFn: () => loadSprintReview(userId),
  });
}

export async function fetchWeeklyReviewFull(
  userId: string,
  weekStart: string,
): Promise<WeeklyReviewRow | null> {
  return queryClient.fetchQuery({
    queryKey: ['goalSpine', userId, 'review', weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('week_start', weekStart)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export async function fetchLatestCompletedWeeklyReviewDate(userId: string): Promise<string | null> {
  return queryClient.fetchQuery({
    queryKey: ['goalSpine', userId, 'reviewLatestCompletedDate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_reviews')
        .select('review_completed_at')
        .eq('user_id', userId)
        .not('review_completed_at', 'is', null)
        .order('review_completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.review_completed_at ?? null;
    },
  });
}

export async function fetchMonthlyReview(
  userId: string,
  monthStart: string,
): Promise<MonthlyReviewRow | null> {
  return queryClient.fetchQuery({
    queryKey: ['goalSpine', userId, 'monthReview', monthStart],
    queryFn: () => loadMonthlyReview(userId, monthStart),
  });
}

export async function fetchGoalSpine(
  userId: string,
  weekStart: string = currentWeekStart(),
  today?: string,
): Promise<GoalSpine> {
  const currentToday = today ?? getTodayWarsaw();
  return queryClient.fetchQuery({
    queryKey: ['goalSpine', userId, 'full', weekStart, currentToday],
    queryFn: async () => {
      const [week, sprint, longTerm, sprintReview, month] = await Promise.all([
        fetchWeekGoals(userId, weekStart),
        fetchSprintContext(userId),
        fetchLongTermGoals(userId),
        fetchSprintReview(userId),
        loadMonthlySlice(userId, today),
      ]);
      return { weekStart, sprint, month, week, longTerm, sprintReview };
    },
  });
}

export async function fetchProjectWeekKpis(
  userId: string,
  projectIds: string[],
  weekStart: string,
): Promise<Record<string, ProjectWeekKpi[]>> {
  if (projectIds.length === 0) return {};
  const sortedIds = projectIds.slice().sort().join(',');
  return queryClient.fetchQuery({
    queryKey: ['goalSpine', userId, 'projectKpis', weekStart, sortedIds],
    queryFn: async () => {
      const { data: kpis, error: kpiErr } = await supabase
        .from('goal_kpis')
        .select('*')
        .eq('user_id', userId)
        .in('project_id', projectIds);
      if (kpiErr) throw kpiErr;

      const kpiIds = (kpis ?? []).map((k) => k.id);
      let entries: { kpi_id: string; value: number | null }[] = [];
      if (kpiIds.length > 0) {
        const { data, error } = await supabase
          .from('kpi_entries')
          .select('kpi_id, value')
          .eq('user_id', userId)
          .eq('week_start', weekStart)
          .in('kpi_id', kpiIds);
        if (error) throw error;
        entries = data ?? [];
      }
      const valueByKpi = new Map(entries.map((e) => [e.kpi_id, e.value]));

      const byProject: Record<string, ProjectWeekKpi[]> = {};
      for (const kpi of (kpis ?? []) as GoalKpiRow[]) {
        if (!kpi.project_id) continue;
        (byProject[kpi.project_id] ??= []).push({ kpi, thisWeekValue: valueByKpi.get(kpi.id) ?? null });
      }
      return byProject;
    },
  });
}

export async function fetchKpisForProject(userId: string, projectId: string): Promise<GoalKpiRow[]> {
  return queryClient.fetchQuery({
    queryKey: ['goalSpine', userId, 'projectKpisFor', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goal_kpis')
        .select('*')
        .eq('user_id', userId)
        .eq('project_id', projectId);
      if (error) throw error;
      return (data ?? []) as GoalKpiRow[];
    },
  });
}

export async function fetchLatestKpiValues(
  userId: string,
  kpiIds: string[],
): Promise<Map<string, number | null>> {
  if (kpiIds.length === 0) return new Map();
  const sortedIds = kpiIds.slice().sort().join(',');
  return queryClient.fetchQuery({
    queryKey: ['goalSpine', userId, 'latestKpiValues', sortedIds],
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

const invalidateListeners = new Set<() => void>();

export function invalidateGoalSpineCache(userId: string): void {
  void queryClient.invalidateQueries({ queryKey: ['goalSpine', userId] });
  invalidateListeners.forEach((fn) => fn());
}

export function onGoalSpineInvalidated(listener: () => void): () => void {
  invalidateListeners.add(listener);
  return () => invalidateListeners.delete(listener);
}

