import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { VanguardCore, computeSignals } from '../_shared/vanguardCore.ts'
import { safeExecute, createServiceClient, corsHeaders } from '../_shared/supabase.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('VANGUARD_CRON_SECRET')
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized: Invalid or missing VANGUARD_CRON_SECRET')
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

    // Pobierz dane z wszystkich źródeł (StayFree, Oura, Wins, Nutrition, Last Workout)
    const [oura, stayfreeRaw, wins, nutrition, lastWorkout] = await Promise.all([
      safeExecute(supabase.from('oura_daily_summary').select('*').eq('user_id', userId).eq('date', today).maybeSingle()),
      safeExecute(supabase.from('stayfree_usage').select('*').eq('user_id', userId).eq('date', today)),
      safeExecute(supabase.from('daily_wins').select('*').eq('user_id', userId).eq('date', today).maybeSingle()),
      safeExecute(supabase.from('daily_nutrition').select('*').eq('user_id', userId).eq('date', today).maybeSingle()),
      safeExecute(supabase.from('workout_sessions').select('date').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle()),
    ])

    const stayfree: any[] = stayfreeRaw || []
    const lastTrainingDate = lastWorkout?.date || null

    // --- Unified Signal Computation (Vanguard Core) ---
    const signals = computeSignals(
      stayfree,
      oura,
      wins,
      { protein: nutrition?.protein || 0 },
      lastTrainingDate
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
      screen_time_min: signals.screen_time_min || null,
      dopamine_load_index: stayfree.length > 0 ? signals.dopamine_load : null,
      fragmentation_index: stayfree.length > 0 ? signals.fragmentation : null,
      final_state: finalState,
      state_confidence: stayfree.length > 0 && oura ? 0.9 : (oura ? 0.6 : 0.3)
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
