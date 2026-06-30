/**
 * Goal spine — canonical read path for the goal hierarchy (background layer).
 *
 * Zoom: longTerm → sprint (12w) → month → week → day.
 * Week layers (intentional satellites, not merged):
 *   - monthly_reviews — month reflection (Direction, first Sundays)
 *   - weekly_reviews — reflection + week goals (Direction)
 * All reads go through here; writes call invalidateGoalSpineCache().
 */
import { getSprintInfo } from '../components/desktop/desktopUtils';
import { listProjects } from './projects';
import { getTodayWarsaw } from './date';
import { getWeekStartWarsaw, isCurrentWeek, shiftWeekStart } from './growth';
import {
  lifeGoalDisplayRowsFromProjects,
  type LifeGoalDisplayRow,
} from './lifeGoals';
import type { WeekDirectionGoals } from './growthWeek';
import { supabase } from './supabase';
import type { Json, Tables } from './database.types';
import type { MonthlyReviewFields, MonthlyReviewRow } from './monthReview';
import type { SprintProjectDecision } from './sprintReview';
import { primaryBhagLine } from './longTermBridge';
import {
  calendarMonthStart,
  closingMonthStartForReview,
  isMonthlyReviewDue,
  monthLabel,
  monthThemeSourceStart,
} from './monthReview';

export type { MonthlyReviewRow, MonthlyReviewFields } from './monthReview';
export { closingMonthStartForReview, isMonthlyReviewDue, gatherMonthFacts, monthLabel, isMonthlyHardGate, isMonthlySoftCue } from './monthReview';
export type { MonthFacts } from './monthReview';

const CACHE_TTL_MS = 30_000;

const WEEK_GOAL_COLUMNS =
  'week_start, week_intention, week_commitment, week_goal_cialo, week_goal_duch, week_goal_konto' as const;

type WeekReviewRow = Pick<
  Tables<'weekly_reviews'>,
  'week_start' | 'week_intention' | 'week_commitment' | 'week_goal_cialo' | 'week_goal_duch' | 'week_goal_konto'
>;

export type WeeklyReviewRow = Tables<'weekly_reviews'>;

type LifeGoalDeclarations = Pick<
  Tables<'life_goals'>,
  | 'goal_cialo'
  | 'goal_duch'
  | 'goal_konto'
  | 'date_cialo'
  | 'date_duch'
  | 'date_konto'
  | 'bhag_pillar'
>;

export type SprintContext = ReturnType<typeof getSprintInfo> & {
  goalText: string | null;
  label: string;
  isClosingWeek: boolean;
  /** Active projects chosen at prior sprint close. */
  focusProjectIds: string[];
};

export type SprintReview = Pick<
  Tables<'sprint_reviews'>,
  'personal_year' | 'sprint_number' | 'reflection' | 'completed_at'
>;

export type ResolvedWeekGoals = WeekDirectionGoals & {
  weekStart: string;
  source: 'week' | 'fallback' | 'empty';
  fallbackWeekStart: string | null;
};

export type LongTermGoals = {
  declarations: LifeGoalDeclarations | null;
  projects: LifeGoalDisplayRow[];
};

export type GoalSpine = {
  weekStart: string;
  sprint: SprintContext;
  month: MonthlySpineSlice;
  week: ResolvedWeekGoals;
  longTerm: LongTermGoals;
  sprintReview: SprintReview | null;
};

export type MonthlySpineSlice = {
  closingMonthStart: string | null;
  review: MonthlyReviewRow | null;
  due: boolean;
  /** Theme for the live calendar month (from prior month's review). */
  activeTheme: string | null;
  activeMonthLabel: string | null;
};

export type WeeklyReviewBundle = {
  current: WeeklyReviewRow | null;
  previous: WeeklyReviewRow | null;
  latest: WeeklyReviewRow | null;
};

export type StrategicGaps = {
  projects_without_kpi: string[];
  pillars_with_declaration_no_active_project: Array<'cialo' | 'duch' | 'konto'>;
  dreams_without_active_project: string[];
};

export type GoalSpineAiSnapshot = {
  week_start: string;
  week_goals: WeekDirectionGoals;
  week_source: ResolvedWeekGoals['source'];
  fallback_week_start: string | null;
  sprint: {
    label: string;
    goal: string | null;
    number: number;
    personal_year: number;
    week_in_sprint: number;
    pct: number;
    is_closing_week: boolean;
    review_completed: boolean;
    focus_project_ids: string[];
  };
  sprint_review: {
    reflection: string | null;
    completed: boolean;
  } | null;
  long_term: {
    declarations: LifeGoalDeclarations | null;
    projects: { title: string; pillar: string; project_id: string | null; kpis: { name: string; current: number | null; target: number | null; unit?: string | null }[] }[];
  };
  month: {
    label: string;
    theme: string | null;
    review_due: boolean;
  };
  long_term_bhag: string | null;
};

