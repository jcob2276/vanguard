// Etap 6 (docs/PLAN_READINESS_NOOP.md, sekcja 4.10): NOOP port RecoveryForecast.
// Wieczorna projekcja recovery na jutro rano: strain debt + sleep adequacy + mean reversion.
import { createServiceClient, corsHeaders, resolveUserScope } from "../_shared/supabase.ts"

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const mean = (xs: number[]): number | null => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
const sampleSD = (xs: number[]): number | null => {
  if (xs.length < 2) return null
  const m = mean(xs)!
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1))
}
// OLS slope vs 0-based day index (ComparisonEngine.swift SeriesStat.slopePerDay)
function slopePerDay(xs: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mx = (n - 1) / 2
  const my = mean(xs)!
  let sxx = 0, sxy = 0
  for (let i = 0; i < n; i++) { sxx += (i - mx) * (i - mx); sxy += (i - mx) * (xs[i] - my) }
  return sxx > 0 ? sxy / sxx : 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createServiceClient()
    const body = await req.json().catch(() => ({}))
    const { userId } = await resolveUserScope(req, body.userId ?? null)
    if (!userId) throw new Error('Missing userId')
    const plannedSleepHours: number | null = body.plannedSleepHours ?? null
    const needSleepHours: number = body.needSleepHours ?? 8.0 // brak dedykowanego pola "sleep need" w schemacie — 8h jako rozsądny default

    const now = new Date()
    const todayWarsaw = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
    const start14 = (() => { const d = new Date(todayWarsaw + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 13); return d.toISOString().slice(0, 10) })()

    const { data: rows, error } = await supabase.from('daily_strain')
      .select('date, recovery_score, strain_score')
      .eq('user_id', userId).gte('date', start14).lte('date', todayWarsaw).order('date')
    if (error) throw error

    const recoveryVals = (rows || []).map((r: any) => r.recovery_score).filter((v: any): v is number => v != null) as number[]
    const strainVals = (rows || []).map((r: any) => r.strain_score).filter((v: any): v is number => v != null) as number[]
    const nights = recoveryVals.length

    if (nights < 3) {
      return new Response(JSON.stringify({
        success: true, forecast: null, confidence: 'calibrating',
        note: `Za mało historii (${nights} dni) na prognozę — potrzeba min. 3 dni recovery.`
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const center = mean(recoveryVals)!
    const meanEffort = mean(strainVals) ?? 0
    const todayRow = (rows || []).find((r: any) => r.date === todayWarsaw)
    const todayEffort = todayRow?.strain_score != null ? Number(todayRow.strain_score) : meanEffort

    // adj_strain: skala 0-21 (nie 0-100 jak w Strand) — effortSpread przeskalowane proporcjonalnie (12*21/100≈2.5)
    const EFFORT_SPREAD = 2.5, STRAIN_WEIGHT = 9.0 * (2.5 / 12.0), STRAIN_CAP = 12.0 * (2.5 / 12.0)
    const adjStrain = clamp(-STRAIN_WEIGHT * (todayEffort - meanEffort) / EFFORT_SPREAD, -STRAIN_CAP, STRAIN_CAP)

    // adj_sleep: tylko jeśli przekazano plannedSleepHours (brak UI do tego jeszcze — opcjonalny param)
    let adjSleep = 0
    if (plannedSleepHours != null) {
      const sleepRatio = clamp(plannedSleepHours / needSleepHours - 1.0, -1.0, 0.25)
      adjSleep = clamp(14.0 * sleepRatio, -3.5, 3.5)
    }

    // adj_reversion: tłumienie trendu (jeśli ostatnie dni rosły, projekcja ciągnie w dół)
    const slope = slopePerDay(recoveryVals)
    const adjReversion = clamp(-1.0 * slope, -8, 8)

    const forecast = clamp(center + adjStrain + adjSleep + adjReversion, 0, 100)

    const sd = sampleSD(recoveryVals) ?? 8.0
    let band = Math.max(sd, 8.0)
    if (nights < 10) band += 6.0

    const confidence = nights >= 10 ? 'solid' : 'building'

    return new Response(JSON.stringify({
      success: true,
      forecast: Math.round(forecast),
      range: [Math.round(forecast - band), Math.round(forecast + band)],
      confidence,
      components: {
        center: Math.round(center), adj_strain: +adjStrain.toFixed(1),
        adj_sleep: +adjSleep.toFixed(1), adj_reversion: +adjReversion.toFixed(1),
        nights, band: Math.round(band),
        today_effort: todayEffort, mean_effort: +meanEffort.toFixed(1),
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    console.error('[recovery-forecast] fatal', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
