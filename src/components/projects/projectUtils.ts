export { PILLARS, type PillarId, PILLAR_META } from '../../lib/projects/pillars';
import type { Database } from '../../lib/database.types';
import type { TodoItemRow, TodoSectionRow } from '../../lib/todo/todo';

export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type GoalKpiRow = Database['public']['Tables']['goal_kpis']['Row'] & { current_value: number | null };

export const COLORS = [
  { id: 'indigo',  dot: 'bg-indigo-500',  bar: 'bg-indigo-500',  text: 'text-indigo-600 dark:text-indigo-400'  },
  { id: 'violet',  dot: 'bg-violet-500',  bar: 'bg-violet-500',  text: 'text-violet-600 dark:text-violet-400'  },
  { id: 'sky',     dot: 'bg-sky-500',     bar: 'bg-sky-500',     text: 'text-sky-600 dark:text-sky-400'        },
  { id: 'emerald', dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400'},
  { id: 'amber',   dot: 'bg-amber-500',   bar: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400'    },
  { id: 'rose',    dot: 'bg-rose-500',    bar: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-400'      },
];

export const colorOf = (id: string) => COLORS.find(c => c.id === id) ?? COLORS[0];

export const GOAL_QUESTIONS = [
  { key: 'goal',           q: 'Jaki jest Twój cel?',               hint: 'Konkretny wynik + data. Np. "50k PLN na koncie do 01.10.2026"' },
  { key: 'why',            q: 'Po co Ci to?',                      hint: 'Dlaczego to ważne? Co się zmieni kiedy osiągniesz?' },
  { key: 'milestones',     q: 'Co musi się stać po drodze?',       hint: 'Wymień 3–4 etapy które musisz przejść' },
  { key: 'blockers',       q: 'Dlaczego może się nie udać?',       hint: 'Jakie są ryzyka? Co już próbowałeś i nie wyszło?' },
  { key: 'weekly_actions', q: 'Co robisz co tydzień żeby to osiągnąć?', hint: 'Konkretne powtarzalne działania — to będą Twoje KPI' },
] as const;

export const STATUS_NEXT: Record<string, string> = { active: 'paused', paused: 'done', done: 'active' };
export const STATUS_LABEL: Record<string, string> = { active: 'Aktywny', paused: 'Pauza', done: 'Ukończony' };

// ── Health Score ──────────────────────────────────────────────────────────────

export interface ProjectStats {
  section: TodoSectionRow | null;
  openItems: TodoItemRow[];
  doneItems: TodoItemRow[];
  total: number;
  progress: number;
  lastActivity: Date | null;
  daysSince: number | null;
  slipping: boolean;
  daysLeft: number | null;
}

/**
 * Composite health score 0–100 for an active project.
 * Weights: activity 40%, kpi 35%, deadline 25%
 */
export function calculateHealthScore(
  project: ProjectRow,
  stats: ProjectStats,
  kpis: GoalKpiRow[],
): number {
  // ── Activity score (how recently was something done?) ──
  let activityScore = 50;
  if (stats.daysSince !== null) {
    activityScore = stats.daysSince <= 1 ? 100
      : stats.daysSince <= 3 ? 90
      : stats.daysSince <= 7 ? 65
      : stats.daysSince <= 14 ? 30
      : 5;
  }

  // ── KPI score (avg % to target across all KPIs with target) ──
  const kpisWithTarget = kpis.filter(k => k.target != null && Number(k.target) > 0);
  const kpiScore = kpisWithTarget.length > 0
    ? kpisWithTarget.reduce((acc, k) => acc + Math.min(100, Math.round((Number(k.current_value ?? 0) / Number(k.target)) * 100)), 0) / kpisWithTarget.length
    : 50;

  // ── Deadline score (how on-track is the project?) ──
  let deadlineScore = 60;
  if (stats.daysLeft !== null) {
    const progressPct = stats.total > 0 ? stats.progress : 50;
    const d = stats.daysLeft;
    deadlineScore = d < 0 ? 0
      : d > 60 ? 90
      : d > 30 ? Math.max(40, progressPct)
      : d > 14 ? (progressPct >= 60 ? 80 : 40)
      : progressPct >= 80 ? 85 : progressPct >= 50 ? 50 : 15;
  }

  const weighted = 0.4 * activityScore + 0.35 * kpiScore + 0.25 * deadlineScore;
  return Math.round(Math.min(100, Math.max(0, weighted)));
}

export type HealthLevel = 'great' | 'ok' | 'at-risk' | 'critical';

export function getHealthLevel(score: number): HealthLevel {
  if (score >= 70) return 'great';
  if (score >= 45) return 'ok';
  if (score >= 20) return 'at-risk';
  return 'critical';
}

export const HEALTH_COLORS: Record<HealthLevel, {
  ring: string; fill: string; text: string; bg: string; label: string;
}> = {
  great:    { ring: '#10b981', fill: 'text-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', label: 'Świetnie' },
  ok:       { ring: '#3b82f6', fill: 'text-blue-500',    text: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10',    label: 'OK'       },
  'at-risk':{ ring: '#f59e0b', fill: 'text-amber-500',   text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10',   label: 'Ryzyko'   },
  critical: { ring: '#ef4444', fill: 'text-rose-500',    text: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-500/10',    label: 'Krytyczny'},
};

export type Momentum = 'accelerating' | 'steady' | 'slipping' | 'stalled';

export function getProjectMomentum(stats: ProjectStats): Momentum {
  if (stats.daysSince === null) return 'steady';
  if (stats.daysSince <= 1) return 'accelerating';
  if (stats.daysSince <= 4) return 'steady';
  if (stats.daysSince <= 9) return 'slipping';
  return 'stalled';
}

export function getNextAction(openItems: TodoItemRow[]): string | null {
  if (!openItems || openItems.length === 0) return null;
  return openItems[0]?.title ?? null;
}
