import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { VanguardCore, computeSignals } from '../_shared/vanguardCore.ts'
import { safeExecute, createServiceClient, corsHeaders } from '../_shared/supabase.ts'
import { getWarsawDayBoundaries } from '../_shared/time.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('VANGUARD_CRON_SECRET')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const allowedAuthHeaders = [
      cronSecret ? `Bearer ${cronSecret}` : null,
      serviceRoleKey ? `Bearer ${serviceRoleKey}` : null,
    ].filter(Boolean)
    
    if (!allowedAuthHeaders.includes(authHeader)) {
      console.error('Unauthorized: Invalid or missing cron/service authorization')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const supabase = createServiceClient()

    const body = await req.json()
    const userId: string = body.userId
    if (!userId) throw new Error('Missing userId')

    let today = body.date
    if (!today) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      today = yesterday.toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' })
    }

    // Pobierz dane z aktywnych źródeł (Oura, Wins, Nutrition, Last Workout, Strava)
    const [oura, wins, nutrition, lastWorkout, stravaRaw] = await Promise.all([
      safeExecute(supabase.from('oura_daily_summary').select('*').eq('user_id', userId).eq('date', today).maybeSingle()),
      safeExecute(supabase.from('daily_wins').select('*').eq('user_id', userId).eq('date', today).maybeSingle()),
      safeExecute(supabase.from('daily_nutrition').select('*').eq('user_id', userId).eq('date', today).maybeSingle()),
      safeExecute(supabase.from('workout_sessions').select('date').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle()),
      // Strava: aktywności z widoku clean dla danego dnia (Warsaw timezone, DST-safe)
      (() => {
        const { start: dayStart, end: dayEnd } = getWarsawDayBoundaries(today);
        return safeExecute(supabase.from('strava_activities_clean')
          .select('name,sport_type,start_date,elapsed_time,moving_time,distance,hr_avg,hr_max,total_elevation_gain,suffer_score')
          .eq('user_id', userId)
          .gte('start_date', dayStart)
          .lt('start_date', dayEnd)
          .order('start_date', { ascending: true }));
      })(),
    ])

    const lastTrainingDate = lastWorkout?.date || null

    // --- Format Strava activities ---
    function fmtTime(seconds: number): string {
      if (!seconds) return '0:00'
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = seconds % 60
      if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      return `${m}:${String(s).padStart(2, '0')}`
    }

    function fmtPace(movingTime: number, distanceM: number): string {
      if (!movingTime || !distanceM) return '—'
      const secPerKm = movingTime / (distanceM / 1000)
      const m = Math.floor(secPerKm / 60)
      const s = Math.round(secPerKm % 60)
      return `${m}:${String(s).padStart(2, '0')} /km`
    }

    const stravaActivities = ((stravaRaw as any[]) || []).map((a: any) => {
      const startWarsawHour = new Date(a.start_date).toLocaleTimeString('pl-PL', {
        timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit'
      })
      const distKm = a.distance ? +(a.distance / 1000).toFixed(2) : null
      return {
        name:                 a.name,
        sport_type:           a.sport_type,
        start_time:           startWarsawHour,
        start_date:           a.start_date,
        distance_km:          distKm,
        elapsed_time_fmt:     a.elapsed_time ? fmtTime(a.elapsed_time) : null,
        moving_time_fmt:      a.moving_time  ? fmtTime(a.moving_time)  : null,
        pace_per_km:          fmtPace(a.moving_time, a.distance),
        average_heartrate:    a.hr_avg ?? null,
        max_heartrate:        a.hr_max ?? null,
        total_elevation_gain: a.total_elevation_gain ?? null,
        calories:             null,
        suffer_score:         a.suffer_score ?? null,
      }
    })

    // --- Unified Signal Computation (Vanguard Core) ---
    const signals = computeSignals(
      oura,
      wins,
      { protein: nutrition?.protein || 0 },
      lastTrainingDate,
      today
    )

    // --- State and Stability Calculation via VanguardCore ---
    const core = new VanguardCore(userId, supabase)
    const bl = await core.getPersonalBaseline()
    const { state: finalState } = await core.determineState(signals, bl)

    // --- Identity Score (z-score relative do personal baseline, nie sztywne progi) ---
    // Maksymalnie 100. Każda metryka poniżej osobistej normy odejmuje punkty proporcjonalnie do odchylenia.
    let identityScore = 100

    // Power List result
    if (wins?.result === 'P') identityScore -= 30
    if (!wins) identityScore -= 10

    // Protein: kara gdy <0.5 sigma poniżej baseline (adaptacyjne)
    if (!bl.calibrating && bl.means.execution != null) {
      const proteinBaseline = (bl as any).means.protein ?? 140  // fallback do 140g jeśli brak historii proteiny
      const zProtein = signals.protein_grams > 0 ? (signals.protein_grams - proteinBaseline) / Math.max(proteinBaseline * 0.15, 20) : -2
      if (zProtein < -0.5) identityScore -= Math.round(Math.min(20, (Math.abs(zProtein) - 0.5) * 10))
    } else {
      // calibrating — fallback do sztywnego progu
      if ((nutrition as any)?.protein < 140) identityScore -= 15
    }

    // Sleep: kara gdy poniżej personal baseline (nie sztywne 6.5h)
    if (oura?.total_sleep_hours != null) {
      if (!bl.calibrating) {
        const zSleep = core._zScore(oura.total_sleep_hours, bl.means.sleep, bl.stdDevs.sleep)
        if (zSleep < -1.0) identityScore -= 15
        else if (zSleep < -0.5) identityScore -= 7
      } else {
        if (oura.total_sleep_hours < 6.5) identityScore -= 15
      }
    }

    // Readiness: kara przy obiektywnie niskim readiness (bezwzględne minimum <60)
    if (oura?.readiness_score != null && oura.readiness_score < 60) identityScore -= 10

    identityScore = Math.max(0, identityScore)

    const aggregate = {
      user_id: userId,
      date: today,
      execution_score: signals.execution_ratio,
      identity_score: identityScore,
      power_list_result: wins?.result || null,
      readiness_score: signals.readiness,
      sleep_hours: signals.sleep,
      hrv_avg: signals.hrv,
      rhr_avg: signals.rhr,
      screen_time_min: null,
      dopamine_load_index: null,
      fragmentation_index: null,
      final_state: finalState,
      state_confidence: oura ? 0.6 : 0.3,
      strava_activities_json: stravaActivities.length > 0 ? stravaActivities : null,
    }

    await safeExecute(
      supabase
        .from('vanguard_daily_aggregates')
        .upsert(aggregate, { onConflict: 'user_id,date' })
    )

    return new Response(JSON.stringify({ success: true, state: finalState, identity_score: identityScore }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
