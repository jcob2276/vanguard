import { useState, useEffect } from 'react';
import { fetchExerciseHistory } from '../../../lib/health/workoutApi';
import { epley, type ExerciseHistoryRow } from '../../../lib/health/workout';

export {
  type WorkoutExercise,
  type WorkoutActivity,
  newSet,
  newExercise,
  epley,
  formatLastSession,
  getSuggestion,
  isLogWellness,
  sessionVol,
} from '../../../lib/health/workout';

export type { ExerciseHistoryRow };

export const numInput =
  "h-11 w-full bg-surface-solid border border-border-custom rounded-xl text-sm font-black text-text-primary text-center outline-none focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_2px_rgba(79,70,229,0.08)] transition-all placeholder:text-text-muted/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export function useStopwatch(startTs: number | null): string | null {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTs) return;
    void (async () => { setElapsed(Math.floor((Date.now() - startTs) / 1000)); })();
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
      void (async () => {
        setLastSession(null);
        setLastSessionDate(null);
        setAllTimeBest1RM(null);
      })();
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const data = await fetchExerciseHistory(trimmed, userId);
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
      } catch (_err) {
        // catch silently
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [name, userId]);

  return { lastSession, lastSessionDate, allTimeBest1RM };
}
