import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const VANGUARD_USER_ID = '165ae341-670c-46ce-82dc-434c4dbfcdfd'

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

    const now = new Date()
    const cut7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const weekStart = cut7d.toISOString().split('T')[0]
    const weekEnd = now.toISOString().split('T')[0]

    console.log(`[weekly-synthesis] start | ${weekStart} – ${weekEnd}`)

    // 1. Friction events — last 7 days
    const { data: frictionEvents } = await supabase
      .from('friction_events')
      .select('friction_type, deviation, declared_intention, actual_behavior, occurred_at')
      .eq('user_id', VANGUARD_USER_ID)
      .gte('occurred_at', cut7d.toISOString())
      .order('occurred_at', { ascending: false })

    // 2. Biometrics — last 7 days
    const { data: biometrics } = await supabase
      .from('vanguard_daily_aggregates')
      .select('date, sleep_hours, hrv_avg, readiness_score, execution_score, final_state')
      .eq('user_id', VANGUARD_USER_ID)
      .gte('date', weekStart)
      .order('date', { ascending: false })

    // 3. Planning sessions this week
    const { data: plannings } = await supabase
      .from('daily_reconciliations')
      .select('date, type')
      .eq('user_id', VANGUARD_USER_ID)
      .gte('date', weekStart)
      .eq('type', 'planning')

    // 4. Top hypotheses from curiosity_queue
    const { data: topHypotheses } = await supabase
      .from('vanguard_curiosity_queue')
      .select('hypothesis, provocation, confidence_score, category')
      .eq('user_id', VANGUARD_USER_ID)
      .eq('status', 'pending')
      .order('confidence_score', { ascending: false })
      .limit(3)

    // 5. Stream — last 7 days for context
    const { data: stream } = await supabase
      .from('vanguard_stream')
      .select('content, created_at, category')
      .eq('user_id', VANGUARD_USER_ID)
      .gte('created_at', cut7d.toISOString())
      .not('source', 'eq', 'system')
      .order('created_at', { ascending: false })
      .limit(35)

    // --- Aggregate friction by type ---
    const frictionByType: Record<string, number> = {}
    for (const e of (frictionEvents || [])) {
      if (e.friction_type) {
        frictionByType[e.friction_type] = (frictionByType[e.friction_type] || 0) + 1
      }
    }
    const frictionSorted = Object.entries(frictionByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    // --- Biometric averages ---
    const bio = biometrics || []
    const sleepDays = bio.filter(b => b.sleep_hours != null)
    const hrvDays = bio.filter(b => b.hrv_avg != null)
    const execDays = bio.filter(b => b.execution_score != null)

    const avgSleep = sleepDays.length
      ? (sleepDays.reduce((s, b) => s + b.sleep_hours, 0) / sleepDays.length).toFixed(1)
      : null
    const avgHrv = hrvDays.length
      ? Math.round(hrvDays.reduce((s, b) => s + b.hrv_avg, 0) / hrvDays.length)
      : null
    const avgExec = execDays.length
      ? Math.round(execDays.reduce((s, b) => s + b.execution_score, 0) / execDays.length * 100)
      : null

    // --- Build LLM context ---
    const frictionText = frictionSorted.length > 0
      ? frictionSorted.map(([type, count]) => `${type}: ${count}x`).join(' | ')
      : 'brak'

    const frictionDetails = (frictionEvents || []).slice(0, 12)
      .map(e => `[${e.occurred_at?.split('T')[0]}] ${e.friction_type}: ${e.deviation || e.actual_behavior || '—'}`)
      .join('\n')

    const bioText = [
      `Sen: ${avgSleep ?? 'brak'}h (${sleepDays.length} dni)`,
      `HRV: ${avgHrv ?? 'brak'} (${hrvDays.length} dni)`,
      `Wykonanie Top3: ${avgExec != null ? avgExec + '%' : 'brak'} (${execDays.length} dni)`,
    ].join(' | ')

    const hypothesesText = (topHypotheses || []).length > 0
      ? (topHypotheses || []).map(h =>
          `[${h.category}, conf=${h.confidence_score?.toFixed(2)}] ${h.hypothesis}`
        ).join('\n')
      : 'Brak hipotez w kolejce.'

    const streamText = (stream || [])
      .map(s => `[${s.created_at?.split('T')[0]}][${s.category || '—'}] ${s.content}`)
      .join('\n')

    // --- LLM synthesis ---
    const llmRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        temperature: 0.4,
        max_tokens: 600,
        messages: [
          {
            role: 'system',
            content: `Jesteś Vanguard OS. Generujesz TYGODNIOWĄ SYNTEZĘ behawioralną.

ZASADY ABSOLUTNE:
1. Tylko to co jawnie widać w danych — bez psychoanalizy motywów
2. Liczby są źródłem prawdy — podaj je konkretnie
3. Jeden wzorzec który naprawdę widać w danych (nie spekuluj)
4. Hipoteza systemu: wybierz jedną z kolejki TYLKO jeśli pasuje do danych tygodnia. Jeśli żadna nie pasuje — napisz "brak pasującej hipotezy"
5. Pytanie na następne 7 dni: konkretne, operacyjne — nie motywacyjne, nie ogólne

FORMAT (trzymaj się dokładnie tej struktury, po polsku):

TYDZIEŃ [data_od] – [data_do]

LICZBY
• Friction: [top typy z liczbami]
• Biometria: [sen, HRV, wykonanie]
• Plany wieczorne: [liczba] z 7 dni

WZORZEC TYGODNIA
[1-3 zdania. Tylko obserwacja z danych. Brak ocen i interpretacji motywów.]

HIPOTEZA SYSTEMU
[Jedna hipoteza z kolejki lub "brak pasującej hipotezy"]

PYTANIE NA NASTĘPNE 7 DNI
[Jedno pytanie. Max 20 słów. Operacyjne, nie filozoficzne.]`
          },
          {
            role: 'user',
            content: `OKRES: ${weekStart} – ${weekEnd}

BIOMETRIA (${bio.length} dni danych):
${bioText}

FRICTION EVENTS — typy:
${frictionText}

FRICTION DETAILS:
${frictionDetails || 'brak'}

SESJE PLANOWANIA WIECZORNEGO: ${(plannings || []).length} z 7 dni

HIPOTEZY Z KOLEJKI (top 3 wg confidence):
${hypothesesText}

STRUMIEŃ (ostatnie 7 dni):
${streamText || 'brak wpisów'}`
          }
        ],
      }),
    })

    if (!llmRes.ok) {
      const err = await llmRes.text().catch(() => 'unknown')
      throw new Error(`DeepSeek error (${llmRes.status}): ${err.substring(0, 200)}`)
    }

    const llmData = await llmRes.json()
    const synthesisText = llmData.choices?.[0]?.message?.content?.trim()
    if (!synthesisText) throw new Error('LLM returned empty synthesis')

    // --- Send to Telegram ---
    const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')

    const telegramRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: `📊 SYNTEZA TYGODNIOWA\n\n${synthesisText}\n\n─────\nOdpisz na pytanie powyżej — odpowiedź leci do strumienia i otwiera planning na następne 7 dni.`,
      })
    })

    if (!telegramRes.ok) {
      const err = await telegramRes.json()
      throw new Error(`Telegram error: ${err.description}`)
    }

    // --- Log to stream ---
    await supabase.from('vanguard_stream').insert({
      user_id: VANGUARD_USER_ID,
      content: `[weekly synthesis sent] ${weekStart} – ${weekEnd} | friction: ${frictionSorted.map(([t, c]) => `${t}:${c}`).join(',')}`,
      source: 'system',
      classification: 'system:weekly',
    })

    console.log(`[weekly-synthesis] done`)
    return new Response(JSON.stringify({ success: true, week: `${weekStart} – ${weekEnd}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (err: any) {
    console.error('[weekly-synthesis] error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
