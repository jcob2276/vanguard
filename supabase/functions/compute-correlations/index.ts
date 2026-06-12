import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders, resolveUserScope } from '../_shared/supabase.ts'

// ── NOOP port: CorrelationEngine (CorrelationEngine.swift) ──────────────────
// Pearson r + OLS slope/intercept + approximate two-sided p-value.
// Lagged variant: x[D] vs y[D+lag] to probe delayed effects.

interface Correlation {
  r: number        // Pearson [-1, 1]
  n: number        // pairs used
  p: number        // two-sided p-value (normal approx)
  slope: number    // OLS y on x
  intercept: number
}

// erf(x) — Abramowitz & Stegun 7.1.26, |error| ≤ 1.5e-7
function erfApprox(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax)
  return sign * y
}

function normalCDF(z: number): number {
  return 0.5 * (1 + erfApprox(z / Math.sqrt(2)))
}

function pValue(r: number, n: number): number {
  if (n <= 2) return 1
  const oneMinusR2 = 1 - r * r
  if (oneMinusR2 <= 0) return 0
  const t = r * Math.sqrt((n - 2) / oneMinusR2)
  return 2 * (1 - normalCDF(Math.abs(t)))
}

function pearson(xy: [number, number][]): Correlation | null {
  const n = xy.length
  if (n < 3) return null
  const nd = n

  let sumX = 0, sumY = 0
  for (const [x, y] of xy) { sumX += x; sumY += y }
  const meanX = sumX / nd, meanY = sumY / nd

  let sxx = 0, syy = 0, sxy = 0
  for (const [x, y] of xy) {
    const dx = x - meanX, dy = y - meanY
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy
  }
  if (sxx <= 0 || syy <= 0) return null

  let r = sxy / (Math.sqrt(sxx) * Math.sqrt(syy))
  r = Math.max(-1, Math.min(1, r))

  const slope = sxy / sxx
  const intercept = meanY - slope * meanX
  return { r, n, p: pValue(r, n), slope, intercept }
}

