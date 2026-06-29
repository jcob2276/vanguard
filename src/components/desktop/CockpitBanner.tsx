export interface StrainData {
  daily_status: string | null;
  main_limiter: string | null;
  strain_score: number | null;
  recovery_score: number | null;
  fueling_score: number | null;
  fueling_provisional: boolean;
}

export interface OuraData {
  date: string;
  readiness_score: number | null;
  hrv_avg: number | null;
  total_sleep_hours: number | null;
}

