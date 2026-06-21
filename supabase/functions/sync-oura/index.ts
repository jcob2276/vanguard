import { safeExecute, createServiceClient, corsHeaders } from '../_shared/supabase.ts'

const OURA_BASE_URL = 'https://api.ouraring.com/v2/usercollection'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createServiceClient()

    const { userId } = await req.json()
    if (!userId) throw new Error('Missing userId')

    // 1. Get Token
    const settings = await safeExecute(
      supabase
        .from('user_settings')
        .select('oura_token')
        .eq('user_id', userId)
        .single()
    )
    if (!settings?.oura_token) throw new Error('Oura token not found')

    const token = settings.oura_token
    const headers = { 'Authorization': `Bearer ${token}` }
    
    // Zwiększamy okno synchronizacji dla pewności (7 dni zamiast 4)
    // Używamy daty z lekkim wyprzedzeniem dla end_date, aby obsłużyć przesunięcia stref czasowych
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // 2. Fetch Data
    console.log(`[OURA DEBUG] Fetching for range: ${startDate} to ${tomorrow}`);
    const [readinessRes, sleepRes, sleepStagesRes, activityRes] = await Promise.all([
      fetch(`${OURA_BASE_URL}/daily_readiness?start_date=${startDate}&end_date=${tomorrow}`, { signal: AbortSignal.timeout(15000), headers }),
      fetch(`${OURA_BASE_URL}/daily_sleep?start_date=${startDate}&end_date=${tomorrow}`, { signal: AbortSignal.timeout(15000), headers }),
      fetch(`${OURA_BASE_URL}/sleep?start_date=${startDate}&end_date=${tomorrow}`, { signal: AbortSignal.timeout(15000), headers }),
      fetch(`${OURA_BASE_URL}/daily_activity?start_date=${startDate}&end_date=${tomorrow}`, { signal: AbortSignal.timeout(15000), headers })
    ])

    if (!readinessRes.ok) throw new Error(`Oura readiness API error: ${readinessRes.status}`);
    if (!sleepRes.ok)     throw new Error(`Oura sleep API error: ${sleepRes.status}`);
    if (!sleepStagesRes.ok) throw new Error(`Oura sleep stages API error: ${sleepStagesRes.status}`);
    if (!activityRes.ok)  throw new Error(`Oura activity API error: ${activityRes.status}`);

    const readinessData = await readinessRes.json();
    const sleepData = await sleepRes.json();
    const sleepStagesData = await sleepStagesRes.json();
    const activityData = await activityRes.json();

    console.log(`[OURA DEBUG] Raw Readiness Keys: ${Object.keys(readinessData.data?.[0] || {})}`);
    console.log(`[OURA DEBUG] Raw Sleep Summary Keys: ${Object.keys(sleepData.data?.[0] || {})}`);

    // 3. Process
    const summaries: Record<string, any> = {}

    // 1. Process Readiness & Temp (from daily_readiness)
    readinessData.data?.forEach((item: any) => {
      summaries[item.day] = { 
        ...summaries[item.day], 
        readiness_score: item.score, 
        temp_deviation: item.temperature_deviation,
        date: item.day
      }
    })

    // 2. Process HRV & RHR (from daily_sleep)
    sleepData.data?.forEach((item: any) => {
      summaries[item.day] = { 
        ...summaries[item.day], 
        hrv_avg: item.average_hrv,
        rhr_avg: item.average_heart_rate,
        date: item.day 
      }
    })

    // 3. Process Sleep Stages & Durations (from sleep) - OFTEN MORE ACCURATE
    // /sleep can return multiple episodes per day (nap + night) — accumulate durations
    // instead of overwriting, otherwise the last episode processed wins and the rest
    // of that day's sleep silently vanishes.
    sleepStagesData.data?.forEach((item: any) => {
      const day = item.day || item.date;
      const prev = summaries[day] || {};
      const isLongestEpisode = (item.total_sleep_duration || 0) >= (prev._longestSleepDuration || 0);
      summaries[day] = {
        ...prev,
        total_sleep_hours: (prev.total_sleep_hours || 0) + item.total_sleep_duration / 3600,
        deep_sleep_hours: (prev.deep_sleep_hours || 0) + item.deep_sleep_duration / 3600,
        rem_sleep_hours: (prev.rem_sleep_hours || 0) + item.rem_sleep_duration / 3600,
        // Efficiency/latency/bedtime aren't additive — keep them from the longest episode (main sleep).
        sleep_efficiency: isLongestEpisode ? item.efficiency : prev.sleep_efficiency,
        latency_minutes: isLongestEpisode ? (item.latency != null ? Math.round(item.latency / 60) : null) : prev.latency_minutes,
        bedtime_timestamp: isLongestEpisode ? item.bedtime_start : prev.bedtime_timestamp,
        _longestSleepDuration: isLongestEpisode ? item.total_sleep_duration : prev._longestSleepDuration,
        // Fallback check: if summary was missing HRV, take it from detailed sleep
        hrv_avg: prev.hrv_avg ?? item.average_hrv,
        rhr_avg: prev.rhr_avg ?? item.average_heart_rate,
        date: day
      }
    })

    activityData.data?.forEach((item: any) => {
      summaries[item.day] = { 
        ...summaries[item.day], 
        steps: item.steps, 
        active_calories: item.active_calories,
        total_calories: item.total_calories,
        date: item.day 
      }
    })

    const upsertData = Object.values(summaries).map(s => {
      let isDisciplined = false
      if (s.bedtime_timestamp) {
        try {
          const dateObj = new Date(s.bedtime_timestamp)
          const formattedStr = dateObj.toLocaleTimeString('en-US', {
            timeZone: 'Europe/Warsaw',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          })
          const [h, m] = formattedStr.split(':').map(Number)
          if (h >= 18 && (h < 23 || (h === 23 && m < 30))) {
            isDisciplined = true
          }
        } catch (e) {
          console.error(`[OURA] Failed to parse bedtime timestamp: ${s.bedtime_timestamp}`, e)
        }
      }
      
      // LOGGING FOR EACH DAY
      console.log(`[OURA DEBUG] Day ${s.date}: Readiness=${s.readiness_score}, HRV=${s.hrv_avg}, ActiveCal=${s.active_calories}`);

      return {
        user_id: userId,
        date: s.date,
        readiness_score: s.readiness_score ?? null,
        total_sleep_hours: s.total_sleep_hours ? parseFloat(s.total_sleep_hours.toFixed(2)) : null,
        deep_sleep_hours: s.deep_sleep_hours ? parseFloat(s.deep_sleep_hours.toFixed(2)) : null,
        rem_sleep_hours: s.rem_sleep_hours ? parseFloat(s.rem_sleep_hours.toFixed(2)) : null,
        hrv_avg: s.hrv_avg ? Math.round(s.hrv_avg) : null,
        rhr_avg: s.rhr_avg ? parseFloat(s.rhr_avg.toFixed(1)) : null,
        temp_deviation: s.temp_deviation ?? null,
        sleep_efficiency: s.sleep_efficiency ?? null,
        latency_minutes: s.latency_minutes ? Math.round(s.latency_minutes) : null,
        steps: s.steps ?? null,
        active_calories: s.active_calories ?? null,
        total_calories: s.total_calories ?? null,
        bedtime_timestamp: s.bedtime_timestamp ?? null,
        is_disciplined: isDisciplined
      }
    })

    if (upsertData.length > 0) {
      await safeExecute(
        supabase
          .from('oura_daily_summary')
          .upsert(upsertData, { onConflict: 'user_id,date' })
      )
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
