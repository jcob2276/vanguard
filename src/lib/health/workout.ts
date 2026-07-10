import type { Tables } from '../database.types';

export interface WorkoutSet {
  id: number;
  kg: string;
  reps: string;
  rir: string;
  msp: boolean;
}

export interface WorkoutExercise {
  id: number;
  name: string;
  tags: string[];
  sets: WorkoutSet[];
}

export interface WorkoutActivity {
  id: number;
  name: string;
  min: string;
  note: string;
}

export type ExerciseHistoryRow = Pick<Tables<'exercise_logs'>, 'weight' | 'reps' | 'rir' | 'set_number' | 'session_id'> & {
  workout_sessions?: Pick<Tables<'workout_sessions'>, 'date'> | null;
};

export const newSet = (): WorkoutSet => ({
  id: Date.now() + Math.random(),
  kg: '',
  reps: '',
  rir: '',
  msp: false,
});

export const newExercise = (): WorkoutExercise => ({
  id: Date.now() + Math.random(),
  name: '',
  tags: [],
  sets: [newSet()],
});

export const newActivity = (): WorkoutActivity => ({
  id: Date.now() + Math.random(),
  name: '',
  min: '',
  note: '',
});

export function epley(
  kg: string | number | null | undefined,
  reps: string | number | null | undefined
): number | null {
  if (kg === null || kg === undefined || reps === null || reps === undefined) return null;
  const k = typeof kg === 'number' ? kg : parseFloat(kg);
  const r = typeof reps === 'number' ? reps : parseInt(reps);
  if (!k || !r || r <= 0) return null;
  return r === 1 ? k : k * (1 + r / 30);
}

export function formatLastSession(sets: ExerciseHistoryRow[] | null | undefined): string | null {
  if (!sets?.length) return null;
  const ws = [...new Set(sets.map((s) => s.weight))];
  const rs = [...new Set(sets.map((s) => s.reps))];
  if (ws.length === 1 && rs.length === 1) return `${ws[0]}kg × ${rs[0]} × ${sets.length} ser.`;
  return sets.map((s) => `${s.weight}×${s.reps}`).join(' · ');
}

export function getSuggestion(lastSession: ExerciseHistoryRow[] | null | undefined): number | null {
  if (!lastSession?.length) return null;
  const maxW = Math.max(...lastSession.map((s) => Number(s.weight || 0)));
  if (!maxW) return null;
  const minReps = Math.min(...lastSession.map((s) => Number(s.reps || 0)));
  const maxReps = Math.max(...lastSession.map((s) => Number(s.reps || 0)));
  const repsConsistent = maxReps - minReps <= 1;
  const increment = maxW >= 40 ? 2.5 : 1.25;

  if (!repsConsistent) return maxW;

  const rirValues = lastSession.map((s) => s.rir).filter((r): r is number => r != null);
  const avgRir = rirValues.length > 0 ? rirValues.reduce((a, b) => a + b, 0) / rirValues.length : null;

  // RIR 0 — failed/near-failure, don't increase
  if (avgRir !== null && avgRir < 1) return maxW;
  return maxW + increment;
}

const WELLNESS_NAMES = ['sauna', 'lodowata', 'zimny prysznic', 'stretching', 'foam rolling'];

export const isLogWellness = (l: { exercise_name: string; muscle_tags?: string[] }) =>
  (l.muscle_tags || []).includes('wellness') ||
  WELLNESS_NAMES.some(w => (l.exercise_name || '').toLowerCase().startsWith(w));

export function sessionVol(s: { exercise_logs: { exercise_name: string; weight: number | string | null; reps: number | string | null; muscle_tags?: string[] }[] }) {
  return (s.exercise_logs || []).reduce((sum, l) => {
    if (isLogWellness(l)) return sum;
    return sum + (Number(l.weight) || 0) * (Number(l.reps) || 0);
  }, 0);
}
