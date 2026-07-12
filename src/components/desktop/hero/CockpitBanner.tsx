export type { OuraRow as OuraData } from '../desktopUtils';

export interface StrainData {
  daily_status: string | null;
  main_limiter: string | null;
  strain_score: number | null;
  recovery_score: number | null;
  fueling_score: number | null;
  fueling_provisional: boolean | null;
}

