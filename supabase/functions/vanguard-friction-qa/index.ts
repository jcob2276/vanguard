import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { sendMessage } from "../_shared/telegram.ts"
import { createServiceClient, safeExecute, corsHeaders } from "../_shared/supabase.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createServiceClient()

    const users = await safeExecute(supabase.from('user_settings').select('user_id'))
    const user_id = users?.[0]?.user_id
    if (!user_id) throw new Error("User not found")

    const now = new Date()
    const cut48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
    const cut7d  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()

    // 1. Stream z ostatnich 48h
    const recentStream = await safeExecute(
      supabase.from('vanguard_stream')
        .select('id, content, created_at, category')
        .eq('user_id', user_id)
        .gte('created_at', cut48h)
        .order('created_at', { ascending: false }),
    )

    const streamIds = (recentStream || []).map((s: any) => s.id)

    const linkedFriction = streamIds.length > 0
      ? await safeExecute(
          supabase.from('friction_events')
            .select('id, stream_record_id, friction_type, event_kind, declared_intention, actual_behavior, deviation, immediate_cost, later_cost, confidence, confidence_source, status, occurred_at')
            .eq('user_id', user_id)
            .in('stream_record_id', streamIds),
        )
      : []

    const allFriction7d = await safeExecute(
      supabase.from('friction_events')
        .select('friction_type, event_kind, status, confidence, immediate_cost')
        .eq('user_id', user_id)
        .gte('occurred_at', cut7d),
    )

    // --- ANALIZA ---
    const stream = recentStream || []
    const linked = linkedFriction || []
    const all7d  = allFriction7d  || []

    const linkedIds = new Set(linked.map((f: any) => f.stream_record_id))

    // Stream bez friction events (potencjalne missy)
    const noFriction = stream.filter((s: any) => !linkedIds.has(s.id))

    // Typy z 7 dni i statystyki event_kind
    const typeCounts: Record<string, number> = {}
    const kindCounts: Record<string, number> = {
      friction_event: 0,
      positive_micro_action: 0,
      state_observation: 0,
      micro_behavior_observation: 0,
      reflection: 0
    }
    for (const f of all7d) {
      if (f.friction_type) typeCounts[f.friction_type] = (typeCounts[f.friction_type] || 0) + 1
      const k = f.event_kind || 'friction_event'
      kindCounts[k] = (kindCounts[k] || 0) + 1
    }
    const typesSorted = Object.entries(typeCounts)
      .sort(([,a],[,b]) => b - a)
      .map(([t, n]) => `  ${t}: ${n}x`)
      .join('\n')

    // Koszty
    const withCost    = linked.filter((f: any) => f.immediate_cost !== null).length
    const withoutCost = linked.filter((f: any) => f.immediate_cost === null).length

    // Przykłady z 48h — po 2 dobre i 2 podejrzane
    const withDeviation = linked.filter((f: any) => f.deviation !== null).slice(0, 2)
    const noDeviation   = linked.filter((f: any) => f.deviation === null).slice(0, 2)

    const examplesGood = withDeviation.map((f: any) =>
      `✅ ${f.friction_type}\n    intencja: ${f.declared_intention || '—'}\n    zachowanie: ${f.actual_behavior || '—'}\n    koszt: ${f.immediate_cost || 'null'}`
    ).join('\n\n')

    const examplesCheck = noDeviation.map((f: any) =>
      `⚠️ ${f.friction_type} (brak deviation)\n    zachowanie: ${f.actual_behavior || '—'}\n    koszt: ${f.immediate_cost || 'null'}`
    ).join('\n\n')

    const missExamples = noFriction.slice(0, 3).map((s: any) =>
      `❓ [${s.category}] ${(s.content || '').substring(0, 80)}...`
    ).join('\n')

    // Confidence stats
    const confValues = linked.map((f: any) => f.confidence).filter((c: any) => c !== null) as number[]
    const avgConf = confValues.length > 0
      ? (confValues.reduce((a,b) => a+b, 0) / confValues.length).toFixed(2)
      : 'n/a'

    const extractionRate = stream.length > 0
      ? Math.round(100 * linked.length / stream.length)
      : 0

    // --- FORMAT RAPORTU ---
    const dateStr = now.toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit' })

    const report = `VANGUARD FRICTION QA — ${dateStr}

PIPELINE (ostatnie 48h)
  stream wpisów:      ${stream.length}
  friction events:    ${linked.length}
  brak eventu:        ${noFriction.length}
  extraction rate:    ${extractionRate}%

OBSERWACJE (ostatnie 7 dni)
  tarcia behawioralne: ${kindCounts.friction_event}x
  pozytywne gesty:     ${kindCounts.positive_micro_action}x
  stany/emocje:        ${kindCounts.state_observation}x
  mikro-zachowania:    ${kindCounts.micro_behavior_observation}x
  refleksje:           ${kindCounts.reflection}x

JAKOŚĆ (ostatnie 48h)
  z kosztem (jawnym): ${withCost}
  bez kosztu (null):  ${withoutCost}
  avg confidence:     ${avgConf}

TYPY (ostatnie 7 dni, ${all7d.length} eventów)
${typesSorted || '  brak danych'}

PRZYKŁADY — DOBRE EKSTRAKCJE
${examplesGood || '  brak z ostatnich 48h'}

PRZYKŁADY — DO PRZEJRZENIA (brak deviation)
${examplesCheck || '  wszystko OK'}

POTENCJALNE MISSY (stream bez eventu)
${missExamples || '  brak — wszystkie wpisy mają event lub nie wymagają'}

---
Zrób: SELECT * FROM v_friction_pipeline_status;
aby przejrzeć pełną listę z ostatnich 48h.`

    // Telegram
    const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')

    if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
      const chatId = parseInt(TELEGRAM_CHAT_ID, 10);
      const tgRes = await sendMessage(TELEGRAM_TOKEN, chatId, report);
      if (!tgRes.ok) {
        const errBody = await tgRes.text().catch(() => '');
        console.error('[friction-qa] Telegram send failed:', tgRes.status, errBody.substring(0, 200));
      }
    }

    console.log(`[friction-qa] done — stream:${stream.length} friction:${linked.length} rate:${extractionRate}%`)
    return new Response(JSON.stringify({
      success: true,
      stats: {
        stream_count: stream.length,
        friction_count: linked.length,
        extraction_rate: extractionRate,
        avg_confidence: avgConf,
        type_counts: typeCounts,
        no_friction_count: noFriction.length
      },
      report
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('[friction-qa] error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
