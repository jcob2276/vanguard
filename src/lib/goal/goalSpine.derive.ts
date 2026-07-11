import { getTodayWarsaw } from '../date';
import { getWeekStartWarsaw, shiftWeekStart } from '../growth/growth';
import { primaryBhagLine } from './longTermBridge';
import { calendarMonthStart, monthLabel } from '../growth/monthReview';
import type { WeekDirectionGoals } from '../growth/growthWeek';
import type {
  WeekReviewRow,
  ResolvedWeekGoals,
  SprintContext,
  GoalSpine,
  GoalSpineAiSnapshot,
  StrategicGaps,
} from './goalSpine.types';

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
