import { createServiceClient, corsHeaders, resolveUserScope } from '../_shared/supabase.ts'
import {
  confidenceTier, dualCorrelation, interpretR, laggedPairs, type CorrelationMethod, type ScatterPoint,
} from '../_shared/correlationEngine.ts'
import { METRIC_LABELS, type CorrelationCategory } from '../_shared/correlationCatalog.ts'
import {
  appendBehaviorLogMetrics, appendHabitLogMetrics, discoveryScore, DISCOVERY_LAGS, DISCOVERY_MAX_RESULTS,
  inferMetricCategory, isCrossDomainPair, passesDiscoveryGate, scannableMetrics, shouldSkipDiscoveryPair,
} from '../_shared/correlationDiscovery.ts'
import { aggregateStravaRuns, buildMetricSeries } from '../_shared/correlationSeries.ts'
import { correlationInterestScore, isInterestingCorrelation } from '../_shared/correlationInterest.ts'
import { getWarsawDateString } from '../_shared/time.ts'

interface CorrelationResult {
  id: string
  category: CorrelationCategory
  label: string
  note: string
  x_metric: string
  y_metric: string
  x_label: string
  y_label: string
  lag_days: number
  method: CorrelationMethod
  r: number
  r_pearson: number | null
  r_spearman: number | null
  r_abs: number
  n: number
  p: number
  significant: boolean
  confidence: 'calibrating' | 'building' | 'solid'
  has_enough_data: boolean
  slope: number
  intercept: number
  interpretation: string
  discovered: boolean
  cross_domain: boolean
  scatter: ScatterPoint[]
}

function pairKey(x: string, y: string, lag: number) {
  return `${x}|${y}|${lag}`
}

function labelFor(metric: string, labels: Record<string, string>): string {
  return labels[metric] ?? METRIC_LABELS[metric] ?? metric.replace(/^behav__/, '').replace(/_/g, ' ')
}

function buildResult(
  xMetric: string,
  yMetric: string,
  lagDays: number,
  dual: ReturnType<typeof dualCorrelation>,
  scatter: ScatterPoint[],
  labels: Record<string, string>,
  crossDomain: boolean,
): CorrelationResult | null {
  const primary = dual.primary
  if (!primary) return null
  const significant = primary.p < 0.05 && primary.n >= 10
  const xLabel = labelFor(xMetric, labels)
  const yLabel = labelFor(yMetric, labels)
  const lagSuffix = lagDays > 0 ? ` (+${lagDays}d)` : ''
  return {
    id: `disc_${xMetric}_${yMetric}_${lagDays}d`,
    category: inferMetricCategory(xMetric),
    label: `${xLabel} → ${yLabel}${lagSuffix}`,
    note: crossDomain
      ? 'Odkryte skanowanie — para między domenami (Pearson/Spearman, wybrano silniejszą).'
      : 'Odkryte skanowanie — para w Twoich logach (Pearson/Spearman, wybrano silniejszą).',
    x_metric: xMetric,
    y_metric: yMetric,
    x_label: xLabel,
    y_label: yLabel,
    lag_days: lagDays,
    method: dual.method,
    r: +primary.r.toFixed(3),
    r_pearson: dual.pearson ? +dual.pearson.r.toFixed(3) : null,
    r_spearman: dual.spearman ? +dual.spearman.r.toFixed(3) : null,
    r_abs: +Math.abs(primary.r).toFixed(3),
    n: primary.n,
    p: +primary.p.toFixed(4),
    significant,
    confidence: confidenceTier(primary.n),
    has_enough_data: primary.n >= 6,
    slope: +primary.slope.toFixed(4),
    intercept: +primary.intercept.toFixed(2),
    interpretation: interpretR(primary.r),
    discovered: true,
    cross_domain: crossDomain,
    scatter: scatter.slice(-60),
  }
}

