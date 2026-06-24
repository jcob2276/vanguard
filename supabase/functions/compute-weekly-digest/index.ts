// Etap 6 (docs/PLAN_READINESS_NOOP.md, sekcja 4.11/4.12): NOOP port WeeklyDigest +
// ComparisonEngine (SeriesStat/PeriodComparison). Deterministyczny przegląd tydzień-do-
// tygodnia — inny mechanizm niż vanguard-week-recap (jakościowa narracja LLM), patrz 6a.
import { createServiceClient, corsHeaders, resolveUserScope } from "../_shared/supabase.ts"

const mean = (xs: number[]): number | null => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
const median = (xs: number[]): number | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const sampleSD = (xs: number[]): number | null => {
  if (xs.length < 2) return null
  const m = mean(xs)!
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1))
}
function slopePerDay(xs: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mx = (n - 1) / 2, my = mean(xs)!
  let sxx = 0, sxy = 0
  for (let i = 0; i < n; i++) { sxx += (i - mx) * (i - mx); sxy += (i - mx) * (xs[i] - my) }
  return sxx > 0 ? sxy / sxx : 0
}
function seriesStat(xs: number[]) {
  if (!xs.length) return null
  return {
    mean: mean(xs)!, median: median(xs)!, min: Math.min(...xs), max: Math.max(...xs),
    stdev: sampleSD(xs) ?? 0, n: xs.length, slope_per_day: +slopePerDay(xs).toFixed(3),
  }
}
function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  const dow = d.getUTCDay() // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Typical spread per metryka — PRZESKALOWANE z oryginału Strand (tam Charge/Effort/Rest
// to wszystkie 0-100; tu effort=strain_score jest 0-21, rest=total_sleep_hours w godzinach).
const TYPICAL_SPREAD: Record<string, number> = {
  charge: 12.0, effort: 2.5, rest: 1.0, rhr: 4.0, hrv: 8.0,
}
const FOCUS_THRESHOLD = 0.5, BALANCE_BAND = 10.0, MIN_DAYS_FOCUS = 3