export function formatSprintWeekBridge(
  sprintGoal: string | null | undefined,
  weekStep: string | null | undefined,
): string | null {
  const goal = sprintGoal?.trim();
  if (!goal) return null;
  const step = weekStep?.trim() || '—';
  return `Sprint: ${goal} — ten tydzień jeden krok: ${step}`;
}

type ProjectRow = Pick<
  Tables<'projects'>,
  'id' | 'name' | 'goal' | 'deadline' | 'color' | 'dream_id' | 'status'
>;
type DreamRow = Pick<Tables<'dreams'>, 'id' | 'life_goal'>;

type CacheEntry<T> = {
  data?: T;
  ts: number;
  inflight?: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();
const invalidateListeners = new Set<() => void>();

function spineKey(...parts: string[]) {
  return parts.join(':');
}

async function withCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (entry?.data !== undefined && now - entry.ts < CACHE_TTL_MS) {
    return entry.data;
  }
  if (entry?.inflight) {
    return entry.inflight;
  }

  const inflight = fetcher()
    .then((data) => {
      cache.set(key, { data, ts: Date.now() });
      return data;
    })
    .catch((err) => {
      cache.delete(key);
      throw err;
    });

  cache.set(key, { ...(entry ?? {}), inflight, ts: entry?.ts ?? 0 });
  return inflight;
}

/** Drop cached reads after writes (weekly review, sprint goal, life_goals, projects). */
export function invalidateGoalSpineCache(userId?: string): void {
  if (!userId) {
    cache.clear();
  } else {
    for (const key of [...cache.keys()]) {
      if (key.includes(userId)) cache.delete(key);
    }
  }
  invalidateListeners.forEach((fn) => fn());
}

