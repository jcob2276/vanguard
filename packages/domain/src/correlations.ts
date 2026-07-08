import { studentTPValue } from './stats.ts';

export type CorrelationCategory = 'sen' | 'zywienie' | 'trening' | 'regeneracja' | 'zachowanie' | 'suplementy' | 'ekran';
export type ConfidenceTier = 'calibrating' | 'building' | 'solid';
export type CorrelationMethod = 'pearson' | 'spearman';

export interface ScatterPoint {
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

// ── Backend calculation engine logic ──

export interface CorrelationCore {
  r: number;
  n: number;
  p: number;
  slope: number;
  intercept: number;
}

export type SeriesPoint = { day: string; value: number };

export function pValue(r: number, n: number): number {
  if (n <= 2) return 1;
  const oneMinusR2 = 1 - r * r;
  if (oneMinusR2 <= 0) return 0;
  const t = r * Math.sqrt((n - 2) / oneMinusR2);
  return studentTPValue(t, n - 2);
}

export function rankValues(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
    const avgRank = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

export function pearson(xy: [number, number][]): CorrelationCore | null {
  const n = xy.length;
  if (n < 3) return null;
  let sumX = 0, sumY = 0;
  for (const [x, y] of xy) { sumX += x; sumY += y; }
  const meanX = sumX / n, meanY = sumY / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of xy) {
    const dx = x - meanX, dy = y - meanY;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  if (sxx <= 0 || syy <= 0) return null;
  let r = sxy / (Math.sqrt(sxx) * Math.sqrt(syy));
  r = Math.max(-1, Math.min(1, r));
  return { r, n, p: pValue(r, n), slope: sxy / sxx, intercept: meanY - (sxy / sxx) * meanX };
}

export function spearman(xy: [number, number][]): CorrelationCore | null {
  if (xy.length < 3) return null;
  const xs = xy.map(p => p[0]);
  const ys = xy.map(p => p[1]);
  const rx = rankValues(xs);
  const ry = rankValues(ys);
  return pearson(rx.map((x, i) => [x, ry[i]] as [number, number]));
}

function shiftDay(day: string, delta: number): string | null {
  if (delta === 0) return day;
  const d = new Date(day + 'T12:00:00Z');
  if (isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function laggedPairs(
  x: SeriesPoint[],
  y: SeriesPoint[],
  lagDays: number
): { pairs: [number, number][]; scatter: ScatterPoint[] } {
  const mapY: Record<string, number> = {};
  for (const row of y) mapY[row.day] = row.value;
  const pairs: [number, number][] = [];
  const scatter: ScatterPoint[] = [];
  for (const row of [...x].sort((a, b) => a.day.localeCompare(b.day))) {
    const shifted = shiftDay(row.day, lagDays);
    if (shifted && mapY[shifted] != null) {
      pairs.push([row.value, mapY[shifted]]);
      scatter.push({ day: row.day, x: row.value, y: mapY[shifted] });
    }
  }
  return { pairs, scatter };
}

export function dualCorrelation(pairs: [number, number][]): {
  pearson: CorrelationCore | null;
  spearman: CorrelationCore | null;
  method: CorrelationMethod;
  primary: CorrelationCore | null;
} {
  const pearsonR = pearson(pairs);
  const spearmanR = spearman(pairs);
  let method: CorrelationMethod = 'pearson';
  let primary = pearsonR;
  if (pearsonR && spearmanR) {
    if (Math.abs(spearmanR.r) > Math.abs(pearsonR.r) + 0.05) {
      method = 'spearman';
      primary = spearmanR;
    }
  } else if (!pearsonR && spearmanR) {
    method = 'spearman';
    primary = spearmanR;
  }
  return { pearson: pearsonR, spearman: spearmanR, method, primary };
}

export function interpretR(r: number): string {
  const a = Math.abs(r);
  const dir = r > 0 ? 'pozytywna' : 'negatywna';
  if (a >= 0.5) return `silna ${dir}`;
  if (a >= 0.3) return `umiarkowana ${dir}`;
  if (a >= 0.1) return `słaba ${dir}`;
  return 'brak korelacji';
}

export function confidenceTier(n: number): ConfidenceTier {
  if (n < 5) return 'calibrating';
  if (n < 12) return 'building';
  return 'solid';
}
