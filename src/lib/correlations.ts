export type CorrelationCategory = 'sen' | 'zywienie' | 'trening' | 'regeneracja' | 'zachowanie' | 'suplementy' | 'ekran';
export type ConfidenceTier = 'calibrating' | 'building' | 'solid';
export type CorrelationMethod = 'pearson' | 'spearman';

interface ScatterPoint {
  day: string;
  x: number;
  y: number;
}

export interface CorrelationResult {
  id: string;
  category: CorrelationCategory;
  label: string;
  note: string;
  x_metric: string;
  y_metric: string;
  x_label: string;
  y_label: string;
  lag_days: number;
  method?: CorrelationMethod;
  r: number;
  r_pearson: number | null;
  r_spearman: number | null;
  r_abs: number;
  n: number;
  p: number;
  significant: boolean;
  confidence: ConfidenceTier;
  has_enough_data: boolean;
  slope: number;
  intercept: number;
  interpretation: string;
  discovered?: boolean;
  cross_domain?: boolean;
  scatter: ScatterPoint[];
}

export interface CorrelationStats {
  total_pairs: number;
  computed_total?: number;
  pairs_scanned?: number;
  hidden_weak?: number;
  significant: number;
  discovered: number;
  cross_domain?: number;
  curated?: number;
  spearman_primary: number;
  metrics_tracked: number;
}

export interface BehaviorEffectResult {
  behavior_key: string;
  n_with: number;
  n_without: number;
  mean_with: number | null;
  mean_without: number | null;
  delta: number | null;
  pct_change: number | null;
  cohens_d: number | null;
  p_value: number | null;
  significant: boolean;
  confidence: ConfidenceTier;
  dose_response: {
    beta_user: number;
    beta_final: number;
    prior_used: boolean;
    n: number;
    confidence: ConfidenceTier;
    contradicts_prior: boolean;
  } | null;
  outcome_metric: string;
  lag_days: number;
}

export const CATEGORY_LABELS: Record<CorrelationCategory, string> = {
  sen: 'Sen',
  zywienie: 'Jedzenie & kofeina',
  trening: 'Trening & cardio',
  regeneracja: 'Regeneracja',
  zachowanie: 'Zachowanie',
  suplementy: 'Suplementy',
  ekran: 'Ekran & focus',
};

export const METHOD_LABELS: Record<CorrelationMethod, string> = {
  pearson: 'Pearson (liniowa)',
  spearman: 'Spearman (monotoniczna)',
};

export const CONFIDENCE_LABELS: Record<ConfidenceTier, string> = {
  calibrating: 'Kalibracja',
  building: 'Budowanie',
  solid: 'Solid',
};

export function rColor(r: number): string {
  const a = Math.abs(r);
  if (a >= 0.5) return r > 0 ? '#059669' : '#e11d48';
  if (a >= 0.3) return r > 0 ? '#10b981' : '#f43f5e';
  if (a >= 0.1) return '#6366f1';
  return '#9ca3af';
}

export function formatLag(lag: number): string {
  if (lag === 0) return 'tego samego dnia';
  if (lag === 1) return 'następnego dnia';
  return `+${lag} dni`;
}

/** Fallback client filter when API not yet deployed with interest gate */
export function isInterestingCorrelationClient(item: CorrelationResult): boolean {
  if (!item.has_enough_data || item.n < 5) return false;
  if (item.significant && item.n >= 8) return true;
  if (item.r_abs >= 0.28 && item.n >= 8) return true;
  if (item.r_abs >= 0.38 && item.n >= 6 && item.p < 0.08) return true;
  return item.r_abs >= 0.22 && item.n >= 12;
}

const BEHAVIOR_LABELS: Record<string, string> = {
  alcohol: 'Alkohol',
  alkohol: 'Alkohol',
  alcohol_units: 'Alkohol',
  travel: 'Podróż',
  podroz: 'Podróż',
  stress: 'Stres',
  stres: 'Stres',
  illness: 'Choroba',
  choroba: 'Choroba',
  caffeine: 'Kofeina',
  kofeina: 'Kofeina',
};

export function behaviorLabel(key: string): string {
  const lower = key.toLowerCase();
  if (BEHAVIOR_LABELS[lower]) return BEHAVIOR_LABELS[lower];
  return key.replace(/_/g, ' ');
}

const SLEEP_STAGE_OUTCOMES = ['deep_sleep_h', 'rem_sleep_h'] as const;

export function isSleepStageDriver(item: CorrelationResult): boolean {
  return (SLEEP_STAGE_OUTCOMES as readonly string[]).includes(item.y_metric);
}
