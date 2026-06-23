import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Tables } from '../../../lib/database.types';

export interface WorkoutSet {
  id: number;
  kg: string;
  reps: string;
  rir: string;
  msp: boolean;
  done?: boolean;
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
  done: false,
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

export const numInput =
  "h-11 w-full bg-surface-solid border border-border-custom rounded-xl text-sm font-black text-text-primary text-center outline-none focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_2px_rgba(79,70,229,0.08)] transition-all placeholder:text-text-muted/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

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

/** Ticks down to 0 from `endTime` (ms epoch). Returns remaining whole seconds, or 0 when idle/done. */
export function useCountdown(endTime: number | null): number {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!endTime) { setRemaining(0); return; }
    const tick = () => setRemaining(Math.max(0, Math.round((endTime - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endTime]);
  return remaining;
}

export function useStopwatch(startTs: number | null): string | null {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTs) return;
    setElapsed(Math.floor((Date.now() - startTs) / 1000));
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTs) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startTs]);
  if (!startTs) return null;
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function useExerciseHistory(name: string, userId: string | undefined) {
  const [lastSession, setLastSession] = useState<ExerciseHistoryRow[] | null>(null);
  const [lastSessionDate, setLastSessionDate] = useState<string | null>(null);
  const [allTimeBest1RM, setAllTimeBest1RM] = useState<number | null>(null);

  useEffect(() => {
    const trimmed = name.trim();
    if (!userId || trimmed.length < 2) {
      setLastSession(null);
      setLastSessionDate(null);
      setAllTimeBest1RM(null);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('exercise_logs')
        .select('weight, reps, rir, set_number, session_id, workout_sessions!inner(date)')
        .eq('user_id', userId)
        .eq('exercise_name', trimmed)
        .limit(500);

      if (!data?.length) {
        setLastSession(null);
        setLastSessionDate(null);
        setAllTimeBest1RM(null);
        return;
      }

      const sorted = [...data] as ExerciseHistoryRow[];
      sorted.sort((a, b) => {
        const byDate = (b.workout_sessions?.date || '').localeCompare(a.workout_sessions?.date || '');
        return byDate || (a.set_number || 0) - (b.set_number || 0);
      });
      const bySession: Record<string, ExerciseHistoryRow[]> = {};
      for (const row of sorted) {
        if (!row.session_id) continue;
        if (!bySession[row.session_id]) bySession[row.session_id] = [];
        bySession[row.session_id].push(row);
      }
      const last = Object.values(bySession)[0].sort((a, b) => (a.set_number || 0) - (b.set_number || 0));
      setLastSession(last);
      setLastSessionDate(last[0]?.workout_sessions?.date ?? null);

      const best = sorted.reduce((max: number, r: ExerciseHistoryRow) => {
        const e = epley(r.weight, r.reps);
        return e && e > max ? e : max;
      }, 0);
      setAllTimeBest1RM(best > 0 ? best : null);
    }, 500);
    return () => clearTimeout(timeout);
  }, [name, userId]);

  return { lastSession, lastSessionDate, allTimeBest1RM };
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
