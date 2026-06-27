// Etap 5 (docs/PLAN_READINESS_NOOP.md, sekcja 4.5/4.6): NOOP port BehaviorInsights +
// DoseResponseEngine ("What Moves You"). compute-correlations robi już Pearson r dla
// par ciągłych metryk — TA funkcja pokrywa to, czego tam nie ma: behavior_log to
// dane kategorialne/dawka (zalogowano/nie, ile), więc potrzebuje group-comparison
// (Welch t-test + Cohen's d), nie korelacji Pearsona.
import { createServiceClient, corsHeaders, resolveUserScope } from "../_shared/supabase.ts"
import { studentTPValue } from "../_shared/stats.ts"
import { isInterestingBehaviorEffect } from "../_shared/correlationInterest.ts"

function erfApprox(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax)
  return sign * y
}
const normalCDF = (z: number) => 0.5 * (1 + erfApprox(z / Math.sqrt(2)))

function mean(xs: number[]): number | null { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null }
function variance(xs: number[]): number | null {
  if (xs.length < 2) return null
  const m = mean(xs)!
  return xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1)
}

// Welch t-test (unequal variance) — BehaviorInsights.swift
function welchTTest(a: number[], b: number[]): { t: number; df: number; p: number } | null {
  if (a.length < 2 || b.length < 2) return null
  const m1 = mean(a)!, m2 = mean(b)!
  const v1 = variance(a)!, v2 = variance(b)!
  const se2 = v1 / a.length + v2 / b.length
  if (se2 <= 0) return null
  const t = (m1 - m2) / Math.sqrt(se2)
  const df = (se2 * se2) / (((v1 / a.length) ** 2) / (a.length - 1) + ((v2 / b.length) ** 2) / (b.length - 1))
  const p = studentTPValue(Math.abs(t), df)
  return { t, df, p }
}

// Cohen's d (pooled SD) — BehaviorInsights.swift
function cohensD(a: number[], b: number[]): number | null {
  if (a.length < 2 || b.length < 2) return null
  const v1 = variance(a)!, v2 = variance(b)!
  const pooledVar = ((a.length - 1) * v1 + (b.length - 1) * v2) / (a.length + b.length - 2)
  const sp = Math.sqrt(pooledVar)
  if (sp <= 0) return null
  return (mean(a)! - mean(b)!) / sp
}

// OLS slope dose → outcome_next_day
function olsSlope(pairs: [number, number][]): number | null {
  const n = pairs.length
  if (n < 3) return null
  const mx = mean(pairs.map(p => p[0]))!, my = mean(pairs.map(p => p[1]))!
  let sxx = 0, sxy = 0
  for (const [x, y] of pairs) { sxx += (x - mx) * (x - mx); sxy += (x - mx) * (y - my) }
  return sxx > 0 ? sxy / sxx : null
}

// DoseResponsePriors (4.14) — population priors dla shrinkage
const PRIORS: Record<string, { slope: number; clampLow: number; clampHigh: number }> = {
  alkohol: { slope: -5.0, clampLow: -15.0, clampHigh: 2.0 },
  alcohol: { slope: -5.0, clampLow: -15.0, clampHigh: 2.0 },
  kofeina: { slope: -4.0, clampLow: -20.0, clampHigh: 4.0 },
  caffeine: { slope: -4.0, clampLow: -20.0, clampHigh: 4.0 },
}
const SHRINKAGE_K = 8.0