function computePair(
  series: Record<string, { day: string; value: number }[]>,
  xMetric: string,
  yMetric: string,
  lagDays: number,
) {
  const x = series[xMetric]
  const y = series[yMetric]
  if (!x?.length || !y?.length) return null
  const { pairs, scatter } = laggedPairs(x, y, lagDays)
  if (pairs.length < 6) return null
  const dual = dualCorrelation(pairs)
  return dual.primary ? { dual, scatter } : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createServiceClient()
    const body = await req.json().catch(() => ({}))
    const { userId } = await resolveUserScope(req, body.userId ?? null)
    const includeWeak = body.include_weak === true
    if (!userId) throw new Error('Missing userId')

    const now = new Date()
    const todayWarsaw = getWarsawDateString(now)
    const start90 = (() => {
      const d = new Date(todayWarsaw + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() - 90)
      return d.toISOString().slice(0, 10)
    })()

    const [
      strainR, ouraR, ouraEnhR, nutrR, aggregatesR, frictionR, foodR, workoutR,
      winsR, reconR, behaviorR, suppLogR, suppR, stravaR, awR, habitR, bodyR, habitLogR,
    ] = await Promise.all([
      supabase.from('daily_strain')
        .select('date, strain_score, recovery_score, fueling_score, cardio_load, strength_load, cns_load, leg_load, mental_load_score, illness_score, components')
        .eq('user_id', userId).gte('date', start90).order('date'),
      supabase.from('oura_daily_summary')
        .select('date, hrv_avg, rhr_avg, readiness_score, total_sleep_hours, sleep_score')
        .eq('user_id', userId).gte('date', start90).order('date'),
      supabase.from('oura_enhanced')
        .select('date, sleep_efficiency, sleep_latency_minutes, deep_sleep_hours, rem_sleep_hours, light_sleep_hours, sleep_average_heart_rate, sleep_average_hrv, sleep_lowest_heart_rate, restless_periods, temperature_deviation, spo2_percentage, vo2_max, stress_high_minutes, average_met_minutes, sedentary_minutes, bedtime_start')
        .eq('user_id', userId).gte('date', start90).order('date'),
      supabase.from('daily_nutrition')
        .select('date, calories, protein, carbs, fat, sugar, fiber, insulin_load, avg_food_quality')
        .eq('user_id', userId).gte('date', start90).order('date'),
      supabase.from('vanguard_daily_aggregates')
        .select('date, execution_score, identity_score, dopamine_load_index, screen_time_min, fragmentation_index')
        .eq('user_id', userId).gte('date', start90).order('date'),
      supabase.from('friction_events')
        .select('occurred_at, friction_type')
        .eq('user_id', userId).gte('occurred_at', start90 + 'T00:00:00Z'),
      supabase.from('daily_food_entries')
        .select('date, name, logged_at, calories')
        .eq('user_id', userId).gte('date', start90).order('date'),
      supabase.from('workout_sessions')
        .select('workout_day, hr_avg_bpm, hr_peak_bpm, hr_strain_score')
        .eq('user_id', userId).gte('workout_day', start90),
      supabase.from('daily_wins')
        .select('date, mood_score, daily_rpe, done_1, done_2, done_3, done_4, done_5, task_1, task_2, task_3, task_4, task_5')
        .eq('user_id', userId).gte('date', start90).order('date'),
      supabase.from('daily_reconciliations')
        .select('date, day_score, phone_drift_morning')
        .eq('user_id', userId).gte('date', start90),
      supabase.from('behavior_log')
        .select('date, behavior_key, value')
        .eq('user_id', userId).gte('date', start90),
      supabase.from('supplement_logs')
        .select('date, supplement_id')
        .eq('user_id', userId).gte('date', start90),
      supabase.from('supplements')
        .select('id, slug')
        .eq('user_id', userId),
      supabase.from('strava_activities_clean')
        .select('start_date, sport_type, hr_avg, perceived_exertion, cadence_spm, suffer_score, distance, is_oura')
        .eq('user_id', userId).gte('start_date', start90 + 'T00:00:00Z'),
      supabase.from('aw_daily_summary')
        .select('date, productivity_ratio, phone_active_seconds')
        .eq('user_id', userId).gte('date', start90),
      supabase.from('daily_habits')
        .select('date, bar_hang, child_pose, chin_tucks, couch_stretch, glute_bridge, protein_170g')
        .eq('user_id', userId).gte('date', start90),
      supabase.from('body_metrics')
        .select('date, weight')
        .eq('user_id', userId).gte('date', start90).order('date'),
      supabase.from('habit_logs')
        .select('date, completed, habits(name)')
        .eq('user_id', userId).gte('date', start90),
    ])

    const slugMap = new Map((suppR.data ?? []).map(s => [s.id, s.slug]))
    const supplementRows = (suppLogR.data ?? []).map(row => ({
      date: row.date,
      slug: slugMap.get(row.supplement_id) ?? 'unknown',
    }))

    const stravaRows = aggregateStravaRuns(stravaR.data ?? [], todayWarsaw, start90)
    const behaviorRows = behaviorR.data ?? []

    const series = buildMetricSeries({
      todayWarsaw,
      strainRows: strainR.data ?? [],
      ouraRows: ouraR.data ?? [],
      ouraEnhRows: ouraEnhR.data ?? [],
      nutrRows: nutrR.data ?? [],
      aggregateRows: aggregatesR.data ?? [],
      frictionRows: frictionR.data ?? [],
      foodRows: foodR.data ?? [],
      workoutRows: workoutR.data ?? [],
      winsRows: winsR.data ?? [],
      reconRows: (reconR.data ?? []).map(r => ({ date: r.date, day_score: r.day_score, phone_drift_morning: r.phone_drift_morning })),
      behaviorRows,
      supplementRows,
      stravaRows,
      awRows: awR.data ?? [],
      habitRows: habitR.data ?? [],
      bodyRows: bodyR.data ?? [],
    })

    const habitLogRows = (habitLogR.data ?? []).flatMap(row => {
      const name = (row.habits as { name?: string } | null)?.name
      if (!name || !row.date) return []
      return [{ date: row.date, habit_name: name, completed: row.completed }]
    })

    const runtimeLabels: Record<string, string> = {}
    appendBehaviorLogMetrics(series, behaviorRows, runtimeLabels)
    appendHabitLogMetrics(series, habitLogRows, runtimeLabels)
    const labels = { ...METRIC_LABELS, ...runtimeLabels }

    const metrics = scannableMetrics(series)
    const candidates: CorrelationResult[] = []
    const seen = new Set<string>()

    for (const xMetric of metrics) {
      for (const yMetric of metrics) {
        for (const lagDays of DISCOVERY_LAGS) {
          if (shouldSkipDiscoveryPair(xMetric, yMetric, lagDays)) continue
          const pk = pairKey(xMetric, yMetric, lagDays)
          if (seen.has(pk)) continue

          const computed = computePair(series, xMetric, yMetric, lagDays)
          if (!computed) continue
          const p = computed.dual.primary!
          if (!passesDiscoveryGate(Math.abs(p.r), p.n, p.p)) continue

          const crossDomain = isCrossDomainPair(xMetric, yMetric)
          const row = buildResult(xMetric, yMetric, lagDays, computed.dual, computed.scatter, labels, crossDomain)
          if (!row) continue

          candidates.push(row)
          seen.add(pk)
        }
      }
    }

    candidates.sort((a, b) => {
      const scoreA = discoveryScore(a.r_abs, a.n, a.p, a.cross_domain)
      const scoreB = discoveryScore(b.r_abs, b.n, b.p, b.cross_domain)
      return scoreB - scoreA
    })

    const capped = candidates.slice(0, DISCOVERY_MAX_RESULTS * 3)
    const computedTotal = capped.length
    const interesting = capped.filter(r => isInterestingCorrelation({
      ...r,
      x_metric: r.x_metric,
      y_metric: r.y_metric,
    }))
    interesting.sort((a, b) => correlationInterestScore(b) - correlationInterestScore(a))
    const output = (includeWeak ? capped : interesting).slice(0, DISCOVERY_MAX_RESULTS)

    output.sort((a, b) => correlationInterestScore(b) - correlationInterestScore(a))

    const coverage: Record<string, number> = {}
    for (const [k, v] of Object.entries(series)) coverage[k] = v.length

    const stats = {
      total_pairs: output.length,
      computed_total: computedTotal,
      pairs_scanned: seen.size,
      hidden_weak: includeWeak ? 0 : Math.max(0, computedTotal - interesting.length),
      significant: output.filter(r => r.significant).length,
      discovered: output.length,
      cross_domain: output.filter(r => r.cross_domain).length,
      spearman_primary: output.filter(r => r.method === 'spearman').length,
      metrics_tracked: metrics.length,
    }

    return new Response(
      JSON.stringify({ success: true, results: output, coverage, stats, window_days: 90, filtered: !includeWeak, mode: 'discovery' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[compute-correlations]', err)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