function shiftDay(day: string, delta: number): string | null {
  if (delta === 0) return day
  const d = new Date(day + 'T12:00:00Z')
  if (isNaN(d.getTime())) return null
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function lagged(
  x: { day: string; value: number }[],
  y: { day: string; value: number }[],
  lagDays: number
): Correlation | null {
  const mapY: Record<string, number> = {}
  for (const row of y) mapY[row.day] = row.value

  const pairs: [number, number][] = []
  for (const row of x.sort((a, b) => a.day.localeCompare(b.day))) {
    const shifted = shiftDay(row.day, lagDays)
    if (shifted && mapY[shifted] != null) {
      pairs.push([row.value, mapY[shifted]])
    }
  }
  return pearson(pairs)
}

// ── Correlation spec ────────────────────────────────────────────────────────

interface CorrelationSpec {
  id: string
  label: string        // human-readable, PL
  xMetric: string
  yMetric: string
  lagDays: number
  note: string         // context why this matters
}

const SPECS: CorrelationSpec[] = [
  // Recovery / regeneracja
  { id: 'strain_recovery_1d',    label: 'Strain dziś → Recovery jutro',      xMetric: 'strain',    yMetric: 'recovery',  lagDays: 1,  note: 'Czy ciężki trening obniża jutrzejsze recovery?' },
  { id: 'strain_recovery_2d',    label: 'Strain dziś → Recovery pojutrze',   xMetric: 'strain',    yMetric: 'recovery',  lagDays: 2,  note: 'Opóźniona odpowiedź regeneracyjna (DOMS)' },
  { id: 'strain_hrv_1d',         label: 'Strain dziś → HRV jutro',           xMetric: 'strain',    yMetric: 'hrv',       lagDays: 1,  note: 'Wpływ obciążenia na autonomiczny układ nerwowy' },
  { id: 'recovery_strain_0d',    label: 'Recovery → Strain tego dnia',       xMetric: 'recovery',  yMetric: 'strain',    lagDays: 0,  note: 'Czy lepsze recovery → cięższy trening?' },
  { id: 'sleep_recovery_0d',     label: 'Sen → Recovery',                    xMetric: 'sleep_h',   yMetric: 'recovery',  lagDays: 0,  note: 'Prosta korelacja sen–recovery' },
  { id: 'sleep_hrv_0d',          label: 'Sen → HRV',                         xMetric: 'sleep_h',   yMetric: 'hrv',       lagDays: 0,  note: 'Długość snu vs zmienność rytmu serca' },
  // Żywienie → regeneracja
  { id: 'protein_hrv_1d',        label: 'Białko dziś → HRV jutro',           xMetric: 'protein',   yMetric: 'hrv',       lagDays: 1,  note: 'Makroskładnik z najsilniejszym sygnałem anabolicznym' },
  { id: 'protein_recovery_1d',   label: 'Białko dziś → Recovery jutro',      xMetric: 'protein',   yMetric: 'recovery',  lagDays: 1,  note: 'Czy dobre odżywienie białkowe wspiera regenerację?' },
  { id: 'calories_recovery_1d',  label: 'Kalorie dziś → Recovery jutro',     xMetric: 'calories',  yMetric: 'recovery',  lagDays: 1,  note: 'Ujemna korelacja = underfueling obniża recovery' },
  { id: 'carbs_recovery_1d',     label: 'Węgle dziś → Recovery jutro',       xMetric: 'carbs',     yMetric: 'recovery',  lagDays: 1,  note: 'Ważne dla biegaczy: glikogen vs regeneracja' },
  { id: 'fueling_recovery_1d',   label: 'Fueling score → Recovery jutro',    xMetric: 'fueling',   yMetric: 'recovery',  lagDays: 1,  note: 'Kompozytowy wskaźnik żywienia vs regeneracja' },
  { id: 'calories_hrv_1d',       label: 'Kalorie dziś → HRV jutro',          xMetric: 'calories',  yMetric: 'hrv',       lagDays: 1,  note: 'Niedojadanie jako stresor autonomiczny' },
  // Aktywność → zdrowie
  { id: 'steps_recovery_1d',     label: 'Kroki dziś → Recovery jutro',       xMetric: 'steps',     yMetric: 'recovery',  lagDays: 1,  note: 'NEAT: lekka aktywność vs regeneracja' },
  { id: 'cardio_hrv_1d',         label: 'Cardio load → HRV jutro',           xMetric: 'cardio',    yMetric: 'hrv',       lagDays: 1,  note: 'Intensywność cardio vs ANS' },
  { id: 'strength_recovery_1d',  label: 'Siłownia → Recovery jutro',         xMetric: 'strength',  yMetric: 'recovery',  lagDays: 1,  note: 'Czy ciężka siłownia obniża recovery?' },
]

// ── Label helpers ────────────────────────────────────────────────────────────

function interpretR(r: number): string {
  const a = Math.abs(r)
  const dir = r > 0 ? 'pozytywna' : 'negatywna'
  if (a >= 0.5) return `silna ${dir}`
  if (a >= 0.3) return `umiarkowana ${dir}`
  if (a >= 0.1) return `słaba ${dir}`
  return 'brak korelacji'
}

// ── Main ─────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createServiceClient()
    const body = await req.json().catch(() => ({}))
    const { userId } = await resolveUserScope(req, body.userId ?? null)
    if (!userId) throw new Error('Missing userId')

    const now = new Date()
    const start90 = new Date(now.getTime() - 90 * 864e5)
      .toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })

    // ── Fetch all source series ────────────────────────────────────────────
    const [strainR, ouraR, nutrR] = await Promise.all([
      supabase.from('daily_strain')
        .select('date, strain_score, recovery_score, fueling_score, cardio_load, strength_load, components')
        .eq('user_id', userId).gte('date', start90).order('date'),
      supabase.from('oura_daily_summary')
        .select('date, hrv_avg, rhr_avg, readiness_score, total_sleep_hours')
        .eq('user_id', userId).gte('date', start90).order('date'),
      supabase.from('daily_nutrition')
        .select('date, calories, protein, carbs')
        .eq('user_id', userId).gte('date', start90).order('date'),
    ])

    // ── Build metric series ────────────────────────────────────────────────
    type Series = { day: string; value: number }[]
    const series: Record<string, Series> = {
      strain: [], recovery: [], fueling: [], cardio: [], strength: [],
      hrv: [], rhr: [], sleep_h: [],
      calories: [], protein: [], carbs: [], steps: [],
    }

    for (const r of strainR.data ?? []) {
      if (r.strain_score   != null) series.strain.push({ day: r.date, value: Number(r.strain_score) })
      if (r.recovery_score != null) series.recovery.push({ day: r.date, value: Number(r.recovery_score) })
      if (r.fueling_score  != null) series.fueling.push({ day: r.date, value: Number(r.fueling_score) })
      if (r.cardio_load    != null) series.cardio.push({ day: r.date, value: Number(r.cardio_load) })
      if (r.strength_load  != null) series.strength.push({ day: r.date, value: Number(r.strength_load) })
      const steps = (r.components as any)?.steps
      if (steps != null) series.steps.push({ day: r.date, value: Number(steps) })
    }
    for (const r of ouraR.data ?? []) {
      if (r.hrv_avg          != null) series.hrv.push({ day: r.date, value: Number(r.hrv_avg) })
      if (r.rhr_avg          != null) series.rhr.push({ day: r.date, value: Number(r.rhr_avg) })
      if (r.total_sleep_hours != null) series.sleep_h.push({ day: r.date, value: Number(r.total_sleep_hours) })
    }
    for (const r of nutrR.data ?? []) {
      if (r.calories != null) series.calories.push({ day: r.date, value: Number(r.calories) })
      if (r.protein  != null) series.protein.push({ day: r.date, value: Number(r.protein) })
      if (r.carbs    != null) series.carbs.push({ day: r.date, value: Number(r.carbs) })
    }

    // ── Compute all specs ──────────────────────────────────────────────────
    const results = []
    for (const spec of SPECS) {
      const x = series[spec.xMetric]
      const y = series[spec.yMetric]
      if (!x?.length || !y?.length) continue

      const cor = lagged(x, y, spec.lagDays)
      if (!cor) continue

      results.push({
        id: spec.id,
        label: spec.label,
        note: spec.note,
        x_metric: spec.xMetric,
        y_metric: spec.yMetric,
        lag_days: spec.lagDays,
        r: +cor.r.toFixed(3),
        r_abs: +Math.abs(cor.r).toFixed(3),
        n: cor.n,
        p: +cor.p.toFixed(4),
        significant: cor.p < 0.05 && cor.n >= 10,
        slope: +cor.slope.toFixed(4),
        intercept: +cor.intercept.toFixed(2),
        interpretation: interpretR(cor.r),
      })
    }

    // Sort: significant first, then by |r| desc
    results.sort((a, b) => {
      if (a.significant !== b.significant) return a.significant ? -1 : 1
      return b.r_abs - a.r_abs
    })

    // Series lengths for context
    const coverage: Record<string, number> = {}
    for (const [k, v] of Object.entries(series)) coverage[k] = v.length

    return new Response(
      JSON.stringify({ success: true, results, coverage, window_days: 90 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('[compute-correlations]', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
