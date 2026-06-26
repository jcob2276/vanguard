import { addDays, format, parseISO } from 'date-fns';
import type { LearningSkill, LearningWeekFocus, LearningWeekPin } from './growth';
import { shiftWeekStart } from './growth';

export interface WeekDirectionGoals {
  intention: string | null;
  commitment: string | null;
  cialo: string | null;
  duch: string | null;
  konto: string | null;
}

export interface PowerListWeekStats {
  daysLogged: number;
  daysWithWins: number;
  tasksDone: number;
  tasksSet: number;
}

export interface GrowthPrevWeekSummary {
  weekStart: string;
  focusLabel: string | null;
  focusTarget: number | null;
  mustDone: number;
  mustTotal: number;
  focusScore: number | null;
}

export function getWeekEndExclusive(weekStart: string): string {
  return shiftWeekStart(weekStart, 1);
}

export function computePowerListWeekStats(
  rows: Array<{
    done_1?: boolean | null;
    done_2?: boolean | null;
    done_3?: boolean | null;
    done_4?: boolean | null;
    done_5?: boolean | null;
    task_1?: string | null;
    task_2?: string | null;
    task_3?: string | null;
    task_4?: string | null;
    task_5?: string | null;
  }>,
): PowerListWeekStats {
  let daysWithWins = 0;
  let tasksDone = 0;
  let tasksSet = 0;

  for (const row of rows) {
    let dayDone = 0;
    for (let i = 1; i <= 5; i++) {
      const task = row[`task_${i}` as keyof typeof row] as string | null | undefined;
      const done = row[`done_${i}` as keyof typeof row] as boolean | null | undefined;
      if (task?.trim()) {
        tasksSet++;
        if (done) {
          tasksDone++;
          dayDone++;
        }
      }
    }
    if (dayDone > 0) daysWithWins++;
  }

  return { daysLogged: rows.length, daysWithWins, tasksDone, tasksSet };
}

/** Najbliższy snapshot w obrębie tygodnia (date >= weekStart, < weekEnd). */
export function pickSnapshotInWeek(
  snapshots: { snapshot_date: string; scores: Record<string, number> }[],
  weekStart: string,
): { snapshot_date: string; scores: Record<string, number> } | null {
  const weekEnd = getWeekEndExclusive(weekStart);
  const inWeek = snapshots
    .filter((s) => s.snapshot_date >= weekStart && s.snapshot_date < weekEnd)
    .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
  return inWeek[0] ?? null;
}

export function focusScoreForWeek(
  parents: LearningSkill[],
  snapshots: { snapshot_date: string; scores: Record<string, number> }[],
  weekStart: string,
  focus: Pick<LearningWeekFocus, 'skill_id'> | null,
): number | null {
  if (!focus?.skill_id) return null;
  const skill = parents.find((s) => s.id === focus.skill_id);
  if (!skill) return null;
  const snap = pickSnapshotInWeek(snapshots, weekStart);
  return snap?.scores[skill.key] ?? null;
}

export function summarizePins(pins: LearningWeekPin[]) {
  return {
    mustDone: pins.filter((p) => p.slot === 'must' && p.done).length,
    mustTotal: pins.filter((p) => p.slot === 'must').length,
    activeDone: pins.filter((p) => p.slot === 'active' && p.done).length,
    activeTotal: pins.filter((p) => p.slot === 'active').length,
  };
}

export function formatShortWeek(weekStart: string): string {
  const start = parseISO(`${weekStart.slice(0, 10)}T12:00:00`);
  const end = addDays(start, 6);
  return `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`;
}
