import type { SeriesPoint } from './correlationEngine.ts'
import type { CorrelationCategory } from './correlationCatalog.ts'

export const DISCOVERY_MIN_COVERAGE = 5
export const DISCOVERY_LAGS = [0, 1, 2] as const
export const DISCOVERY_MAX_RESULTS = 80

/** Same-night sleep components — parts of one total; skip lag-0 pairs between them (trivial). */
const SLEEP_COMPOSITIONAL = new Set([
  'sleep_h', 'deep_sleep_h', 'rem_sleep_h', 'light_sleep_h', 'sleep_efficiency', 'sleep_score',
])

const SEN_METRICS = new Set([
  'sleep_h', 'sleep_score', 'sleep_efficiency', 'sleep_latency', 'deep_sleep_h', 'rem_sleep_h',
  'light_sleep_h', 'sleep_hr', 'sleep_hrv', 'sleep_lowest_hr', 'restless_periods', 'temp_deviation',
  'spo2', 'vo2max', 'stress_high_min', 'met_avg', 'sedentary_min', 'bedtime_hour', 'hrv', 'rhr',
  'readiness', 'recovery',
])

const ZYW_METRICS = new Set([
  'calories', 'protein', 'carbs', 'fat', 'sugar', 'fiber', 'insulin_load', 'food_quality', 'fueling',
  'caffeine_mg', 'caffeine_late_mg', 'last_coffee_hour', 'last_meal_hour', 'calories_late', 'alcohol_units',
])

const TRENING_METRICS = new Set([
  'strain', 'cns_load', 'leg_load', 'mental_load', 'cardio', 'strength', 'illness_score', 'steps',
  'workout_hr_peak', 'workout_hr_avg', 'workout_strain', 'run_hr', 'run_rpe', 'run_cadence',
  'run_suffer', 'run_distance_km',
])

const EKRAN_METRICS = new Set([
  'screen_time_min', 'fragmentation_index', 'productivity_ratio', 'phone_active_h',
  'dopamine_load_index', 'execution_score', 'identity_score', 'phone_drift',
])

const SUPLEMENTY_METRICS = new Set([
  'creatine_taken', 'omega3_taken', 'lions_mane_taken', 'd3_taken',
])

const ZACHOWANIE_METRICS = new Set([
  'mood_score', 'daily_rpe', 'energy_level', 'plan_done_pct', 'day_score',
  'friction_count', 'avoidance_count', 'procrastination_count', 'travel_day', 'illness_day',
  'stress_manual', 'habit_count', 'weight_kg',
])

export function behaviorMetricId(behaviorKey: string): string {
  const slug = behaviorKey.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `behav__${slug || 'unknown'}`
}

export function behaviorMetricLabel(behaviorKey: string): string {
  return behaviorKey.replace(/_/g, ' ')
}

export function appendBehaviorLogMetrics(
  series: Record<string, SeriesPoint[]>,
  behaviorRows: { date: string; behavior_key: string; value: number | null }[],
  labels: Record<string, string>,
): void {
  const CANONICAL = /alcohol|alkohol|^travel$|^podroz$|illness|choroba|stress|stres/
  const byMetricDay: Record<string, Record<string, number>> = {}
  for (const row of behaviorRows) {
    const key = row.behavior_key.toLowerCase()
    if (CANONICAL.test(key)) continue
    const id = behaviorMetricId(row.behavior_key)
    labels[id] = behaviorMetricLabel(row.behavior_key)
    const val = row.value ?? 1
    ;(byMetricDay[id] ||= {})[row.date] = val
  }
  for (const [id, days] of Object.entries(byMetricDay)) {
    series[id] = Object.entries(days).map(([day, value]) => ({ day, value }))
  }
}

function hasVariance(points: SeriesPoint[], minCoverage: number): boolean {
  if (points.length < minCoverage) return false
  let min = Infinity
  let max = -Infinity
  for (const p of points) {
    if (p.value < min) min = p.value
    if (p.value > max) max = p.value
  }
  return max - min > 1e-9
}

export function scannableMetrics(
  series: Record<string, SeriesPoint[]>,
  minCoverage = DISCOVERY_MIN_COVERAGE,
): string[] {
  return Object.entries(series)
    .filter(([, pts]) => hasVariance(pts, minCoverage))
    .map(([k]) => k)
    .sort()
}

export function inferMetricCategory(metric: string): CorrelationCategory {
  if (metric.startsWith('behav__')) return 'zachowanie'
  if (SEN_METRICS.has(metric)) return 'sen'
  if (ZYW_METRICS.has(metric)) return 'zywienie'
  if (TRENING_METRICS.has(metric)) return 'trening'
  if (EKRAN_METRICS.has(metric)) return 'ekran'
  if (SUPLEMENTY_METRICS.has(metric)) return 'suplementy'
  if (ZACHOWANIE_METRICS.has(metric)) return 'zachowanie'
  return 'regeneracja'
}

export function shouldSkipDiscoveryPair(x: string, y: string, lagDays: number): boolean {
  if (x === y) return true
  if (lagDays === 0 && SLEEP_COMPOSITIONAL.has(x) && SLEEP_COMPOSITIONAL.has(y)) return true
  return false
}

/** Passes initial compute gate — interest filter applied later. */
export function passesDiscoveryGate(r_abs: number, n: number, p: number): boolean {
  if (n < 6) return false
  if (p < 0.05 && n >= 8) return true
  if (r_abs >= 0.32 && n >= 8) return true
  if (r_abs >= 0.42 && n >= 6 && p < 0.12) return true
  return false
}

export function isCrossDomainPair(x: string, y: string): boolean {
  return inferMetricCategory(x) !== inferMetricCategory(y)
}

export function discoveryScore(r_abs: number, n: number, p: number, crossDomain: boolean): number {
  let score = r_abs * 100 + Math.min(n, 40) * 0.6
  if (p < 0.05) score += 35
  if (p < 0.01) score += 15
  if (crossDomain) score += 20
  return score
}
