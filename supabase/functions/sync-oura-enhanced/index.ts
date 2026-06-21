
import { createServiceClient } from "../_shared/supabase.ts"
import { resolveUserScope } from "../_shared/supabase.ts"

const OURA_BASE = 'https://api.ouraring.com/v2/usercollection'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const serviceClient = createServiceClient

// Robust fetch — Oura zwraca 404/426 dla endpointów, których dany ring/plan nie obsługuje.
// W takim wypadku po prostu pomijamy (pusta lista), zamiast wywalać cały sync.
async function fetchOura(url: string, headers: Record<string, string>): Promise<any> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers })
    if (!res.ok) {
      console.warn(`[oura-enh] ${url} -> ${res.status}`)
      return { data: [] }
    }
    return await res.json()
  } catch (e: any) {
    console.warn(`[oura-enh] fetch failed ${url}: ${e.message}`)
    return { data: [] }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = serviceClient()
    const body = await req.json().catch(() => ({}))
    const days: number = body.days ?? 5        // okno bezpieczeństwa — 5 dni bo Oura opóźnia szczegółowe fazy snu
    const { userId: scopedUserId } = await resolveUserScope(req, body.userId ?? null)
    const onlyUserId: string | null = scopedUserId

    // Wszyscy użytkownicy z tokenem Oura (bez wpisanego ID na sztywno)
    let query = supabase
      .from('user_settings')
      .select('user_id, oura_token')
      .not('oura_token', 'is', null)
    if (onlyUserId) query = query.eq('user_id', onlyUserId)

    const { data: users, error: usersErr } = await query
    if (usersErr) throw usersErr

    const now = new Date()
    const endDate = new Date(now.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0]   // jutro (bufor stref czasowych)
    const startDate = new Date(now.getTime() - days * 24 * 3600 * 1000).toISOString().split('T')[0]
    const range = `start_date=${startDate}&end_date=${endDate}`

    const results: any[] = []

    for (const u of (users || [])) {
      const headers = { 'Authorization': `Bearer ${u.oura_token}` }

      const [readiness, dailySleep, sleep, activity, stress, resilience, spo2, cardio, vo2] = await Promise.all([
        fetchOura(`${OURA_BASE}/daily_readiness?${range}`, headers),
        fetchOura(`${OURA_BASE}/daily_sleep?${range}`, headers),
        fetchOura(`${OURA_BASE}/sleep?${range}`, headers),
        fetchOura(`${OURA_BASE}/daily_activity?${range}`, headers),
        fetchOura(`${OURA_BASE}/daily_stress?${range}`, headers),
        fetchOura(`${OURA_BASE}/daily_resilience?${range}`, headers),
        fetchOura(`${OURA_BASE}/daily_spo2?${range}`, headers),
        fetchOura(`${OURA_BASE}/daily_cardiovascular_age?${range}`, headers),
        fetchOura(`${OURA_BASE}/vo2_max?${range}`, headers),
      ])

      // `raw` previously stored the full per-endpoint Oura JSON response (9 endpoints,
      // ~15-25KB/day/user) in a JSONB column that's never read anywhere downstream —
      // pure unbounded storage growth. Stopped writing it; only the derived fields below
      // (which Analyst/Oracle/strain actually query) are persisted.
      const byDay: Record<string, any> = {}
      const ensure = (d: string) => {
        if (!d) return null
        if (!byDay[d]) byDay[d] = {}
        return byDay[d]
      }

      readiness.data?.forEach((it: any) => {
        const r = ensure(it.day); if (!r) return
        r.readiness_score = it.score ?? null
        r.temperature_deviation = it.temperature_deviation ?? null
        r.temperature_trend_deviation = it.temperature_trend_deviation ?? null
        r.readiness_contributors = it.contributors ?? null
      })

      dailySleep.data?.forEach((it: any) => {
        const r = ensure(it.day); if (!r) return
        r.sleep_score = it.score ?? null
        r.sleep_contributors = it.contributors ?? null
      })

      // sleep: wybierz główny sen doby (najdłuższy total_sleep_duration), pomijając drzemki
      const mainSleepByDay: Record<string, any> = {}
      sleep.data?.forEach((it: any) => {
        const d = it.day
        if (!d) return
        const dur = it.total_sleep_duration || 0
        if (!mainSleepByDay[d] || dur > (mainSleepByDay[d].total_sleep_duration || 0)) {
          mainSleepByDay[d] = it
        }
      })
      Object.entries(mainSleepByDay).forEach(([d, it]: [string, any]) => {
        const r = ensure(d); if (!r) return
        r.total_sleep_hours = it.total_sleep_duration ? it.total_sleep_duration / 3600 : null
        r.time_in_bed_hours = it.time_in_bed ? it.time_in_bed / 3600 : null
        r.deep_sleep_hours = it.deep_sleep_duration ? it.deep_sleep_duration / 3600 : null
        r.rem_sleep_hours = it.rem_sleep_duration ? it.rem_sleep_duration / 3600 : null
        r.light_sleep_hours = it.light_sleep_duration ? it.light_sleep_duration / 3600 : null
        r.awake_time_minutes = it.awake_time ? it.awake_time / 60 : null
        r.restless_periods = it.restless_periods ?? null
        r.sleep_efficiency = it.efficiency ?? null
        r.sleep_latency_minutes = it.latency ? it.latency / 60 : null
        r.bedtime_start = it.bedtime_start ?? null
        r.bedtime_end = it.bedtime_end ?? null
        // Oblicz "obudził się" = koniec ostatniej fazy sennej (ostatnie non-awake w sleep_phase_5_min)
        let wakeUpTs: string | null = null
        const phases: string = it.sleep_phase_5_min || ''
        if (phases && it.bedtime_start) {
          let lastSleepIdx = -1
          for (let i = phases.length - 1; i >= 0; i--) {
            if (phases[i] !== '4') { lastSleepIdx = i; break }
          }
          if (lastSleepIdx >= 0) {
            wakeUpTs = new Date(new Date(it.bedtime_start).getTime() + (lastSleepIdx + 1) * 5 * 60000).toISOString()
          }
        }
        r.wake_up_timestamp = wakeUpTs
        r.sleep_average_heart_rate = it.average_heart_rate ?? null
        r.sleep_lowest_heart_rate = it.lowest_heart_rate ?? null
        r.sleep_average_hrv = it.average_hrv ?? null
        r.sleep_average_breath = it.average_breath ?? null
      })

      activity.data?.forEach((it: any) => {
        const r = ensure(it.day); if (!r) return
        r.activity_score = it.score ?? null
        r.steps = it.steps ?? null
        r.active_calories = it.active_calories ?? null
        r.total_calories = it.total_calories ?? null
        r.target_calories = it.target_calories ?? null
        r.equivalent_walking_distance = it.equivalent_walking_distance ?? null
        r.high_activity_minutes = it.high_activity_time ? it.high_activity_time / 60 : null
        r.medium_activity_minutes = it.medium_activity_time ? it.medium_activity_time / 60 : null
        r.low_activity_minutes = it.low_activity_time ? it.low_activity_time / 60 : null
        r.sedentary_minutes = it.sedentary_time ? it.sedentary_time / 60 : null
        r.resting_minutes = it.resting_time ? it.resting_time / 60 : null
        r.non_wear_minutes = it.non_wear_time ? it.non_wear_time / 60 : null
        r.average_met_minutes = it.average_met_minutes ?? null
        r.inactivity_alerts = it.inactivity_alerts ?? null
        r.activity_contributors = it.contributors ?? null
      })

      stress.data?.forEach((it: any) => {
        const r = ensure(it.day); if (!r) return
        r.stress_high_minutes = it.stress_high ? it.stress_high / 60 : null
        r.recovery_high_minutes = it.recovery_high ? it.recovery_high / 60 : null
        r.stress_day_summary = it.day_summary ?? null
      })

      resilience.data?.forEach((it: any) => {
        const r = ensure(it.day); if (!r) return
        r.resilience_level = it.level ?? null
        r.resilience_contributors = it.contributors ?? null
      })

      spo2.data?.forEach((it: any) => {
        const r = ensure(it.day); if (!r) return
        r.spo2_percentage = (it.spo2_percentage && typeof it.spo2_percentage === 'object')
          ? (it.spo2_percentage.average ?? null)
          : (it.spo2_percentage ?? null)
        r.breathing_disturbance_index = it.breathing_disturbance_index ?? null
      })

      cardio.data?.forEach((it: any) => {
        const r = ensure(it.day); if (!r) return
        r.vascular_age = it.vascular_age ?? null
      })

      vo2.data?.forEach((it: any) => {
        const d = it.day || (it.timestamp ? it.timestamp.split('T')[0] : null)
        const r = ensure(d); if (!r) return
        r.vo2_max = it.vo2_max ?? null
      })

      const rows = Object.entries(byDay).map(([date, v]: [string, any]) => ({
        user_id: u.user_id,
        date,
        updated_at: new Date().toISOString(),
        ...v,
      }))

      if (rows.length > 0) {
        const { error: upErr } = await supabase
          .from('oura_enhanced')
          .upsert(rows, { onConflict: 'user_id,date' })
        if (upErr) {
          console.error('[oura-enh] upsert error', upErr)
          results.push({ user_id: u.user_id, error: upErr.message })
        } else {
          results.push({ user_id: u.user_id, days_upserted: rows.length, dates: rows.map(r => r.date).sort() })
        }
      } else {
        results.push({ user_id: u.user_id, days_upserted: 0 })
      }
    }

    return new Response(JSON.stringify({ success: true, range: { startDate, endDate }, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('[oura-enh] fatal', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
