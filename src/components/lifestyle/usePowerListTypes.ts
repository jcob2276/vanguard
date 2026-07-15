import type { Session } from '@supabase/supabase-js';
import type { Tables } from '../../lib/database.types';

export interface TaskSlot {
  task: string;
  todoId: string | null;
  checkpointId: string | null;
  projectId: string | null;
  pinId: string | null;
  kpiId?: string | null;
  targetValue?: string;
  timeSlot?: 'morning' | 'noon' | 'afternoon' | 'evening';
}

export interface PowerListDraft {
  tasks: TaskSlot[];
  yesterdayNote: string;
  savedAt: number;
}

export const EMPTY_SLOT: TaskSlot = {
  task: '',
  todoId: null,
  checkpointId: null,
  projectId: null,
  pinId: null,
  targetValue: '',
  timeSlot: 'morning',
};

export function powerListDraftKey(userId: string, date: string) {
  return `vanguard_powerlist_draft_${userId}_${date}`;
}

export function powerListKpiKey(userId: string, date: string) {
  return `vanguard_powerlist_kpi_${userId}_${date}`;
}

export interface UsePowerListDataProps {
  session: Session;
  todayWin: DailyWinWithTasks | null;
  onUpdate?: (data: Record<string, unknown>) => void;
  planDaySignal?: number;
}

export type DailyWinWithTasks = Tables<'daily_wins'> & {
  daily_win_tasks?: Tables<'daily_win_tasks'>[];
};

/** `daily_wins` rows use numbered-suffix columns (task_1..task_5, done_1..done_5, etc.)
 *  accessed via computed keys; the Record index signature types those lookups instead of `any`. */
export type DailyWinRecord = DailyWinWithTasks & Record<string, unknown>;

export interface ProjectOption {
  id: string;
  name: string;
  kpis: { id: string; name: string; current: number | null; target: number | null }[];
}

