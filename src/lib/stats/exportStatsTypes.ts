import type { Json } from '../database.types';

// oura_derived_daily is not in generated database.types.ts yet
export interface OuraDerivedRow {
  day: string;
  sleep_hr_min: number | null;
  sleep_hr_avg: number | null;
  sleep_hr_max: number | null;
  sleep_hrv_min: number | null;
  sleep_hrv_avg: number | null;
  sleep_hrv_peak: number | null;
  awakenings: number | null;
  deep_blocks: number | null;
  met_peak: number | null;
  met_avg: number | null;
  vigorous_min: number | null;
  moderate_min: number | null;
  light_min: number | null;
  hr_min_day: number | null;
  hr_avg_day: number | null;
  hr_max_day: number | null;
  workout_count: number | null;
  workout_minutes: number | null;
  workout_calories: number | null;
}

export interface StravaSplit {
  split: number | null;
  moving_time: number | null;
  distance: number | null;
  average_speed: number | null;
  average_heartrate: number | null;
  average_grade_adjusted_speed: number | null;
  elevation_difference: number | null;
  elapsed_time: number | null;
}

export interface StravaBestEffort {
  name: string;
  moving_time: number;
  pr_rank: number | null;
}

export interface GcHrZone {
  secsInZone: number | null;
}

export interface AwAppEntry {
  app: string;
  seconds: number;
}

export interface PhoneTopApp {
  app: string;
  min: number;
}

export interface StravaRawActivity {
  strava_id: number;
  raw_data: { description?: string; athlete_comment?: string } | null;
}

export interface StravaCleanActivity {
  strava_id: number | null;
  name: string | null;
  sport_type: string | null;
  start_date: string | null;
  elapsed_time: number | null;
  moving_time: number | null;
  distance: number | null;
  total_elevation_gain: number | null;
  pace_sec_per_km: number | null;
  cadence_spm: number | null;
  hr_avg: number | null;
  hr_max: number | null;
  hr_source: string | null;
  hr_frozen: boolean | null;
  splits_with_hr: Json | null;
  gear_name: string | null;
  gear_distance_km: number | null;
  has_pr: boolean | null;
  pause_seconds: number | null;
  is_oura: boolean | null;
  perceived_exertion: number | null;
  workout_type: number | null;
  best_efforts: Json | null;
  gc_hr_zones: Json | null;
  gc_weather: Json | null;
  gc_training_effect_aerobic: number | null;
  gc_training_effect_anaerobic: number | null;
  gc_vo2max: number | null;
  gc_enriched_at: string | null;
}

export interface ExportStatsMarkdownParams {
  supabase: import('@supabase/supabase-js').SupabaseClient;
  session: { user: { id: string }; access_token: string };
  dateRange: { from: string; to: string };
  userSettings?: { home_lat?: number | null; home_lng?: number | null } | null;
  includeNutrition: boolean;
  includeJournal: boolean;
  includeOura: boolean;
  includeHabits: boolean;
  includeWorkouts: boolean;
  includeBody: boolean;
  includeActivityWatch: boolean;
}

export interface ExportOuraCsvParams {
  supabase: import('@supabase/supabase-js').SupabaseClient;
  session: { user: { id: string } };
  dateRange: { from: string; to: string };
}
