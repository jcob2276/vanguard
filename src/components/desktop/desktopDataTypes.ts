export interface OuraRow {
  date: string;
  hrv_avg: number | null;
  rhr_avg: number | null;
  readiness_score: number | null;
  total_sleep_hours: number | null;
  sleep_score?: number | null;
}

export interface WorkoutSessionSummary {
  date: string | null;
  exercise_logs: {
    exercise_name: string;
    weight: number | string | null;
    reps: number | string | null;
    muscle_tags?: string[];
    is_pws_or_msp?: boolean | null;
    rir?: number | null;
    rpe?: number | null;
  }[];
}

export interface StravaActivitySummary {
  start_date: string;
  sport_type: string;
  distance: number | string | null;
}

export interface NutritionDayRow {
  date: string;
  calories?: number | null;
  protein?: number | null;
}

export interface NarrativeInsight {
  type: 'data';
  urgency: 'high' | 'medium';
  headline: string;
  evidence: string;
}

export interface IntelCard {
  type: 'data' | 'pattern' | 'wiki' | 'knowledge';
  urgency?: 'high' | 'medium' | 'low';
  headline?: string | null;
  evidence?: string | null;
  meta?: string | null;
  count?: number;
  importance?: number;
  importance_score?: number | null;
}