const METRIC_LABEL_PL: Record<string, string> = {
  charge: 'Charge (recovery)', effort: 'Effort (strain)', rest: 'Sen (h)', rhr: 'RHR', hrv: 'HRV',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createServiceClient()
    const body = await req.json().catch(() => ({}))
    const { userId } = await resolveUserScope(req, body.userId ?? null)
    if (!userId) throw new Error('Missing userId')

    const now = new Date()
    const todayWarsaw = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
    const thisMonday = mondayOf(todayWarsaw)
    const lastMonday = addDays(thisMonday, -7)
    const lastSunday = addDays(thisMonday, -1)
    const baselineStart = addDays(thisMonday, -35) // 4 tygodnie PRZED zeszłym tygodniem
    const baselineEnd = addDays(thisMonday, -8)

    const { data: rows, error } = await supabase.from('daily_strain')
      .select('date, recovery_score, strain_score')
      .eq('user_id', userId).gte('date', baselineStart).lte('date', todayWarsaw).order('date')
    if (error) throw error
    const { data: ouraRows, error: ouraErr } = await supabase.from('oura_daily_summary')
      .select('date, rhr_avg, hrv_avg, total_sleep_hours')
      .eq('user_id', userId).gte('date', baselineStart).lte('date', todayWarsaw).order('date')
    if (ouraErr) throw ouraErr

    const byDate: Record<string, any> = {}
    for (const r of rows || []) byDate[r.date] = { ...byDate[r.date], charge: r.recovery_score, effort: r.strain_score }
    for (const r of ouraRows || []) byDate[r.date] = { ...byDate[r.date], rhr: r.rhr_avg, hrv: r.hrv_avg, rest: r.total_sleep_hours }

    const inRange = (date: string, start: string, end: string) => date >= start && date <= end
    const valuesFor = (metric: string, start: string, end: string) =>
      Object.entries(byDate).filter(([d]) => inRange(d, start, end)).map(([, v]) => v[metric]).filter((v): v is number => v != null) as number[]

    const metrics = ['charge', 'effort', 'rest', 'rhr', 'hrv']
    const perMetric: Record<string, any> = {}

    for (const metric of metrics) {
      const thisWeekVals = valuesFor(metric, thisMonday, todayWarsaw)
      const lastWeekVals = valuesFor(metric, lastMonday, lastSunday)
      const baselineVals = valuesFor(metric, baselineStart, baselineEnd)

      const thisWeek = seriesStat(thisWeekVals)
      const lastWeek = seriesStat(lastWeekVals)
      const baselineMean = mean(baselineVals)

      const delta = (thisWeek && lastWeek) ? thisWeek.mean - lastWeek.mean : null
      const pctChange = (delta != null && lastWeek && lastWeek.mean !== 0) ? (delta / Math.abs(lastWeek.mean)) * 100 : null
      const direction = delta == null ? 0 : delta > 0 ? 1 : delta < 0 ? -1 : 0
      const vsBaseline = (thisWeek && baselineMean != null) ? thisWeek.mean - baselineMean : null

      perMetric[metric] = { this_week: thisWeek, last_week: lastWeek, baseline_mean: baselineMean != null ? +baselineMean.toFixed(1) : null, delta: delta != null ? +delta.toFixed(1) : null, pct_change: pctChange != null ? +pctChange.toFixed(1) : null, direction, vs_baseline: vsBaseline != null ? +vsBaseline.toFixed(1) : null }
    }

    // ── Balance read: effort vs charge, znormalizowane do wspólnej skali 0-100 (effort*100/21) ──
    const chargeThisWeek = perMetric.charge.this_week
    const effortThisWeek = perMetric.effort.this_week
    let balance: { state: string; sentence: string }
    if (!chargeThisWeek || !effortThisWeek || chargeThisWeek.n < MIN_DAYS_FOCUS || effortThisWeek.n < MIN_DAYS_FOCUS) {
      balance = { state: 'insufficient', sentence: 'Za mało dni w tym tygodniu, żeby ocenić balans.' }
    } else {
      const effortNorm = effortThisWeek.mean * 100 / 21
      const diff = effortNorm - chargeThisWeek.mean
      if (diff > BALANCE_BAND) balance = { state: 'overreaching', sentence: 'Effort wyprzedza recovery — przeciążasz się względem regeneracji.' }
      else if (diff < -BALANCE_BAND) balance = { state: 'underloaded', sentence: 'Recovery przewyższa effort — masz przestrzeń, żeby dociążyć.' }
      else balance = { state: 'balanced', sentence: 'Effort i recovery w balansie.' }
    }

    // ── Focal points: top mover po normalizowanej zmianie tydzień-do-tygodnia ──
    const movers = metrics
      .filter(m => perMetric[m].this_week?.n >= MIN_DAYS_FOCUS && perMetric[m].last_week?.n >= MIN_DAYS_FOCUS && perMetric[m].delta != null)
      .map(m => ({ metric: m, normalized: Math.abs(perMetric[m].delta) / TYPICAL_SPREAD[m], delta: perMetric[m].delta }))
      .filter(m => m.normalized >= FOCUS_THRESHOLD)
      .sort((a, b) => b.normalized - a.normalized)

    const focalPoints: string[] = []
    if (movers.length === 0) {
      focalPoints.push('Spokojny tydzień — nic nie ruszyło się znacząco względem zeszłego tygodnia.')
    } else {
      for (const m of movers.slice(0, 2)) {
        const dir = m.delta > 0 ? 'wzrósł' : 'spadł'
        focalPoints.push(`${METRIC_LABEL_PL[m.metric]} ${dir} o ${Math.abs(m.delta)} (śr. ${perMetric[m.metric].this_week.mean.toFixed(1)} vs ${perMetric[m.metric].last_week.mean.toFixed(1)} zeszły tydz.)`)
      }
    }
    if (balance.state !== 'balanced' && balance.state !== 'insufficient') focalPoints.push(balance.sentence)

    const daysThisWeekSoFar = perMetric.charge.this_week?.n ?? 0
    if (daysThisWeekSoFar < MIN_DAYS_FOCUS) {
      focalPoints.length = 0
      focalPoints.push(`Tylko ${daysThisWeekSoFar} dni danych w tym tygodniu — zbyt wcześnie, żeby coś ocenić.`)
    }

    return new Response(JSON.stringify({
      success: true,
      week_start: thisMonday, days_so_far: daysThisWeekSoFar,
      metrics: perMetric, balance, focal_points: focalPoints,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    console.error('[weekly-digest] fatal', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
