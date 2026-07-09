import { safeExecute, createServiceClient, corsHeaders, resolveUserScope } from '../_shared/supabase.ts'
import { runEnhanced } from './enhanced.ts'
import { runTimeseries } from './timeseries.ts'
import { sendMessage } from '../_shared/telegram.ts'

const OURA_BASE_URL = 'https://api.ouraring.com/v2/usercollection'

export async function runOuraSync(req: Request): Promise<Response> {
  try {
    const supabase = createServiceClient()

    const body = await req.json().catch(() => ({}))
    const { start_date, end_date } = body
    const { userId: scopedUserId } = await resolveUserScope(req, body.userId ?? null)
    const userId = scopedUserId ?? body.userId
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

    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const resolvedEnd = end_date || tomorrow
    const resolvedStart = start_date || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Split into 90-day batches to avoid Oura API / edge function timeouts on large ranges
    function dateBatches(start: string, end: string, batchDays = 90): Array<[string, string]> {
      const batches: Array<[string, string]> = []
      let cur = new Date(start + 'T12:00:00Z')
      const endD = new Date(end + 'T12:00:00Z')
      while (cur < endD) {
        const batchEnd = new Date(Math.min(cur.getTime() + batchDays * 86400_000, endD.getTime()))
        batches.push([cur.toISOString().split('T')[0], batchEnd.toISOString().split('T')[0]])
        cur = new Date(batchEnd.getTime() + 86400_000)
      }
      return batches
    }

    const batches = dateBatches(resolvedStart, resolvedEnd)
    console.log(`[OURA BACKFILL] ${resolvedStart} → ${resolvedEnd} — ${batches.length} batches`)

    let totalUpserted = 0
    const warnings: string[] = []

    for (const [batchStart, batchEnd] of batches) {
      try {
        // 2. Fetch Data
        console.log(`[OURA DEBUG] Fetching for range: ${batchStart} to ${batchEnd}`);
        const [readinessRes, sleepRes, sleepStagesRes, activityRes] = await Promise.all([
          fetch(`${OURA_BASE_URL}/daily_readiness?start_date=${batchStart}&end_date=${batchEnd}`, { signal: AbortSignal.timeout(30000), headers }),
          fetch(`${OURA_BASE_URL}/daily_sleep?start_date=${batchStart}&end_date=${batchEnd}`, { signal: AbortSignal.timeout(30000), headers }),
          fetch(`${OURA_BASE_URL}/sleep?start_date=${batchStart}&end_date=${batchEnd}`, { signal: AbortSignal.timeout(30000), headers }),
          fetch(`${OURA_BASE_URL}/daily_activity?start_date=${batchStart}&end_date=${batchEnd}`, { signal: AbortSignal.timeout(30000), headers })
        ])

        if (!readinessRes.ok) throw new Error(`Oura readiness API error: ${readinessRes.status}`);
        if (!sleepRes.ok)     throw new Error(`Oura sleep API error: ${sleepRes.status}`);
        if (!sleepStagesRes.ok) throw new Error(`Oura sleep stages API error: ${sleepStagesRes.status}`);
        if (!activityRes.ok)  throw new Error(`Oura activity API error: ${activityRes.status}`);

        const readinessData = await readinessRes.json();
        const sleepData = await sleepRes.json();
        const sleepStagesData = await sleepStagesRes.json();
        const activityData = await activityRes.json();

        // 3. Process
        const summaries: Record<string, any> = {}

        readinessData.data?.forEach((item: any) => {
          summaries[item.day] = { ...summaries[item.day], readiness_score: item.score, temp_deviation: item.temperature_deviation, date: item.day }
        })

        sleepData.data?.forEach((item: any) => {
          summaries[item.day] = { ...summaries[item.day], hrv_avg: item.average_hrv, rhr_avg: item.average_heart_rate, sleep_score: item.score, date: item.day }
        })

        sleepStagesData.data?.forEach((item: any) => {
          const day = item.day || item.date;
          const prev = summaries[day] || {};
          const isLongestEpisode = (item.total_sleep_duration || 0) >= (prev._longestSleepDuration || 0);
          summaries[day] = {
            ...prev,
            total_sleep_hours: (prev.total_sleep_hours || 0) + item.total_sleep_duration / 3600,
            deep_sleep_hours: (prev.deep_sleep_hours || 0) + item.deep_sleep_duration / 3600,
            rem_sleep_hours: (prev.rem_sleep_hours || 0) + item.rem_sleep_duration / 3600,
            sleep_efficiency: isLongestEpisode ? item.efficiency : prev.sleep_efficiency,
            latency_minutes: isLongestEpisode ? (item.latency != null ? Math.round(item.latency / 60) : null) : prev.latency_minutes,
            bedtime_timestamp: isLongestEpisode ? item.bedtime_start : prev.bedtime_timestamp,
            _longestSleepDuration: isLongestEpisode ? item.total_sleep_duration : prev._longestSleepDuration,
            hrv_avg: prev.hrv_avg ?? item.average_hrv,
            rhr_avg: prev.rhr_avg ?? item.average_heart_rate,
            date: day
          }
        })

        activityData.data?.forEach((item: any) => {
          summaries[item.day] = { ...summaries[item.day], steps: item.steps, active_calories: item.active_calories, total_calories: item.total_calories, date: item.day }
        })

        const upsertData = Object.values(summaries).map(s => {
          let isDisciplined = false
          if (s.bedtime_timestamp) {
            try {
              const formattedStr = new Date(s.bedtime_timestamp).toLocaleTimeString('en-US', { timeZone: 'Europe/Warsaw', hour12: false, hour: '2-digit', minute: '2-digit' })
              const [h, m] = formattedStr.split(':').map(Number)
              if (h >= 18 && (h < 23 || (h === 23 && m < 30))) isDisciplined = true
            } catch (e) { /* ignore */ }
          }
          return {
            user_id: userId,
            date: s.date,
            readiness_score: s.readiness_score ?? null,
            sleep_score: s.sleep_score ?? null,
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
            supabase.from('oura_daily_summary').upsert(upsertData, { onConflict: 'user_id,date' })
          )
          
          // Proactive low biometrics push alert
          for (const row of upsertData) {
            const lowReadiness = row.readiness_score && row.readiness_score < 40;
            const lowEfficiency = row.sleep_efficiency && row.sleep_efficiency < 75;
            if (lowReadiness || lowEfficiency) {
              const todayStr = row.date;
              const { data: alreadyLogged } = await supabase
                .from("audit_events")
                .select("id")
                .eq("user_id", userId)
                .eq("event_type", "low_biometrics_alert")
                .eq("related_id", todayStr)
                .maybeSingle();

               if (!alreadyLogged) {
                const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID");
                const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
                if (telegramChatId && telegramToken) {
                  const alertMsg = lowReadiness
                    ? `⚠️ Oura (${todayStr}): readiness score ${row.readiness_score}%`
                    : `⚠️ Oura (${todayStr}): sleep efficiency ${row.sleep_efficiency}%`;

                  await sendMessage(telegramToken, Number(telegramChatId), alertMsg).catch((e) => {
                    console.error("[OURA] Failed to send Telegram push alert:", e);
                  });

                  await supabase.from("audit_events").insert({
                    user_id: userId,
                    event_type: "low_biometrics_alert",
                    severity: "warning",
                    message: alertMsg,
                    related_table: "oura_daily_summary",
                    related_id: todayStr
                  });
                }
              }
            }
          }

          totalUpserted += upsertData.length
          console.log(`[OURA] batch ${batchStart}→${batchEnd}: ${upsertData.length} rows upserted`)
        }
      } catch (batchErr: any) {
        const msg = `batch ${batchStart}→${batchEnd}: ${batchErr?.message || batchErr}`
        console.error(`[OURA] ${msg}`)
        warnings.push(msg)
      }
    } // end batch loop

    // Run Stage 2 and 3
    console.log('[OURA] Running Enhanced...');
    // We create a fresh Request to pass the userId/days inside body to sub-handlers
    const subReq = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify({ userId, days: start_date ? undefined : 7 })
    })
    await runEnhanced(subReq).catch(e => console.error('[OURA] Enhanced Error', e));

    console.log('[OURA] Running Timeseries...');
    await runTimeseries(subReq).catch(e => console.error('[OURA] Timeseries Error', e));

    return new Response(JSON.stringify({
      success: true,
      total_upserted: totalUpserted,
      batches: batches.length,
      ...(warnings.length ? { warnings } : {}),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
