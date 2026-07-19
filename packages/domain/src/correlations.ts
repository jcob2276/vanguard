import { studentTPValue } from './stats.ts';
import { shiftDateStr } from './date.ts';

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
  const ranks = new Array(values.length);
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
  return pearson(rx.map((x, i) => [x, ry[i]]));
}

export function shiftDay(day: string, delta: number): string | null {
  if (delta === 0) return day;
  if (isNaN(new Date(day + 'T12:00:00Z').getTime())) return null;
  return shiftDateStr(day, delta);
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

// ── Czynniki Wpływu & Strict Statistical Gates ────────────────────────────────

export const ALLOWED_OUTCOMES = new Set([
  'sleep_h', 'sleep_score', 'sleep_efficiency', 'deep_sleep_h', 'rem_sleep_h',
  'sleep_hrv', 'hrv', 'sleep_lowest_hr', 'rhr', 'readiness', 'recovery',
  'plan_done_pct', 'execution_score', 'day_score', 'mood_score', 'weight_kg',
  'workout_strain', 'strain', 'cns_load'
]);

export const ALLOWED_INPUTS = new Set([
  'caffeine_mg', 'caffeine_late_mg', 'last_coffee_hour', 'alcohol_units',
  'bedtime_hour', 'calories', 'calories_late', 'last_meal_hour', 'food_quality',
  'insulin_load', 'steps', 'workout_strain', 'strain', 'screen_time_min',
  'fragmentation_index', 'phone_drift', 'phone_active_h', 'creatine_taken',
  'omega3_taken', 'lions_mane_taken', 'd3_taken', 'habit_count'
]);

export const REDUNDANT_GROUPS = [
  ['sleep_h', 'sleep_score', 'sleep_efficiency', 'deep_sleep_h', 'rem_sleep_h', 'light_sleep_h', 'sleep_latency', 'sleep_hr', 'sleep_hrv', 'sleep_lowest_hr', 'restless_periods', 'temp_deviation'],
  ['readiness', 'recovery'],
  ['calories', 'protein', 'carbs', 'fat', 'sugar', 'fiber', 'insulin_load'],
  ['workout_strain', 'strain', 'cns_load', 'leg_load', 'cardio', 'strength', 'workout_hr_avg', 'workout_hr_peak']
];

export function isAllowedInput(metric: string): boolean {
  if (ALLOWED_INPUTS.has(metric)) return true;
  if (metric.startsWith('habit__') || metric.startsWith('behav__')) return true;
  return false;
}

export function areMetricsRedundant(x: string, y: string): boolean {
  if (x === y) return true;
  for (const group of REDUNDANT_GROUPS) {
    if (group.includes(x) && group.includes(y)) return true;
  }
  return false;
}

export function correlationCI(r: number, n: number) {
  if (n <= 3) return { lower: -1, upper: 1, crossesZero: true };
  const clippedR = Math.max(-0.9999, Math.min(0.9999, r));
  const z = 0.5 * Math.log((1 + clippedR) / (1 - clippedR));
  const se = 1 / Math.sqrt(n - 3);
  const zLower = z - 1.96 * se;
  const zUpper = z + 1.96 * se;
  const rLower = Math.tanh(zLower);
  const rUpper = Math.tanh(zUpper);
  return {
    lower: +rLower.toFixed(3),
    upper: +rUpper.toFixed(3),
    crossesZero: rLower * rUpper <= 0
  };
}

export function checkSplitHalfStability(scatter: ScatterPoint[]): boolean {
  if (scatter.length < 10) return false;
  const sorted = [...scatter].sort((a, b) => a.day.localeCompare(b.day));
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const r1 = pearson(firstHalf.map(p => [p.x, p.y]));
  const r2 = pearson(secondHalf.map(p => [p.x, p.y]));

  if (!r1 || !r2) return false;
  return Math.sign(r1.r) === Math.sign(r2.r) && Math.abs(r1.r) > 0.02 && Math.abs(r2.r) > 0.02;
}

export function fdrCorrection(pValues: number[], alpha = 0.10): boolean[] {
  const m = pValues.length;
  if (m === 0) return [];
  const indexed = pValues.map((p, originalIndex) => ({ p, originalIndex }));
  indexed.sort((a, b) => a.p - b.p);

  let maxK = -1;
  for (let k = 0; k < m; k++) {
    if (indexed[k].p <= ((k + 1) / m) * alpha) {
      maxK = k;
    }
  }

  const significant = new Array(m).fill(false);
  for (let k = 0; k <= maxK; k++) {
    significant[indexed[k].originalIndex] = true;
  }
  return significant;
}

export function getControllability(metric: string): number {
  const m = metric.toLowerCase();
  if (
    m.includes('caffeine') || m.includes('coffee') ||
    m.includes('alcohol') || m.includes('alkohol') ||
    m.includes('meal') || m.includes('calories_late') ||
    m.includes('bedtime') || m.includes('screen') ||
    m.includes('phone_drift') || m.includes('phone_active') ||
    m.includes('creatine') || m.includes('omega3') || m.includes('lions_mane') ||
    m.includes('d3') || m.startsWith('habit__') || m.includes('food_quality')
  ) {
    return 1.0;
  }
  if (m.includes('strain') || m.includes('steps') || m.includes('workout') || m.includes('run')) {
    return 0.4;
  }
  return 0.1;
}

export function computeNaturalEffect(
  xMetric: string,
  yMetric: string,
  scatter: ScatterPoint[]
): string {
  if (scatter.length < 5) return 'Brak danych';
  const uniqueX = new Set(scatter.map(p => p.x));
  const isBinary = uniqueX.size <= 3;

  let delta = 0;
  let description = '';

  if (isBinary) {
    const sortedX = Array.from(uniqueX).sort((a, b) => a - b);
    const midX = sortedX[Math.floor(sortedX.length / 2)];
    const groupHigh = scatter.filter(p => p.x >= midX).map(p => p.y);
    const groupLow = scatter.filter(p => p.x < midX).map(p => p.y);

    if (groupHigh.length >= 2 && groupLow.length >= 2) {
      const meanHigh = groupHigh.reduce((a, b) => a + b, 0) / groupHigh.length;
      const meanLow = groupLow.reduce((a, b) => a + b, 0) / groupLow.length;
      delta = meanHigh - meanLow;
    } else {
      delta = olsSlope(scatter.map(p => [p.x, p.y])) || 0;
    }
    description = 'z vs bez';
  } else {
    const xs = scatter.map(p => p.x);
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const stdX = Math.sqrt(xs.reduce((sum, x) => sum + Math.pow(x - meanX, 2), 0) / xs.length);
    const slope = olsSlope(scatter.map(p => [p.x, p.y])) || 0;
    delta = slope * stdX;
    description = `na każde +${stdX.toFixed(1)} jedn.`;
  }

  let formattedDelta = '';
  if (yMetric.includes('sleep_h') || yMetric === 'sleep_h' || yMetric === 'deep_sleep_h' || yMetric === 'rem_sleep_h') {
    const mins = Math.round(delta * 60);
    formattedDelta = `${mins > 0 ? '+' : ''}${mins} min`;
  } else if (yMetric.includes('score') || yMetric === 'readiness' || yMetric === 'recovery') {
    formattedDelta = `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pkt`;
  } else if (yMetric === 'hrv' || yMetric === 'sleep_hrv') {
    formattedDelta = `${delta > 0 ? '+' : ''}${delta.toFixed(1)} ms`;
  } else if (yMetric === 'rhr' || yMetric === 'sleep_lowest_hr') {
    formattedDelta = `${delta > 0 ? '+' : ''}${delta.toFixed(1)} bpm`;
  } else if (yMetric === 'plan_done_pct') {
    formattedDelta = `${delta > 0 ? '+' : ''}${Math.round(delta)}%`;
  } else {
    formattedDelta = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;
  }

  return `${formattedDelta} (${description})`;
}

function olsSlope(pairs: [number, number][]): number | null {
  const n = pairs.length;
  if (n < 3) return null;
  const xs = pairs.map(p => p[0]);
  const ys = pairs.map(p => p[1]);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0;
  for (const [x, y] of pairs) {
    sxx += (x - mx) * (x - mx);
    sxy += (x - mx) * (y - my);
  }
  return sxx > 0 ? sxy / sxx : null;
}

export interface ImpactFactor {
  id: string;
  x_metric: string;
  y_metric: string;
  x_label: string;
  y_label: string;
  lag_days: number;
  r: number;
  n: number;
  p: number;
  ci_lower: number;
  ci_upper: number;
  ci_crosses_zero: boolean;
  is_stable: boolean;
  evidence_level: 'confirmed' | 'probable' | 'hypothesis' | 'no_evidence';
  natural_effect: string;
  decision_value: number;
  scatter: ScatterPoint[];
  method: CorrelationMethod;
  category: CorrelationCategory;
}

export function classifyImpactFactors(results: CorrelationResult[]): ImpactFactor[] {
  const filtered = results.filter(r => {
    if (!isAllowedInput(r.x_metric) || !ALLOWED_OUTCOMES.has(r.y_metric)) return false;
    if (areMetricsRedundant(r.x_metric, r.y_metric)) return false;
    return true;
  });

  const factors = filtered.map(r => {
    const ci = correlationCI(r.r, r.n);
    const isStable = checkSplitHalfStability(r.scatter);
    const naturalEffect = computeNaturalEffect(r.x_metric, r.y_metric, r.scatter);
    return {
      id: r.id,
      x_metric: r.x_metric,
      y_metric: r.y_metric,
      x_label: r.x_label,
      y_label: r.y_label,
      lag_days: r.lag_days,
      r: r.r,
      n: r.n,
      p: r.p,
      ci_lower: ci.lower,
      ci_upper: ci.upper,
      ci_crosses_zero: ci.crossesZero,
      is_stable: isStable,
      natural_effect: naturalEffect,
      scatter: r.scatter,
      method: r.method || 'pearson',
      category: r.category
    };
  });

  const pValues = factors.map(f => f.p);
  const fdrSignificant = fdrCorrection(pValues, 0.10);

  const classified: ImpactFactor[] = factors.map((f, idx) => {
    let tier: 'confirmed' | 'probable' | 'hypothesis' | 'no_evidence' = 'no_evidence';
    const isSignificant = fdrSignificant[idx];
    const rAbs = Math.abs(f.r);

    if (f.n >= 25 && isSignificant && !f.ci_crosses_zero && f.is_stable && rAbs >= 0.25) {
      tier = 'confirmed';
    } else if (f.n >= 12 && f.p < 0.05 && f.is_stable && rAbs >= 0.20) {
      tier = 'probable';
    } else if (f.n >= 8 && f.p < 0.15 && rAbs >= 0.15) {
      tier = 'hypothesis';
    }

    const controllability = getControllability(f.x_metric);
    const stabilityWeight = f.is_stable ? 1.0 : 0.2;
    const significanceWeight = tier === 'confirmed' ? 1.0 : tier === 'probable' ? 0.7 : tier === 'hypothesis' ? 0.4 : 0.1;
    
    const decisionValue = significanceWeight * rAbs * stabilityWeight * controllability;

    return {
      ...f,
      evidence_level: tier,
      decision_value: +decisionValue.toFixed(4)
    };
  });

  return classified.sort((a, b) => b.decision_value - a.decision_value);
}
