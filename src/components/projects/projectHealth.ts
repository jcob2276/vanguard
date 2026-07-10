import type { TodoItemRow, TodoSectionRow } from '../../lib/todo/todo';
import type { ProjectRow, GoalKpiRow } from './projectUtils';

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
  let activityScore = 50; // default when no tasks yet
  if (stats.daysSince !== null) {
    if (stats.daysSince <= 1)  activityScore = 100;
    else if (stats.daysSince <= 3)  activityScore = 90;
    else if (stats.daysSince <= 7)  activityScore = 65;
    else if (stats.daysSince <= 14) activityScore = 30;
    else activityScore = 5;
  } else if (stats.total === 0) {
    // No tasks at all — neutral
    activityScore = 50;
  }

  // ── KPI score (avg % to target across all KPIs with target) ──
  let kpiScore = 50; // default when no KPIs
  const kpisWithTarget = kpis.filter(k => k.target != null && Number(k.target) > 0);
  if (kpisWithTarget.length > 0) {
    const avg = kpisWithTarget.reduce((acc, k) => {
      const pct = Math.min(100, Math.round((Number(k.current_value ?? 0) / Number(k.target)) * 100));
      return acc + pct;
    }, 0) / kpisWithTarget.length;
    kpiScore = avg;
  }

  // ── Deadline score (how on-track is the project?) ──
  let deadlineScore = 60; // no deadline
  if (stats.daysLeft !== null) {
    if (stats.daysLeft < 0) {
      // Overdue
      deadlineScore = 0;
    } else {
      // Compare remaining time vs remaining work
      const progressPct = stats.total > 0 ? stats.progress : 50;
      const timeElapsedApprox = stats.daysLeft; // lower = more urgent
      if (timeElapsedApprox > 60) deadlineScore = 90;
      else if (timeElapsedApprox > 30) deadlineScore = Math.max(40, progressPct);
      else if (timeElapsedApprox > 14) deadlineScore = progressPct >= 60 ? 80 : 40;
      else deadlineScore = progressPct >= 80 ? 85 : progressPct >= 50 ? 50 : 15;
    }
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
