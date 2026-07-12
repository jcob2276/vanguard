export interface OuraDailySummaryRow {
  date: string;
  hrv_avg: number | null;
  rhr_avg: number | null;
  total_sleep_hours: number | null;
  sleep_score: number | null;
  readiness_score: number | null;
}

export interface OuraEnhancedRow {
  date: string;
  sleep_average_breath: number | null;
  temperature_deviation: number | null;
  steps: number | null;
  resilience_level: string | null;
}

export interface OuraHrZonesDailyRow {
  day: string;
  z1_regen_min: number | null;
  z2_tlenowa_min: number | null;
  z3_tempo_min: number | null;
  z4_prog_min: number | null;
  z5_max_min: number | null;
  hr_max: number | null;
}

export interface DailyNutritionRow {
  date: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
}

interface ExerciseLogForStrain {
  exercise_name: string;
  rpe: number | null;
  rir: number | null;
  reps: number | null;
}

export interface WorkoutSessionRow {
  date: string;
  exercise_logs: ExerciseLogForStrain[] | null;
}

export interface StravaActivityRow {
  start_date: string;
  perceived_exertion: number | null;
  has_pr: boolean | null;
  sport_type: string | null;
  is_oura: boolean | null;
}

export interface DailyFoodEntryRow {
  name: string;
  logged_at: string | null;
  date: string;
}

export interface BehaviorLogRow {
  date: string;
  behavior_key: string;
  value: string | number | null;
}

export interface DailyReconciliationRow {
  date: string;
  day_score: number | null;
}

export function byKey<T>(rows: T[] | null, key: (r: T) => string): Record<string, T[]> {
  const m: Record<string, T[]> = {};
  for (const r of rows || []) {
    const k = key(r);
    (m[k] = m[k] || []).push(r);
  }
  return m;
}
