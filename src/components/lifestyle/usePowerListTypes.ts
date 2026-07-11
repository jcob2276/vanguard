import type { Session } from '@supabase/supabase-js';

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

export const TIME_SLOT_LABELS = {
  morning: '🌅 Rano',
  noon: '☀️ Południe',
  afternoon: '🌆 Popołudnie',
  evening: '🌙 Wieczór',
};

export const SPHERE_SLOTS = [
  { category: 'cialo', label: 'Ciało' },
  { category: 'duch',  label: 'Duch' },
  { category: 'konto', label: 'Konto' },
] as const;

export const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function powerListDraftKey(userId: string, date: string) {
  return `vanguard_powerlist_draft_${userId}_${date}`;
}

export function powerListKpiKey(userId: string, date: string) {
  return `vanguard_powerlist_kpi_${userId}_${date}`;
}

export interface UsePowerListDataProps {
  session: Session;
  todayWin: any;
  onUpdate?: (data: Record<string, unknown>) => void;
  planDaySignal?: number;
}
