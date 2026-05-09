import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OURA_BASE_URL = 'https://api.ouraring.com/v2/usercollection'

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

    const { userId } = await req.json()
    if (!userId) throw new Error('Missing userId')

    // 1. Get Token
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('oura_token')
      .eq('user_id', userId)
      .single()

    if (settingsError || !settings?.oura_token) throw new Error('Oura token not found')

    const token = settings.oura_token
    const headers = { 'Authorization': `Bearer ${token}` }
    const today = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // 2. Fetch Data
    const [readinessData, sleepData, sleepStagesData, activityData] = await Promise.all([
      fetch(`${OURA_BASE_URL}/daily_readiness?start_date=${startDate}&end_date=${today}`, { headers }).then(res => res.json()),
      fetch(`${OURA_BASE_URL}/daily_sleep?start_date=${startDate}&end_date=${today}`, { headers }).then(res => res.json()),
      fetch(`${OURA_BASE_URL}/sleep?start_date=${startDate}&end_date=${today}`, { headers }).then(res => res.json()),
      fetch(`${OURA_BASE_URL}/daily_activity?start_date=${startDate}&end_date=${today}`, { headers }).then(res => res.json())
    ])

    // 3. Process
    const summaries: Record<string, any> = {}

    readinessData.data?.forEach((item: any) => {
      summaries[item.day] = { 
        ...summaries[item.day], 
        readiness_score: item.score, 
        date: item.day, 
        temp_deviation: item.contributors?.body_temperature // body_temperature is correct in readiness contributors
      }
    })

    sleepData.data?.forEach((item: any) => {
      summaries[item.day] = { 
        ...summaries[item.day], 
        hrv_avg: item.average_hrv,
        rhr_avg: item.average_heart_rate,
        date: item.day 
      }
    })

    sleepStagesData.data?.forEach((item: any) => {
      summaries[item.day] = { 
        ...summaries[item.day], 
        total_sleep_hours: item.total_sleep_duration / 3600,
        deep_sleep_hours: item.deep_sleep_duration / 3600,
        rem_sleep_hours: item.rem_sleep_duration / 3600,
        sleep_efficiency: item.efficiency,
        latency_minutes: item.latency / 60,
        bedtime_timestamp: item.bedtime_start,
        date: item.day 
      }
    })

    activityData.data?.forEach((item: any) => {
      summaries[item.day] = { ...summaries[item.day], steps: item.steps, date: item.day }
    })

    const upsertData = Object.values(summaries).map(s => {
      let isDisciplined = false
      if (s.bedtime_timestamp) {
        const timePart = s.bedtime_timestamp.split('T')[1]
        if (timePart) {
          const [h, m] = timePart.split(':').map(Number)
          if (h >= 18 && (h < 23 || (h === 23 && m < 30))) {
            isDisciplined = true
          }
        }
      }
      return {
        user_id: userId,
        date: s.date,
        readiness_score: s.readiness_score || null,
        total_sleep_hours: s.total_sleep_hours ? parseFloat(s.total_sleep_hours.toFixed(2)) : null,
        deep_sleep_hours: s.deep_sleep_hours ? parseFloat(s.deep_sleep_hours.toFixed(2)) : null,
        rem_sleep_hours: s.rem_sleep_hours ? parseFloat(s.rem_sleep_hours.toFixed(2)) : null,
        hrv_avg: s.hrv_avg || null,
        rhr_avg: s.rhr_avg || null,
        temp_deviation: s.temp_deviation || null,
        sleep_efficiency: s.sleep_efficiency || null,
        latency_minutes: s.latency_minutes ? Math.round(s.latency_minutes) : null,
        steps: s.steps || null,
        bedtime_timestamp: s.bedtime_timestamp || null,
        is_disciplined: isDisciplined
      }
    })

    if (upsertData.length > 0) {
      const { error: upsertError } = await supabase
        .from('oura_daily_summary')
        .upsert(upsertData, { onConflict: 'user_id,date' })
      
      if (upsertError) throw upsertError

      // Update Streak
      const { data: allSummaries } = await supabase
        .from('oura_daily_summary')
        .select('date, is_disciplined')
        .eq('user_id', userId)
        .order('date', { ascending: false })

      if (allSummaries) {
        let streak = 0
        const todayStr = new Date().toISOString().split('T')[0]
        for (const s of allSummaries) {
          if (s.is_disciplined) streak++
          else if (s.date === todayStr) continue
          else break
        }
        const total = allSummaries.filter((s: any) => s.is_disciplined).length

        await supabase
          .from('user_settings')
          .upsert({ user_id: userId, disciplined_streak: streak, total_disciplined_days: total })
      }
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