function confidenceTier(n: number): 'calibrating' | 'building' | 'solid' {
  return n < 5 ? 'calibrating' : n < 12 ? 'building' : 'solid'
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(day + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
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
    const todayWarsaw = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
    const start90 = shiftDay(todayWarsaw, -90)

    const [behaviorR, strainR] = await Promise.all([
      supabase.from('behavior_log').select('date, behavior_key, value')
        .eq('user_id', userId).gte('date', start90).order('date'),
      supabase.from('daily_strain').select('date, recovery_score, illness_score')
        .eq('user_id', userId).gte('date', start90).order('date'),
    ])
    if (behaviorR.error) throw behaviorR.error
    if (strainR.error) throw strainR.error

    const recoveryByDate: Record<string, number> = {}
    for (const r of strainR.data ?? []) {
      if (r.recovery_score != null) recoveryByDate[r.date] = Number(r.recovery_score)
    }
    const allDates = Object.keys(recoveryByDate)

    const byKey: Record<string, { date: string; value: number | null }[]> = {}
    for (const row of behaviorR.data ?? []) {
      (byKey[row.behavior_key] ||= []).push({ date: row.date, value: row.value != null ? Number(row.value) : null })
    }

    const results: any[] = []
    for (const [key, rows] of Object.entries(byKey)) {
      const withDates = new Set(rows.map(r => r.date))
      const withOutcomes: number[] = []
      const withoutOutcomes: number[] = []
      for (const date of allDates) {
        const nextDay = shiftDay(date, 1)
        const outcome = recoveryByDate[nextDay]
        if (outcome == null) continue
        if (withDates.has(date)) withOutcomes.push(outcome)
        else withoutOutcomes.push(outcome)
      }

      const tTest = welchTTest(withOutcomes, withoutOutcomes)
      const d = cohensD(withOutcomes, withoutOutcomes)
      const meanWith = mean(withOutcomes)
      const meanWithout = mean(withoutOutcomes)
      const delta = (meanWith != null && meanWithout != null) ? meanWith - meanWithout : null
      const pctChange = (delta != null && meanWithout) ? (delta / Math.abs(meanWithout)) * 100 : null

      // Dose-response: tylko jeśli behavior ma numeryczne value (dawka), nie tylko occurrence
      const dosePairs: [number, number][] = []
      for (const row of rows) {
        if (row.value == null) continue
        const outcome = recoveryByDate[shiftDay(row.date, 1)]
        if (outcome != null) dosePairs.push([row.value, outcome])
      }
      let doseResponse: any = null
      if (dosePairs.length >= 3) {
        const betaUser = olsSlope(dosePairs)
        if (betaUser != null) {
          const prior = PRIORS[key.toLowerCase()]
          const n = dosePairs.length
          const w = n / (n + SHRINKAGE_K)
          let betaFinal = prior ? w * betaUser + (1 - w) * prior.slope : betaUser
          if (prior) betaFinal = Math.max(prior.clampLow, Math.min(prior.clampHigh, betaFinal))
          doseResponse = {
            beta_user: +betaUser.toFixed(3), beta_final: +betaFinal.toFixed(3),
            prior_used: !!prior, n, confidence: confidenceTier(n),
            contradicts_prior: prior ? (n >= 5 && Math.sign(betaUser) !== Math.sign(prior.slope)) : false,
          }
        }
      }

      const minGroup = Math.min(withOutcomes.length, withoutOutcomes.length)
      const significant = tTest != null && tTest.p < 0.05 && minGroup >= 5

      results.push({
        behavior_key: key,
        n_with: withOutcomes.length, n_without: withoutOutcomes.length,
        mean_with: meanWith != null ? +meanWith.toFixed(1) : null,
        mean_without: meanWithout != null ? +meanWithout.toFixed(1) : null,
        delta: delta != null ? +delta.toFixed(1) : null,
        pct_change: pctChange != null ? +pctChange.toFixed(1) : null,
        cohens_d: d != null ? +d.toFixed(2) : null,
        p_value: tTest ? +tTest.p.toFixed(4) : null,
        significant,
        confidence: confidenceTier(minGroup),
        dose_response: doseResponse,
        outcome_metric: 'recovery_score', lag_days: 1,
      })
    }

    results.sort((a, b) => {
      if (a.significant !== b.significant) return a.significant ? -1 : 1
      return Math.abs(b.cohens_d ?? 0) - Math.abs(a.cohens_d ?? 0)
    })

    const computedTotal = results.length
    const interesting = results.filter(r => isInterestingBehaviorEffect({
      behavior_key: r.behavior_key,
      significant: r.significant,
      cohens_d: r.cohens_d,
      n_with: r.n_with,
      n_without: r.n_without,
      p_value: r.p_value,
    }, { includePrivate: includeWeak }))
    const output = includeWeak ? results : interesting

    return new Response(JSON.stringify({
      success: true,
      results: output,
      behaviors_tracked: Object.keys(byKey).length,
      computed_total: computedTotal,
      hidden_weak: computedTotal - interesting.length,
      window_days: 90,
      filtered: !includeWeak,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('[behavior-effects] fatal', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
