import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const userId: string = body.userId
    if (!userId) throw new Error('Missing userId')

    const today = body.date || new Date().toISOString().split('T')[0]

    // Pobierz dane z wszystkich źródeł (StayFree, Oura, Wins, Nutrition)
    const [ouraRes, stayfreeRes, winsRes, nutritionRes] = await Promise.all([
      supabase.from('oura_daily_summary').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('stayfree_usage').select('*').eq('user_id', userId).eq('date', today),
      supabase.from('daily_wins').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('daily_nutrition').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
    ])

    const oura = ouraRes.data
    const stayfree: any[] = stayfreeRes.data || []
    const wins = winsRes.data
    const nutrition = nutritionRes.data

    // --- Digital Exposure Vector ---
    const totalSeconds = stayfree.reduce((a: number, b: any) => a + (b.duration_seconds || 0), 0)
    const byDevice: Record<string, number> = {}
    stayfree.forEach((s: any) => {
      byDevice[s.device_name] = (byDevice[s.device_name] || 0) + s.duration_seconds
    })
    const realTimeSeconds = Object.values(byDevice).length > 0 ? Math.max(...Object.values(byDevice)) : totalSeconds
    const overlapFactor = realTimeSeconds > 0 ? totalSeconds / realTimeSeconds : 1.0
    const unlocks = stayfree.length > 0 ? Math.max(...stayfree.map((d: any) => d.unlocks || 0)) : 0
    const fragmentation = unlocks / ((realTimeSeconds / 3600) || 1)

    const socialSeconds = stayfree
      .filter((i: any) => /messenger|facebook|instagram|tiktok|youtube|shorts/i.test(i.app_name))
      .reduce((a: number, b: any) => a + b.duration_seconds, 0)

    const dopamineLoad = totalSeconds > 0
      ? (socialSeconds / totalSeconds) * overlapFactor * Math.max(fragmentation, 0.1)
      : 0

    // --- Execution Vector ---
    let completedTasks = 0
    if (wins) for (let i = 1; i <= 5; i++) if ((wins as any)[`done_${i}`]) completedTasks++

    // --- Identity Score (Vanguard Logic) ---
    let identityScore = 100
    if (wins?.result === 'P') identityScore -= 30
    if (!wins) identityScore -= 10
    if ((nutrition as any)?.protein < 140) identityScore -= 15
    if (oura?.total_sleep_hours != null && oura.total_sleep_hours < 6.5) identityScore -= 15
    if (oura?.readiness_score != null && oura.readiness_score < 60) identityScore -= 10
    identityScore = Math.max(0, identityScore)

    // Uproszczona klasyfikacja stanu
    let finalState = 'STABLE'
    const exec = completedTasks / 5
    if (wins?.result === 'P' && oura?.readiness_score < 60) finalState = 'CHAOS'
    else if (oura?.readiness_score < 60 || (oura?.hrv_avg != null && oura.hrv_avg < 25)) finalState = 'RECOVERY'
    else if (exec === 1.0) finalState = 'LOCKED_IN'
    else if (exec >= 0.8) finalState = 'MOMENTUM'
    else if (exec < 0.4 && oura?.readiness_score >= 70) finalState = 'AVOIDANCE'

    const aggregate = {
      user_id: userId,
      date: today,
      execution_score: exec,
      identity_score: identityScore,
      power_list_result: wins?.result || null,
      readiness_score: oura?.readiness_score || null,
      sleep_hours: oura?.total_sleep_hours || null,
      hrv_avg: oura?.hrv_avg || null,
      rhr_avg: oura?.rhr_avg || null,
      screen_time_min: Math.round(totalSeconds / 60) || null,
      dopamine_load_index: stayfree.length > 0 ? parseFloat(dopamineLoad.toFixed(4)) : null,
      fragmentation_index: stayfree.length > 0 ? parseFloat(fragmentation.toFixed(4)) : null,
      final_state: finalState,
      state_confidence: stayfree.length > 0 && oura ? 0.9 : (oura ? 0.6 : 0.3)
    }

    const { error } = await supabase
      .from('vanguard_daily_aggregates')
      .upsert(aggregate, { onConflict: 'user_id,date' })

    if (error) throw error

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
