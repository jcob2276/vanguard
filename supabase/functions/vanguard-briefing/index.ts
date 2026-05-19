import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId } = await req.json()
    if (!userId) throw new Error("Missing userId")

    console.log(`[briefing] start for user: ${userId}`)

    const now = new Date()
    const cut24h  = new Date(now.getTime() - 24  * 60 * 60 * 1000).toISOString()
    const cut72h  = new Date(now.getTime() - 72  * 60 * 60 * 1000).toISOString()
    const cut21d  = new Date(now.getTime() - 21  * 24 * 60 * 60 * 1000).toISOString()

    // 1. Fundament (identity anchor, nie aktualność)
    const { data: fundament } = await supabase
      .from('user_fundament')
      .select('identity, philosophy, vision')
      .eq('user_id', userId)
      .single()

    // 2. Stream — PRIMARY: ostatnie 24h (chronologicznie, bez LLM retrieval)
    const { data: stream24h } = await supabase
      .from('vanguard_stream')
      .select('content, category, created_at')
      .eq('user_id', userId)
      .gte('created_at', cut24h)
      .order('created_at', { ascending: true })
      .limit(25)

    // 3. Stream — EXPANDED: 24h–72h (tylko jeśli mało danych z 24h)
    const { data: stream72h } = await supabase
      .from('vanguard_stream')
      .select('content, category, created_at')
      .eq('user_id', userId)
      .gte('created_at', cut72h)
      .lt('created_at', cut24h)
      .order('created_at', { ascending: false })
      .limit(stream24h && stream24h.length >= 5 ? 3 : 12)

    // 4. Stream — PATTERN: 72h–21d (kontekst wzorca, oznaczony jako archiwum)
    const { data: streamPattern } = await supabase
      .from('vanguard_stream')
      .select('content, category, created_at')
      .eq('user_id', userId)
      .gte('created_at', cut21d)
      .lt('created_at', cut72h)
      .order('created_at', { ascending: false })
      .limit(8)

    // 5. Biometria — ostatnie 14 dni
    const { data: biometrics } = await supabase
      .from('vanguard_daily_aggregates')
      .select('date, final_state, execution_score, sleep_hours, hrv_avg, readiness_score')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(14)

    // 6. Graf — TYLKO current + declared, max 21 dni wstecz
    const { data: links } = await supabase
      .from('vanguard_entity_links')
      .select('source_entity, relation, target_entity, temporal_status, evidence_count')
      .eq('user_id', userId)
      .in('temporal_status', ['current', 'declared'])
      .gte('valid_from', cut21d)
      .order('evidence_count', { ascending: false })
      .limit(15)

    // 7. Friction events — ostatnie 72h
    const { data: recentFriction } = await supabase
      .from('friction_events')
      .select('friction_type, deviation, immediate_cost, occurred_at, confidence_source')
      .eq('user_id', userId)
      .gte('occurred_at', cut72h)
      .order('occurred_at', { ascending: false })

    // 8. Prowokacja z kolejki (pending, highest confidence)
    const { data: topProvocation } = await supabase
      .from('vanguard_curiosity_queue')
      .select('provocation, hypothesis, confidence_score')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('confidence_score', { ascending: false })
      .limit(1)
      .maybeSingle()

    // --- BUDOWANIE KONTEKSTU ---
    const stream24hText = (stream24h || []).length > 0
      ? (stream24h || []).map(s => `[${s.created_at}][${s.category}] ${s.content}`).join('\n')
      : 'Brak wpisów z ostatnich 24h.'

    const stream72hText = (stream72h || []).length > 0
      ? '[24h–72h temu]:\n' + (stream72h || []).map(s => `[${s.created_at}][${s.category}] ${s.content}`).join('\n')
      : ''

    const streamPatternText = (streamPattern || []).length > 0
      ? '[ARCHIWUM 72h–21d — tylko kontekst wzorca, nie aktualna prawda]:\n' +
        (streamPattern || []).map(s => `[${s.created_at}][${s.category}] ${s.content}`).join('\n')
      : ''

    const graphText = (links || []).length > 0
      ? '[GRAF — tylko current/declared, <21 dni]:\n' +
        (links || []).map(l => `${l.source_entity} --(${l.relation})--> ${l.target_entity} [${l.temporal_status}]`).join('\n')
      : 'Brak aktywnych krawędzi grafu z ostatnich 21 dni.'

    const frictionText = (recentFriction || []).length > 0
      ? '[FRICTION EVENTS (ostatnie 72h)]:\n' +
        (recentFriction || []).map(f =>
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
    const todayStr = now.toISOString().split('T')[0]
    const latestIsToday = latestAggregate?.date === todayStr
    const sleepPending = latestIsToday && latestAggregate?.sleep_hours == null
    const sleepStatusNote = sleepPending
      ? '\n[SLEEP DATA: pending — Oura nie zsynchronizował jeszcze dzisiejszego snu. Nie wnioskuj o jakości snu z ostatniej nocy.]'
      : ''

    const biometryText = (biometrics || []).length > 0
      ? `${biometricsStatusLabel}${sleepStatusNote}:\n` +
        (biometrics || []).map(b =>
          `${b.date}: stan=${b.final_state}, exec=${b.execution_score?.toFixed(2)}, sen=${b.sleep_hours != null ? b.sleep_hours + 'h' : 'pending'}, HRV=${b.hrv_avg ?? 'pending'}, readiness=${b.readiness_score ?? 'pending'}`
        ).join('\n')
      : 'Brak danych biometrycznych.'

    // --- LLM BRIEFING ---
    const briefingRequest = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.5,
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
6. Jeden konkretny mikrotest na dziś — nie wielki plan, jeden krok.

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

PROWOKACJA Z KOLEJKI (jeśli pasuje do danych):
${topProvocation ? topProvocation.provocation : 'Brak nowej hipotezy.'}`
          }
        ],
      }),
    })

    if (!briefingRequest.ok) {
      const errText = await briefingRequest.text().catch(() => 'unknown')
      throw new Error(`DeepSeek briefing error (${briefingRequest.status}): ${errText.substring(0, 200)}`)
    }
    const briefingData = await briefingRequest.json()
    const briefingText = briefingData.choices?.[0]?.message?.content || "Nie udało się wygenerować raportu."

    // Telegram
    const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')

    const telegramRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: `VANGUARD BRIEFING\n\n${briefingText}`,
      })
    })

    if (!telegramRes.ok) {
      const errorData = await telegramRes.json()
      console.error("[briefing] Telegram error:", errorData)
      throw new Error(`Telegram error: ${errorData.description}`)
    }

    console.log(`[briefing] done`)
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (err) {
    console.error("[briefing] error:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
