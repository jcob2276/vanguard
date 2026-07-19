
import {
  confidenceTier, dualCorrelation, interpretR, laggedPairs, type CorrelationMethod, type ScatterPoint,
  classifyImpactFactors,
} from '../correlationEngine.ts'
import { METRIC_LABELS, type CorrelationCategory } from '../correlationCatalog.ts'
import {
  appendBehaviorLogMetrics, appendHabitLogMetrics, discoveryScore, DISCOVERY_LAGS, DISCOVERY_MAX_RESULTS,
  inferMetricCategory, isCrossDomainPair, passesDiscoveryGate, scannableMetrics, shouldSkipDiscoveryPair,
} from '../correlationDiscovery.ts'
import { buildMetricSeries } from '../correlationSeries.ts'
import { correlationInterestScore, isInterestingCorrelation } from '../correlationInterest.ts'
import { getWarsawDateString } from '../time.ts'
import { fetchAndPrepareCorrelationData } from './correlationsDataFetcher.ts'

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
  confoundedDays: Set<string>,
) {
  const x = series[xMetric]
  const y = series[yMetric]
  if (!x?.length || !y?.length) return null
  let { pairs, scatter } = laggedPairs(x, y, lagDays)

  const isConfounderX = xMetric === 'travel_day' || xMetric.includes('illness')
  if (!isConfounderX && confoundedDays.size > 0) {
    const newPairs: [number, number][] = []
    const newScatter: ScatterPoint[] = []
    for (const p of scatter) {
      if (!confoundedDays.has(p.day)) {
        newScatter.push(p)
        newPairs.push([p.x, p.y])
      }
    }
    pairs = newPairs
    scatter = newScatter
  }

  if (pairs.length < 6) return null
  const dual = dualCorrelation(pairs)
  return dual.primary ? { dual, scatter } : null
}

export const runComputeCorrelations = async (
  supabase: any,
  userId: string,
  includeWeak = false
): Promise<{ success: boolean; results: any[]; coverage: any; stats: any; window_days: number; filtered: boolean; mode: string }> => {
  try {
    const now = new Date()
    const todayWarsaw = getWarsawDateString(now)
    const start90 = (() => {
      const d = new Date(todayWarsaw + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() - 90)
      return d.toISOString().slice(0, 10)
    })()

    const { data: prepared, habitLogR } = await fetchAndPrepareCorrelationData(supabase, userId, start90, todayWarsaw);

    const series = buildMetricSeries({
      todayWarsaw,
      strainRows: prepared.strainRows,
      ouraRows: prepared.ouraRows,
      ouraEnhRows: prepared.ouraEnhRows,
      nutrRows: prepared.nutrRows,
      aggregateRows: prepared.aggregateRows,
      frictionRows: prepared.frictionRows,
      foodRows: prepared.foodRows,
      workoutRows: prepared.workoutRows,
      winsRows: prepared.winsRows,
      reconRows: prepared.reconRows,
      behaviorRows: prepared.behaviorRows,
      supplementRows: prepared.supplementRows,
      stravaRows: prepared.stravaRows,
      awRows: prepared.awRows,
      habitRows: [],
      bodyRows: prepared.bodyRows,
    })

    const habitLogRows = (habitLogR.data ?? []).flatMap((row: any) => {
      const name = (row.habits as { name?: string } | null)?.name
      if (!name || !row.date) return []
      return [{ date: row.date, habit_name: name, completed: row.completed }]
    })

    const runtimeLabels: Record<string, string> = {}
    appendBehaviorLogMetrics(series, prepared.behaviorRows, runtimeLabels)
    appendHabitLogMetrics(series, habitLogRows, runtimeLabels)
    const labels = { ...METRIC_LABELS, ...runtimeLabels }

    const metrics = scannableMetrics(series)
    const candidates: CorrelationResult[] = []
    const seen = new Set<string>()

    const travelDays = new Set(series.travel_day?.filter(p => p.value > 0).map(p => p.day) ?? [])
    const illnessDays = new Set([
      ...(series.illness_day?.filter(p => p.value > 0).map(p => p.day) ?? []),
      ...(series.illness_score?.filter(p => p.value > 0).map(p => p.day) ?? [])
    ])
    const confoundedDays = new Set([...travelDays, ...illnessDays])

    for (const xMetric of metrics) {
      for (const yMetric of metrics) {
        for (const lagDays of DISCOVERY_LAGS) {
          if (shouldSkipDiscoveryPair(xMetric, yMetric, lagDays)) continue
          const pk = pairKey(xMetric, yMetric, lagDays)
          if (seen.has(pk)) continue
          const computed = computePair(series, xMetric, yMetric, lagDays, confoundedDays)
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
    candidates.sort((a, b) => discoveryScore(b.r_abs, b.n, b.p, b.cross_domain) - discoveryScore(a.r_abs, a.n, a.p, a.cross_domain))

    const capped = candidates.slice(0, DISCOVERY_MAX_RESULTS * 3)
    const computedTotal = capped.length
    const interesting = capped.filter(r => isInterestingCorrelation({
      ...r,
      x_metric: r.x_metric,
      y_metric: r.y_metric,
    }))
    interesting.sort((a, b) => correlationInterestScore(b) - correlationInterestScore(a))

    const classified = classifyImpactFactors(interesting)
    const confirmed = classified.filter(f => f.evidence_level === 'confirmed')

    // Bridge: save top 10 confirmed correlations as entity links
    for (const f of confirmed.slice(0, 10)) {
      const xLabel = labels[f.x_metric] ?? f.x_metric, yLabel = labels[f.y_metric] ?? f.y_metric;
      const lagText = f.lag_days > 0 ? ` z opóźnieniem ${f.lag_days}d` : '';
      const fact_text = `${xLabel} koreluje z ${yLabel}${lagText} (${f.natural_effect})`;
      const { error: upsertErr } = await supabase.from('vanguard_entity_links').upsert({
        user_id: userId, source_entity: xLabel, source_type: 'metric', relation: 'koreluje_z',
        target_entity: yLabel, target_type: 'metric', confidence_score: f.r, memory_type: 'correlation',
        status: 'active', temporal_status: 'current', fact_text,
        metadata: { x_metric: f.x_metric, y_metric: f.y_metric, lag_days: f.lag_days, r: f.r, p: f.p, n: f.n, discovered_at: new Date().toISOString() },
      }, { onConflict: 'user_id,source_entity,relation,target_entity' });
      if (upsertErr) console.error(`[correlations] Failed to save correlation link: ${upsertErr.message}`);
    }

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

    return { success: true, results: output, coverage, stats, window_days: 90, filtered: !includeWeak, mode: 'discovery' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[compute-correlations]', err)
    throw new Error(message)
  }
}
