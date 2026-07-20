import type { Tables } from './database.types';

export type DailyWinTask = Tables<'daily_win_tasks'>;

/** Prefer daily_win_tasks when present; fall back to wide columns for legacy rows. */
export function slotDone(
  win: {
    daily_win_tasks?: Pick<DailyWinTask, 'slot' | 'done'>[] | null;
    [key: string]: unknown;
  },
  slot: number,
): boolean {
  const fromTasks = win.daily_win_tasks?.find((t) => t.slot === slot);
  if (fromTasks) return Boolean(fromTasks.done);
  return Boolean(win[`done_${slot}`]);
}

export function slotTitle(
  win: {
    daily_win_tasks?: Pick<DailyWinTask, 'slot' | 'title'>[] | null;
    [key: string]: unknown;
  },
  slot: number,
): string | null {
  const fromTasks = win.daily_win_tasks?.find((t) => t.slot === slot);
  if (fromTasks?.title) return fromTasks.title;
  const wide = win[`task_${slot}`];
  return typeof wide === 'string' ? wide : null;
}
