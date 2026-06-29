/**
 * Goal spine — canonical read path for the goal hierarchy (background layer).
 *
 * Zoom: longTerm → sprint (12w) → week → day.
 * Week layers (intentional satellites, not merged):
 *   - weekly_reviews — reflection + week goals (Direction)
 *   - weekly_kpi_reviews — KPI numbers + brief (Growth WeeklyReview)
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
import type { Tables } from './database.types';

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
};

export type WeeklyKpiReview = Pick<
  Tables<'weekly_kpi_reviews'>,
  'week_start' | 'what_worked' | 'what_didnt_work' | 'ai_brief'
>;

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
  week: ResolvedWeekGoals;
  longTerm: LongTermGoals;
  kpiReview: WeeklyKpiReview | null;
  sprintReview: SprintReview | null;
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
  };
  kpi_review: {
    what_worked: string | null;
    what_didnt_work: string | null;
    has_ai_brief: boolean;
  } | null;
  sprint_review: {
    reflection: string | null;
    completed: boolean;
  } | null;
  long_term: {
    declarations: LifeGoalDeclarations | null;
    projects: { title: string; pillar: string; project_id: string | null; kpis: { name: string; current: number | null; target: number | null; unit?: string | null }[] }[];
  };
};

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
    },
    kpi_review: spine.kpiReview
      ? {
          what_worked: spine.kpiReview.what_worked,
          what_didnt_work: spine.kpiReview.what_didnt_work,
          has_ai_brief: spine.kpiReview.ai_brief != null,
        }
      : null,
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
    const { data, error: fbErr } = await supabase
      .from('weekly_reviews')
      .select(WEEK_GOAL_COLUMNS)
      .eq('user_id', userId)
      .neq('week_start', weekStart)
      .or('week_intention.not.is.null,week_goal_cialo.not.is.null,week_goal_duch.not.is.null,week_goal_konto.not.is.null')
      .order('week_start', { ascending: false })
      .limit(1)
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
    .select('goal_text')
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
  };
}

async function loadWeeklyKpiReview(userId: string, weekStart: string): Promise<WeeklyKpiReview | null> {
  const { data, error } = await supabase
    .from('weekly_kpi_reviews')
    .select('week_start, what_worked, what_didnt_work, ai_brief')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
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
  // Table may not exist until migration 20260629180000 is applied.
  if (error) {
    if (error.code === '42P01' || error.message?.includes('sprint_reviews')) return null;
    throw error;
  }
  return data;
}

async function loadLongTermGoals(userId: string): Promise<LongTermGoals> {
  const [projects, dreamsRes, kpisRes, lifeGoalsRes] = await Promise.all([
    listProjects(userId),
    supabase.from('dreams').select('id, life_goal').eq('user_id', userId),
    supabase
      .from('goal_kpis')
      .select('id, project_id, name, current_value, target, unit')
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

  const projectsDisplay = lifeGoalDisplayRowsFromProjects(
    (projects ?? []) as ProjectRow[],
    (dreamsRes.data ?? []) as DreamRow[],
    kpisRes.data ?? [],
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

export async function fetchWeeklyKpiReview(
  userId: string,
  weekStart: string,
): Promise<WeeklyKpiReview | null> {
  return withCache(spineKey('kpiReview', userId, weekStart), () => loadWeeklyKpiReview(userId, weekStart));
}

export async function fetchLatestWeeklyKpiWeekStart(userId: string): Promise<string | null> {
  return withCache(spineKey('kpiReviewLatestWeek', userId), async () => {
    const { data, error } = await supabase
      .from('weekly_kpi_reviews')
      .select('week_start')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.week_start ?? null;
  });
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

export async function fetchGoalSpine(
  userId: string,
  weekStart: string = currentWeekStart(),
): Promise<GoalSpine> {
  return withCache(spineKey('full', userId, weekStart), async () => {
    const [week, sprint, longTerm, kpiReview, sprintReview] = await Promise.all([
      fetchWeekGoals(userId, weekStart),
      fetchSprintContext(userId),
      fetchLongTermGoals(userId),
      fetchWeeklyKpiReview(userId, weekStart),
      fetchSprintReview(userId),
    ]);
    return { weekStart, sprint, week, longTerm, kpiReview, sprintReview };
  });
}

// ── Write path (invalidate cache after every mutation) ─────────────────────

export async function saveSprintGoal(userId: string, goalText: string): Promise<void> {
  const sprint = getSprintInfo();
  const { error } = await supabase.from('sprint_goals').upsert(
    {
      user_id: userId,
      personal_year: sprint.personalYear,
      sprint_number: sprint.sprintNumber,
      goal_text: goalText,
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

export async function saveWeeklyKpiReview(
  userId: string,
  weekStart: string,
  fields: { what_worked?: string | null; what_didnt_work?: string | null },
): Promise<void> {
  const { error } = await supabase.from('weekly_kpi_reviews').upsert(
    {
      user_id: userId,
      week_start: weekStart,
      what_worked: fields.what_worked ?? null,
      what_didnt_work: fields.what_didnt_work ?? null,
    },
    { onConflict: 'user_id,week_start' },
  );
  if (error) throw error;
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
  pillar_scores?: unknown;
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
  weekStart: string,
  fields: WeeklyPlanFields,
): Promise<WeeklyReviewRow | null> {
  const { data, error } = await supabase
    .from('weekly_reviews')
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        ...fields,
        review_completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,week_start' },
    )
    .select()
    .maybeSingle();
  if (error) throw error;
  invalidateGoalSpineCache(userId);
  return data;
}