export function onGoalSpineInvalidated(listener: () => void): () => void {
  invalidateListeners.add(listener);
  return () => invalidateListeners.delete(listener);
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

export async function fetchWeekGoals(
  userId: string,
  weekStart: string,
): Promise<ResolvedWeekGoals> {
  return withCache(spineKey('week', userId, weekStart), () => loadWeekGoals(userId, weekStart));
}

export async function fetchSprintContext(userId: string): Promise<SprintContext> {
  return withCache(spineKey('sprint', userId), () => loadSprintContext(userId));
}

export async function fetchLongTermGoals(userId: string): Promise<LongTermGoals> {
  return withCache(spineKey('longTerm', userId), () => loadLongTermGoals(userId));
}

export async function fetchSprintReview(userId: string): Promise<SprintReview | null> {
  const sprint = getSprintInfo();
  return withCache(
    spineKey('sprintReview', userId, String(sprint.personalYear), String(sprint.sprintNumber)),
    () => loadSprintReview(userId),
  );
}

export async function fetchWeeklyReviewFull(
  userId: string,
  weekStart: string,
): Promise<WeeklyReviewRow | null> {
  return withCache(spineKey('review', userId, weekStart), async () => {
    const { data, error } = await supabase
      .from('weekly_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .maybeSingle();
    if (error) throw error;
    return data;
  });
}

export async function fetchLatestCompletedWeeklyReviewDate(userId: string): Promise<string | null> {
  return withCache(spineKey('reviewLatestCompletedDate', userId), async () => {
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
  });
}

export async function fetchLatestWeeklyReview(userId: string): Promise<WeeklyReviewRow | null> {
  return withCache(spineKey('reviewLatest', userId), async () => {
    const { data, error } = await supabase
      .from('weekly_reviews')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  });
}

export async function fetchWeeklyReviewBundle(
  userId: string,
  currentWeekStart: string,
  previousWeekStart: string,
): Promise<WeeklyReviewBundle> {
  return withCache(
    spineKey('reviewBundle', userId, currentWeekStart, previousWeekStart),
    async () => {
      const [current, previous, latest] = await Promise.all([
        fetchWeeklyReviewFull(userId, currentWeekStart),
        fetchWeeklyReviewFull(userId, previousWeekStart),
        fetchLatestWeeklyReview(userId),
      ]);
      return { current, previous, latest };
    },
  );
}

export async function fetchMonthlyReview(
  userId: string,
  monthStart: string,
): Promise<MonthlyReviewRow | null> {
  return withCache(spineKey('monthReview', userId, monthStart), () => loadMonthlyReview(userId, monthStart));
}

export async function fetchGoalSpine(
  userId: string,
  weekStart: string = currentWeekStart(),
  today?: string,
): Promise<GoalSpine> {
  return withCache(spineKey('full', userId, weekStart, today ?? getTodayWarsaw()), async () => {
    const [week, sprint, longTerm, sprintReview, month] = await Promise.all([
      fetchWeekGoals(userId, weekStart),
      fetchSprintContext(userId),
      fetchLongTermGoals(userId),
      fetchSprintReview(userId),
      loadMonthlySlice(userId, today),
    ]);
    return { weekStart, sprint, month, week, longTerm, sprintReview };
  });
}

// ── Write path (invalidate cache after every mutation) ─────────────────────

export async function saveSprintGoal(
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

export async function saveSprintReview(
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

export type { SprintFacts, SprintProjectDecision } from './sprintReview';
export { gatherSprintFacts, weekStartsInSprint } from './sprintReview';

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


export type WeeklyReflectionFields = {
  proud_of?: string | null;
  do_differently?: string | null;
  sabotage?: string | null;
  obligation?: string | null;
  week_highlight?: string | null;
  week_regret?: string | null;
  new_belief?: string | null;
  pillar_scores?: Json;
  bottleneck?: string | null;
};

export type WeeklyPlanFields = {
  week_intention?: string | null;
  week_commitment?: string | null;
  week_goal_cialo?: string | null;
  week_goal_duch?: string | null;
  week_goal_konto?: string | null;
  deepening_answers?: Record<string, string> | null;
};

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

// ── Project KPIs (week rollup) ──────────────────────────────────────────────

export type GoalKpiRow = Tables<'goal_kpis'>;

export type ProjectWeekKpi = {
  kpi: GoalKpiRow;
  thisWeekValue: number | null;
};

export async function fetchProjectWeekKpis(
  userId: string,
  projectIds: string[],
  weekStart: string,
): Promise<Record<string, ProjectWeekKpi[]>> {
  if (projectIds.length === 0) return {};
  return withCache(
    spineKey('projectKpis', userId, weekStart, projectIds.slice().sort().join(',')),
    async () => {
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
  );
}

export async function fetchKpisForProject(userId: string, projectId: string): Promise<GoalKpiRow[]> {
  return withCache(spineKey('projectKpisFor', userId, projectId), async () => {
    const { data, error } = await supabase
      .from('goal_kpis')
      .select('*')
      .eq('user_id', userId)
      .eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []) as GoalKpiRow[];
  });
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

export type RollupDecision = { kpiId: string; delta: number } | null;

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

/** Single source of truth for "current" KPI value: most recent kpi_entries row
 *  per kpi_id (this week's if logged, else the latest prior week's). Replaces
 *  the old goal_kpis.current_value column (dropped — was a disconnected,
 *  never-synced duplicate of this same data). */
export async function fetchLatestKpiValues(
  userId: string,
  kpiIds: string[],
): Promise<Map<string, number | null>> {
  if (kpiIds.length === 0) return new Map();
  return withCache(
    spineKey('latestKpiValues', userId, kpiIds.slice().sort().join(',')),
    async () => {
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
  );
}

/** Manual edit (e.g. typing a new weight in Projects) — overwrites this week's
 *  value. Distinct verb from applyKpiRollup (additive, daily-task rollup) over
 *  the same table — not a duplicate, just SET vs INCREMENT on one source. */
export async function setKpiValueForWeek(
  userId: string,
  kpiId: string,
  weekStart: string,
  value: number,
): Promise<void> {
  const { error } = await supabase.from('kpi_entries').upsert(
    { user_id: userId, kpi_id: kpiId, week_start: weekStart, value },
    { onConflict: 'kpi_id,week_start' },
  );
  if (error) throw error;
  invalidateGoalSpineCache(userId);
}

export type CompleteWeeklyReviewOptions = {
  /** Sunday ritual: plan fields go on the upcoming week, reflection stays on closing week. */
  planWeekStart?: string | null;
};

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

export async function saveMonthlyReviewDraft(
  userId: string,
  monthStart: string,
  fields: MonthlyReviewFields,
  today?: string,
): Promise<MonthlyReviewRow | null> {
  const closing = closingMonthStartForReview(today ?? getTodayWarsaw());
  if (closing && monthStart !== closing) {
    throw new Error(`Monthly review only writable for closing month: ${closing}`);
  }
  const { data, error } = await supabase
    .from('monthly_reviews')
    .upsert(
      { user_id: userId, month_start: monthStart, ...fields, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,month_start' },
    )
    .select()
    .maybeSingle();
  if (error) throw error;
  invalidateGoalSpineCache(userId);
  return data;
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

