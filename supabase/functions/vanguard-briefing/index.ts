import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { sendMessageParsed } from "../_shared/telegram.ts"
import { createServiceClient, safeExecute, corsHeaders } from "../_shared/supabase.ts"
import { fetchBriefingStreamLayers, formatBriefingStreamText } from "../_shared/streamContext.ts"
import { getStreamCutoffs } from "../_shared/time.ts"
import { deepseekChat } from "../_shared/deepseek.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createServiceClient()

    const { userId } = await req.json()
    if (!userId) throw new Error("Missing userId")

    console.log(`[briefing] start for user: ${userId}`)

    const { cut72h: cut72h, cut21d } = getStreamCutoffs()

    const fundament = await safeExecute(
      supabase.from('user_fundament')
        .select('identity, philosophy, vision')
        .eq('user_id', userId)
        .maybeSingle(),
    )

    const streamLayers = await fetchBriefingStreamLayers(supabase, userId)

    const biometrics = await safeExecute(
      supabase.from('vanguard_daily_aggregates')
        .select('date, final_state, execution_score, sleep_hours, hrv_avg, readiness_score')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(14),
    )

    const links = await safeExecute(
      supabase.from('vanguard_entity_links')
        .select('source_entity, relation, target_entity, temporal_status, evidence_count')
        .eq('user_id', userId)
        .in('temporal_status', ['current', 'declared'])
        .gte('valid_from', cut21d)
        .order('evidence_count', { ascending: false })
        .limit(15),
    )

    const recentFriction = await safeExecute(
      supabase.from('friction_events')
        .select('friction_type, deviation, immediate_cost, occurred_at, confidence_source')
        .eq('user_id', userId)
        .gte('occurred_at', cut72h)
        .order('occurred_at', { ascending: false }),
    )

    const topProvocation = await safeExecute(
      supabase.from('vanguard_curiosity_queue')
        .select('provocation, hypothesis, confidence_score')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('confidence_score', { ascending: false })
        .limit(1)
        .maybeSingle(),
    )

    const latestOura = await safeExecute(
      supabase.from('oura_daily_summary')
        .select('date, total_sleep_hours, hrv_avg, readiness_score')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    )

    // Strava: aktywności z ostatnich 7 dni
    const now = new Date()
    const todayWarsawStr = now.toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' })
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const stravaActivities = await safeExecute(
      supabase.from('strava_activities_clean')
        .select('name,sport_type,start_date,elapsed_time,moving_time,distance,average_heartrate,max_heartrate,total_elevation_gain,calories,gc_hr_zones,gc_weather,gc_training_effect_aerobic,gc_training_effect_anaerobic,gc_vo2max,gc_enriched_at')
        .eq('user_id', userId)
        .gte('start_date', sevenDaysAgo)
        .order('start_date', { ascending: false })
    )

    const { stream24hText, stream72hText, streamPatternText } = formatBriefingStreamText(streamLayers)

    // Format Strava activities
    function fmtPaceBrief(movingTime: number, distanceM: number): string {
      if (!movingTime || !distanceM) return '—'
      const sPerKm = movingTime / (distanceM / 1000)
      return `${Math.floor(sPerKm / 60)}:${String(Math.round(sPerKm % 60)).padStart(2, '0')} /km`
    }
    function fmtTimeBrief(sec: number): string {
      if (!sec) return '—'
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
      return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`
    }

    const stravaText = ((stravaActivities as any[]) || []).length > 0
      ? '[AKTYWNOŚCI — ostatnie 7 dni]:\n' +
        ((stravaActivities as any[]) || []).map((a: any) => {
          const dt = new Date(a.start_date).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          const dist = a.distance ? `${(a.distance / 1000).toFixed(2)} km` : '—'
          const pace = fmtPaceBrief(a.moving_time, a.distance)
          const dur  = fmtTimeBrief(a.moving_time || a.elapsed_time)
          const hr   = a.average_heartrate ? `HR śr. ${Math.round(a.average_heartrate)} / max ${a.max_heartrate}` : 'brak HR'
          const ele  = a.total_elevation_gain ? `↑${Math.round(a.total_elevation_gain)}m` : ''
          let line = `• ${dt} | ${a.sport_type} "${a.name}" | ${dist} | ${dur} | tempo ${pace} | ${hr}${ele ? ' | ' + ele : ''}`
          if (a.gc_enriched_at) {
            const gc: string[] = []
            if (a.gc_training_effect_aerobic != null) gc.push(`TE aerob ${a.gc_training_effect_aerobic}`)
            if (a.gc_training_effect_anaerobic != null) gc.push(`TE anaerob ${a.gc_training_effect_anaerobic}`)
            if (a.gc_vo2max != null) gc.push(`VO2max ${a.gc_vo2max}`)
            if (a.gc_weather?.temp_c != null) gc.push(`${a.gc_weather.temp_c}°C${a.gc_weather.condition ? ` ${a.gc_weather.condition}` : ''}`)
            if (Array.isArray(a.gc_hr_zones)) {
              const zones = a.gc_hr_zones.map((z: any, i: number) => {
                const mins = z.secsInZone != null ? Math.round(z.secsInZone / 60) : null
                return mins != null && mins > 0 ? `Z${i + 1}:${mins}min` : null
              }).filter(Boolean).join(' ')
              if (zones) gc.push(`strefy [${zones}]`)
            }
            if (gc.length) line += ` | GC: ${gc.join(' | ')}`
          }
          return line
        }).join('\n')
      : 'Brak aktywności Strava z ostatnich 7 dni.'

    const graphText = (links || []).length > 0
      ? '[GRAF — tylko current/declared, <21 dni]:\n' +
        (links || []).map((l: any) => `${l.source_entity} --(${l.relation})--> ${l.target_entity} [${l.temporal_status}]`).join('\n')
      : 'Brak aktywnych krawędzi grafu z ostatnich 21 dni.'

    const frictionText = (recentFriction || []).length > 0
      ? '[FRICTION EVENTS (ostatnie 72h)]:\n' +
        (recentFriction || []).map((f: any) =>
          `- ${f.friction_type} | ${f.occurred_at} | koszt: ${f.immediate_cost || '—'} | odchylenie: ${f.deviation || '—'} [${f.confidence_source}]`
        ).join('\n')
      : 'Brak zalogowanych friction events z ostatnich 72h.'

    // Freshness guard — agregaty starsze niż 48h = stale
    const latestAggregate = (biometrics || [])[0]
    const aggregateDate = latestAggregate ? new Date(latestAggregate.date) : null
    const hoursStale = aggregateDate
      ? (now.getTime() - aggregateDate.getTime()) / (1000 * 60 * 60)
      : Infinity
    const biometricsStale = hoursStale > 48
    const biometricsStatusLabel = biometricsStale
      ? `[BIOMETRIA STALE — ostatnie dane z ${latestAggregate?.date}, ${Math.floor(hoursStale / 24)} dni temu. Nie wnioskuj o aktualnym stanie ciała.]`
      : '[BIOMETRIA — ostatnie 14 dni]'

    // Sleep data status — Oura synchronizuje sen dopiero po manualnym otwarciu aplikacji
    const sleepPending = !latestOura || latestOura.date !== todayWarsawStr
    const sleepStatusNote = sleepPending
      ? '\n[SLEEP DATA: pending — Oura nie zsynchronizował jeszcze dzisiejszego snu. Nie wnioskuj o jakości snu z ostatniej nocy.]'
      : ''

    let biometryText = 'Brak danych biometrycznych.'
    if ((biometrics || []).length > 0 || (!sleepPending && latestOura)) {
      let biometryLines = (biometrics || []).map((b: any) =>
        `${b.date}: stan=${b.final_state}, exec=${b.execution_score?.toFixed(2)}, sen=${b.sleep_hours != null ? b.sleep_hours + 'h' : 'pending'}, HRV=${b.hrv_avg ?? 'pending'}, readiness=${b.readiness_score ?? 'pending'}`
      )

      if (!sleepPending && latestOura) {
        const todayLine = `${latestOura.date}: stan=pending (w trakcie dnia), exec=pending, sen=${latestOura.total_sleep_hours}h, HRV=${latestOura.hrv_avg ?? 'pending'}, readiness=${latestOura.readiness_score ?? 'pending'}`
        if (!biometrics?.some((b: any) => b.date === latestOura.date)) {
          biometryLines.unshift(todayLine)
        }
      }

      biometryText = `${biometricsStatusLabel}${sleepStatusNote}:\n` + biometryLines.join('\n')
    }

    // --- LLM BRIEFING ---
    const briefingResult = await deepseekChat({
      apiKey: Deno.env.get('DEEPSEEK_API_KEY') ?? '',
      model: 'deepseek-v4-flash',
      temperature: 0.5,
      maxTokens: null,
      messages: [
          {
            role: 'system',
            content: `Jesteś Vanguard OS — systemem logowania mikrotarć i wykrywania wzorców behawioralnych.
MÓWISZ TYLKO PO POLSKU.

ZASADY ABSOLUTNE:
1. CURRENT-FIRST: Sekcja "Stan obecny" opiera się WYŁĄCZNIE na danych z ostatnich 24h.
2. NO TEMPORAL COLLAPSE: Nigdy nie mieszaj faktów aktualnych z archiwalnymi jako jedną prawdę.
3. Dane z [ARCHIWUM] mogą pojawić się TYLKO w sekcji "Wzorzec" i z jawnym oznaczeniem "wcześniej".
4. Jeśli brak danych z 24h — napisz wprost: "Brak danych z ostatnich 24h."
5. Friction events (jeśli są) — wymień konkretnie, bez interpretacji psychologicznych.
6. Jeden konkretny mikrotest na dziś — nie wielki plan, jeden krok. Mikrotest musi być możliwy do zrelacjonowania głosówką wieczorem — bez specjalnych formatów, bez TAK/NIE pisania, bez klikania.

ZAKAZ:
- Psychoanalizy i interpretacji motywów
- Tez bez źródła danych
- Mieszania starych deklaracji z aktualnym zachowaniem jako jednej prawdy

STRUKTURA (trzymaj się jej):
1. STAN OBECNY (TYLKO ostatnie 24h — co się faktycznie działo)
2. FRICTION EVENTS (jeśli są z ostatnich 72h — sucho, bez oceny)
3. WZORZEC (opcjonalnie, tylko jeśli jest powtórzenie w danych, oznacz źródło)
4. JEDEN MIKROTEST NA DZIŚ (jedno konkretne zachowanie do przetestowania)`
          },
          {
            role: 'user',
            content: `TOŻSAMOŚĆ (kontekst bazowy, nie cytować):
${fundament?.identity || 'Brak'}

STRUMIEŃ — OSTATNIE 24H (PRIORYTET ABSOLUTNY):
${stream24hText}

${stream72hText}

${streamPatternText}

${frictionText}

${biometryText}

${graphText}

AKTYWNOŚCI FIZYCZNE:
${stravaText}

PROWOKACJA Z KOLEJKI (jeśli pasuje do danych):
${topProvocation ? topProvocation.provocation : 'Brak nowej hipotezy.'}`
          }
        ],
    })
    const briefingText = briefingResult.content || "Nie udalo sie wygenerowac raportu."

    // Telegram
    const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
    const TELEGRAM_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '0', 10)

    const telegramResult = await sendMessageParsed(
      TELEGRAM_TOKEN,
      TELEGRAM_CHAT_ID,
      `VANGUARD BRIEFING\n\n${briefingText}`,
      {
        replyMarkup: {
          inline_keyboard: [[
            { text: '✅ OK, czytam', callback_data: 'briefing_ok' },
          ]]
        }
      }
    )
    if (!telegramResult.ok) {
      throw new Error(`Telegram error: ${telegramResult.description}`)
    }

    // Leave a pending record so the Telegram router knows the user is in
    // "briefing response" context for the next 2h. Voice notes sent in this
    // window go to stream (not knowledge) and are tagged as briefing reactions.
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
    await supabase.from('daily_reconciliations').insert({
      user_id:             userId,
      date:                todayStr,
      mode:                'briefing_response',
      status:              'sent',
      morning_sent_at:     new Date().toISOString(),
      telegram_message_id: telegramResult.messageId ?? null,
    }).then(({ error }: { error: any }) => {
      if (error) console.warn('[briefing] failed to insert briefing_response record:', error.message)
    })

    console.log(`[briefing] done`)
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (err: any) {
    console.error("[briefing] error:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
