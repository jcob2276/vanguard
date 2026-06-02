import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const warsawDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })

// Klasyfikacja ćwiczeń
const LEG_KW = ['przysiad', 'martwy', 'rdl', 'nog', 'leg', 'łydk', 'lydk', 'hip thrust', 'wykrok', 'lunge', 'calf', 'udo']
const CNS_KW = ['martwy', 'przysiad', 'ohp', 'bench', 'wyciskanie', 'dip']
const matches = (name: string, kws: string[]) => { const n = (name || '').toLowerCase(); return kws.some(k => n.includes(k)) }

function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "")
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = serviceClient()
    const body = await req.json().catch(() => ({}))
    const days: number = body.days ?? 2
    const onlyUserId: string | null = body.userId ?? null

    let uq = supabase.from('user_settings').select('user_id').not('oura_token', 'is', null)
    if (onlyUserId) uq = uq.eq('user_id', onlyUserId)
    const { data: users, error: uErr } = await uq
    if (uErr) throw uErr

    const now = new Date()
    const todayWarsaw = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
    const endStr = now.toISOString().split('T')[0]
    const startStr = new Date(now.getTime() - days * 864e5).toISOString().split('T')[0]
    const start90 = new Date(now.getTime() - 90 * 864e5).toISOString().split('T')[0]

    const results: any[] = []

    for (const u of (users || [])) {
      const uid = u.user_id

      // ── Waga (ostatnia) ──
      const { data: bw } = await supabase.from('body_metrics')
        .select('weight').eq('user_id', uid).not('weight', 'is', null)
        .order('date', { ascending: false }).limit(1).maybeSingle()
      const weight = Number(bw?.weight) || 75

      // ── Baseline HRV/RHR (90 dni) ──
      const { data: base } = await supabase.from('oura_daily_summary')
        .select('hrv_avg, rhr_avg').eq('user_id', uid).gte('date', start90)
      const hrvVals = (base || []).map(r => r.hrv_avg).filter(Boolean) as number[]
      const rhrVals = (base || []).map(r => r.rhr_avg).filter(Boolean) as number[]
      const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null
      const hrvBase = mean(hrvVals)
      const rhrBase = mean(rhrVals)

      // ── Źródła w oknie (z buforem -1 dnia na "wczoraj") ──
      const winStart = new Date(now.getTime() - (days + 1) * 864e5).toISOString().split('T')[0]
      const [zonesR, enhR, summR, nutrR, wsR, stravaR] = await Promise.all([
        supabase.from('oura_hr_zones_daily').select('day, z1_regen_min, z2_tlenowa_min, z3_tempo_min, z4_prog_min, z5_max_min, hr_max').eq('user_id', uid).gte('day', winStart),
        supabase.from('oura_enhanced').select('date, steps, resilience_level').eq('user_id', uid).gte('date', winStart),
        supabase.from('oura_daily_summary').select('date, readiness_score, hrv_avg, rhr_avg, total_sleep_hours').eq('user_id', uid).gte('date', winStart),
        supabase.from('daily_nutrition').select('date, calories, protein, carbs').eq('user_id', uid).gte('date', winStart),
        supabase.from('workout_sessions').select('date, exercise_logs(exercise_name, rpe)').eq('user_id', uid).gte('date', winStart),
        supabase.from('strava_activities_clean').select('start_date, perceived_exertion, has_pr, sport_type, is_oura').eq('user_id', uid).eq('is_oura', false).gte('start_date', winStart + 'T00:00:00'),
      ])

      const byKey = <T,>(rows: T[] | null, key: (r: T) => string) => {
        const m: Record<string, T[]> = {}
        for (const r of (rows || [])) { const k = key(r); (m[k] = m[k] || []).push(r) }
        return m
      }
      const zones = byKey(zonesR.data, (r: any) => r.day)
      const enh = byKey(enhR.data, (r: any) => r.date)
      const summ = byKey(summR.data, (r: any) => r.date)
      const nutr = byKey(nutrR.data, (r: any) => r.date)
      const workouts = byKey(wsR.data, (r: any) => r.date)
      const strava = byKey(stravaR.data, (r: any) => warsawDate(r.start_date))

      // ── Iteracja chronologiczna ──
      const dayList: string[] = []
      for (let t = new Date(startStr).getTime(); t <= new Date(endStr).getTime(); t += 864e5) {
        dayList.push(new Date(t).toISOString().split('T')[0])
      }

      let prev: any = null
      const upserts: any[] = []

      for (const date of dayList) {
        // Dzień bieżący (Europe/Warsaw): Yazio jeszcze niedomknięte → fueling tymczasowy.
        const fuelingProvisional = date === todayWarsaw
        const z = zones[date]?.[0]
        const e = enh[date]?.[0]
        const s = summ[date]?.[0]
        const n = nutr[date]?.[0]
        const wsets = (workouts[date] || []).flatMap((w: any) => w.exercise_logs || [])
        const runs = strava[date] || []

        // ── CARDIO LOAD (TRIMP-style ze stref Oura + bonus Strava) ──
        let cardioRaw = 0
        if (z) {
          cardioRaw = (z.z1_regen_min || 0) * 0.5 + (z.z2_tlenowa_min || 0) * 1
            + (z.z3_tempo_min || 0) * 2 + (z.z4_prog_min || 0) * 4 + (z.z5_max_min || 0) * 6
        }
        const maxRpe = runs.reduce((m: number, r: any) => Math.max(m, r.perceived_exertion || 0), 0)
        const rpeBonus = maxRpe >= 8 ? 30 : maxRpe >= 6 ? 15 : 0
        const prBonus = runs.some((r: any) => r.has_pr) ? 20 : 0
        const isRunDay = runs.length > 0
        cardioRaw += rpeBonus + prBonus

        // ── STRENGTH LOAD ──
        let strengthPts = 0, legPts = 0, cnsPts = 0
        for (const set of wsets) {
          const isLeg = matches(set.exercise_name, LEG_KW)
          const isCns = matches(set.exercise_name, CNS_KW)
          const nearFailure = set.rpe != null && Number(set.rpe) <= 1
          const pts = 3 + (isLeg ? 2 : 0) + (isCns ? 2 : 0) + (nearFailure ? 2 : 0)
          strengthPts += pts
          if (isLeg) legPts += pts
          if (isCns) cnsPts += pts
        }

        // ── STEPS LOAD ──
        const steps = e?.steps ?? null
        const stepsLoad = steps != null ? Math.min(steps / 500, 45) : 0

        // ── FUELING ──
        const kcal = n?.calories ?? null
        const carbs = n?.carbs != null ? Number(n.carbs) : null
        const protein = n?.protein != null ? Number(n.protein) : null
        const hadLoad = cardioRaw > 80 || strengthPts > 30

        let fuelingPenalty = 0
        // Dzień trwa — nie karzemy strain za "niedожywienie" jeszcze niezamkniętego dnia.
        if (hadLoad && !fuelingProvisional) {
          if (kcal != null) { if (kcal < 1600) fuelingPenalty += 30; else if (kcal < 2000) fuelingPenalty += 15 }
          if (isRunDay && carbs != null && carbs < 150) fuelingPenalty += 15
          if (protein != null && protein / weight < 1.6) fuelingPenalty += 10
        }

        let fuelingScore: number | null = null
        if (kcal != null) {
          const tgtKcal = hadLoad ? 2600 : 2200
          const tgtCarbs = hadLoad ? 225 : 150
          const tgtProtein = weight * 1.8
          const pPart = clamp((protein || 0) / tgtProtein, 0, 1) * 40
          const cPart = clamp((carbs || 0) / tgtCarbs, 0, 1) * 30
          const kPart = clamp(kcal / tgtKcal, 0, 1) * 30
          fuelingScore = Math.round(pPart + cPart + kPart)
        }

        // ── MENTAL LOAD (MVP: brak klasyfikatora) ──
        const mentalLoad: number | null = null
        const mentalPts = 0

        // ── STRAIN 0–21 (log-kompresja) ──
        const rawTotal = cardioRaw + strengthPts + stepsLoad + fuelingPenalty + mentalPts
        const hasAnyLoad = rawTotal > 0 || z != null
        const strain = hasAnyLoad ? Math.round(21 * (1 - Math.exp(-rawTotal / 156)) * 10) / 10 : null

        // ── RECOVERY 0–100 ──
        let recovery: number | null = null
        const sleep = s?.total_sleep_hours ?? null
        if (s?.readiness_score != null || sleep != null) {
          let rec = s?.readiness_score ?? 65
          if (sleep != null) { if (sleep < 6) rec -= 12; else if (sleep < 7) rec -= 6 }
          if (s?.hrv_avg != null && hrvBase && s.hrv_avg < 0.85 * hrvBase) rec -= 8
          if (s?.rhr_avg != null && rhrBase && s.rhr_avg > 1.05 * rhrBase) rec -= 5
          if (prev?.fueling_score != null && prev.fueling_score < 50) rec -= 8
          if (prev?.strain_score != null) { if (prev.strain_score > 15) rec -= 8; else if (prev.strain_score > 12) rec -= 4 }
          if (prev?.mental_load_score != null && prev.mental_load_score >= 7) rec -= 6
          recovery = clamp(Math.round(rec), 0, 100)
        }

        // ── STATUS ──
        let status = 'yellow'
        if ((recovery != null && recovery < 55) ||
            (strain != null && strain > 15 && recovery != null && recovery < 70) ||
            (fuelingScore != null && fuelingScore < 40 && hadLoad && !fuelingProvisional)) {
          status = 'red'
        } else if (recovery != null && recovery >= 75 && (strain == null || strain < 14)) {
          status = 'green'
        }

        // ── MAIN LIMITER ──
        // Priorytet: najpierw akcjonowalne braki paliwa w dni z obciążeniem,
        // potem węgle, dopiero potem sen (próg <6h — bo chroniczne ~6.4h
        // zagłuszałoby realny problem), na końcu koszt fizyczny / mental.
        // Gdy fueling tymczasowy (dziś) — calories/carbs NIE mogą być limiterem
        // (dzień jeszcze trwa), przepuszczamy do kolejnego w priorytecie.
        let limiter = 'recovery_ok'
        if (hadLoad && kcal != null && kcal < 1700 && !fuelingProvisional) limiter = 'calories'
        else if (isRunDay && carbs != null && carbs < 150 && !fuelingProvisional) limiter = 'carbs'
        else if (sleep != null && sleep < 6.0) limiter = 'sleep'
        else if (strain != null && strain > 15 && recovery != null && recovery < 65) {
          limiter = cardioRaw >= strengthPts ? 'cardio_load' : 'strength_load'
        }
        else if (mentalLoad != null && mentalLoad >= 7) limiter = 'mental_load'
        else if (sleep != null && sleep < 6.8) limiter = 'sleep'
        else if (kcal != null && kcal < 1500 && !fuelingProvisional) limiter = 'calories'

        // ── EXPLANATION (regułowa) ──
        const parts: string[] = []
        if (isRunDay) parts.push('bieg')
        if (strengthPts > 0) parts.push('siłownia')
        if (steps != null && steps >= 12000) parts.push(`${Math.round(steps / 1000)}k kroków`)
        if (kcal != null) parts.push(`${kcal} kcal`)
        const ctx = parts.join(' + ') || 'dzień regeneracyjny'
        const limiterPL: Record<string, string> = {
          sleep: 'głównym ograniczeniem jest sen', calories: 'za mało kalorii względem obciążenia',
          carbs: 'za mało węgli w dzień biegowy', cardio_load: 'wysoki koszt sercowo-naczyniowy',
          strength_load: 'ciężka sesja siłowa', mental_load: 'wysokie obciążenie mentalne',
          recovery_ok: 'regeneracja OK',
        }
        const explanation = `${ctx}. Strain ${strain ?? '—'}/21, recovery ${recovery ?? '—'} — ${limiterPL[limiter]}.`
          + (fuelingProvisional ? ' (fueling jeszcze niepełny)' : '')

        const row = {
          user_id: uid, date,
          strain_score: strain, recovery_score: recovery, fueling_score: fuelingScore,
          mental_load_score: mentalLoad, daily_status: status, main_limiter: limiter,
          fueling_provisional: fuelingProvisional,
          explanation,
          cardio_load: Math.round(cardioRaw * 10) / 10,
          strength_load: strengthPts, leg_load: legPts, cns_load: cnsPts,
          steps_load: Math.round(stepsLoad * 10) / 10, fueling_penalty: fuelingPenalty,
          components: {
            zones: z || null, raw_total: Math.round(rawTotal * 10) / 10,
            run_rpe: maxRpe || null, pr: prBonus > 0, weight,
            kcal, carbs, protein, steps, sleep_h: sleep,
            hrv_base: hrvBase ? Math.round(hrvBase) : null, rhr_base: rhrBase ? Math.round(rhrBase) : null,
          },
          updated_at: new Date().toISOString(),
        }
        upserts.push(row)
        prev = row
      }

      if (upserts.length) {
        const { error: upErr } = await supabase.from('daily_strain').upsert(upserts, { onConflict: 'user_id,date' })
        if (upErr) { results.push({ user_id: uid, error: upErr.message }); continue }
      }
      results.push({ user_id: uid, days: upserts.length, latest: upserts[upserts.length - 1] })
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[strain] fatal', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
