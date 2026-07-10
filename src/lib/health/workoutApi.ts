import { supabase } from '../supabase';
import type { ExerciseHistoryRow } from './workout';

export async function fetchExerciseHistory(name: string, userId: string): Promise<ExerciseHistoryRow[]> {
  const trimmed = name.trim();
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('weight, reps, rir, set_number, session_id, workout_sessions!inner(date)')
    .eq('user_id', userId)
    .eq('exercise_name', trimmed)
    .limit(500);

  if (error) throw new Error(error.message);
  return (data || []) as ExerciseHistoryRow[];
}
