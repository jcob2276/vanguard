import type { Tables } from './database.types';

type DailyWin = Pick<
  Tables<'daily_wins'>,
  | 'task_1'
  | 'task_2'
  | 'task_3'
  | 'task_4'
  | 'task_5'
  | 'done_1'
  | 'done_2'
  | 'done_3'
  | 'done_4'
  | 'done_5'
>;

export function countPowerListProgress(win: DailyWin | null | undefined) {
  if (!win) return { done: 0, filled: 0, total: 5 };
  let done = 0;
  let filled = 0;
  for (let i = 1; i <= 5; i++) {
    const task = win[`task_${i}` as keyof DailyWin];
    if (task) {
      filled++;
      if (win[`done_${i}` as keyof DailyWin]) done++;
    }
  }
  return { done, filled, total: 5 };
}
