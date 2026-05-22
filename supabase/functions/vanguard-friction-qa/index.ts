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

    const { data: users } = await supabase.from('user_settings').select('user_id')
    const user_id = users?.[0]?.user_id
    if (!user_id) throw new Error("User not found")

    const now = new Date()
    const cut48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
    const cut7d  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()

    // 1. Stream z ostatnich 48h
    const { data: recentStream } = await supabase
      .from('vanguard_stream')
      .select('id, content, created_at, category')
      .eq('user_id', user_id)
      .gte('created_at', cut48h)
      .order('created_at', { ascending: false })

    const streamIds = (recentStream || []).map(s => s.id)

    // 2. Friction events linkujące do tych stream records
    const { data: linkedFriction } = streamIds.length > 0
      ? await supabase
          .from('friction_events')
          .select('id, stream_record_id, friction_type, declared_intention, actual_behavior, deviation, immediate_cost, later_cost, confidence, confidence_source, status, occurred_at')
          .eq('user_id', user_id)
          .in('stream_record_id', streamIds)
      : { data: [] }

    // 3. Wszystkie friction events z 7 dni (do statystyk typów)
    const { data: allFriction7d } = await supabase
      .from('friction_events')
      .select('friction_type, status, confidence, immediate_cost')
      .eq('user_id', user_id)
      .gte('occurred_at', cut7d)

    // --- ANALIZA ---
    const stream = recentStream || []
    const linked = linkedFriction || []
    const all7d  = allFriction7d  || []

    const linkedIds = new Set(linked.map(f => f.stream_record_id))

    // Stream bez friction events (potencjalne missy)
    const noFriction = stream.filter(s => !linkedIds.has(s.id))

    // Typy z 7 dni
    const typeCounts: Record<string, number> = {}
    for (const f of all7d) {
      if (f.friction_type) typeCounts[f.friction_type] = (typeCounts[f.friction_type] || 0) + 1
    }
    const typesSorted = Object.entries(typeCounts)
      .sort(([,a],[,b]) => b - a)
      .map(([t, n]) => `  ${t}: ${n}x`)
      .join('\n')

    // Koszty
    const withCost    = linked.filter(f => f.immediate_cost !== null).length
    const withoutCost = linked.filter(f => f.immediate_cost === null).length

    // Przykłady z 48h — po 2 dobre i 2 podejrzane
    const withDeviation = linked.filter(f => f.deviation !== null).slice(0, 2)
    const noDeviation   = linked.filter(f => f.deviation === null).slice(0, 2)

    const examplesGood = withDeviation.map(f =>
      `✅ ${f.friction_type}\n    intencja: ${f.declared_intention || '—'}\n    zachowanie: ${f.actual_behavior || '—'}\n    koszt: ${f.immediate_cost || 'null'}`
    ).join('\n\n')

    const examplesCheck = noDeviation.map(f =>
      `⚠️ ${f.friction_type} (brak deviation)\n    zachowanie: ${f.actual_behavior || '—'}\n    koszt: ${f.immediate_cost || 'null'}`
    ).join('\n\n')

    const missExamples = noFriction.slice(0, 3).map(s =>
      `❓ [${s.category}] ${(s.content || '').substring(0, 80)}...`
    ).join('\n')

    // Confidence stats
    const confValues = linked.map(f => f.confidence).filter(c => c !== null) as number[]
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

JAKOŚĆ
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
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: report })
      })
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

  } catch (err) {
    console.error('[friction-qa] error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
