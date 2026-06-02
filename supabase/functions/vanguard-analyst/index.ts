import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders } from "../_shared/supabase.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createServiceClient()

    const { data: users } = await supabase.from('user_settings').select('user_id')
    const user_id = users?.[0]?.user_id
    if (!user_id) throw new Error("User not found")

    console.log(`[analyst] start for user: ${user_id}`)

    const now = new Date()
    const cut72h = new Date(now.getTime() - 72  * 60 * 60 * 1000).toISOString()
    const cut14d = new Date(now.getTime() - 14  * 24 * 60 * 60 * 1000).toISOString()
    const cut21d = new Date(now.getTime() - 21  * 24 * 60 * 60 * 1000).toISOString()

    // 1. CURRENT CONTEXT — ostatnie 72h (primary)
    const [stream72h, frictionRecent, biometrics, pendingHypotheses] = await Promise.all([
      supabase
        .from('vanguard_stream')
        .select('content, category, created_at')
        .eq('user_id', user_id)
        .gte('created_at', cut72h)
        .order('created_at', { ascending: false })
        .limit(30),

      supabase
        .from('friction_events')
        .select('friction_type, deviation, immediate_cost, later_cost, declared_intention, actual_behavior, occurred_at, confidence, confidence_source')
        .eq('user_id', user_id)
        .in('event_kind', ['friction_event', 'positive_micro_action'])
        .gte('occurred_at', cut14d)
        .order('occurred_at', { ascending: false }),

      supabase
        .from('vanguard_daily_aggregates')
        .select('date, final_state, execution_score, sleep_hours, hrv_avg, readiness_score, dopamine_load_index')
        .eq('user_id', user_id)
        .order('date', { ascending: false })
        .limit(14),

      supabase
        .from('vanguard_curiosity_queue')
        .select('id, hypothesis, provocation, created_at')
        .eq('user_id', user_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(3)
    ])
    if (stream72h.error) console.error('[analyst] stream72h query error:', stream72h.error);
    if (frictionRecent.error) console.error('[analyst] frictionRecent query error:', frictionRecent.error);
    if (biometrics.error) console.error('[analyst] biometrics query error:', biometrics.error);
    if (pendingHypotheses.error) console.error('[analyst] pendingHypotheses query error:', pendingHypotheses.error);

    const { data: streamPattern, error: streamPatternErr } = await supabase
      .from('vanguard_stream')
      .select('content, category, created_at')
      .eq('user_id', user_id)
      .gte('created_at', cut21d)
      .lt('created_at', cut72h)
      .order('created_at', { ascending: false })
      .limit(20)
    if (streamPatternErr) console.error('[analyst] streamPattern query error:', streamPatternErr);

    // 3. Graf — TYLKO current/declared z ostatnich 21 dni
    const { data: graph, error: graphErr } = await supabase
      .from('vanguard_entity_links')
      .select('source_entity, relation, target_entity, evidence_count, temporal_status')
      .eq('user_id', user_id)
      .in('temporal_status', ['current', 'declared'])
      .gte('valid_from', cut21d)
      .order('evidence_count', { ascending: false })
      .limit(20)
    if (graphErr) console.error('[analyst] graph query error:', graphErr);

    // 3b. ZALEŻNOŚCI BIOMETRYCZNE — auto-liczone korelacje + obciążenie (Oura)
    const [correlations, hrZones7d, ouraRecent] = await Promise.all([
      supabase.from('oura_correlations').select('*').eq('user_id', user_id).maybeSingle(),
      supabase.from('oura_hr_zones_daily')
        .select('day, z3_tempo_min, z4_prog_min, z5_max_min, hr_max')
        .eq('user_id', user_id).order('day', { ascending: false }).limit(7),
      supabase.from('oura_enhanced')
        .select('date, readiness_score, sleep_score, stress_high_minutes, resilience_level, sleep_average_hrv')
        .eq('user_id', user_id).order('date', { ascending: false }).limit(7),
    ])
    if (correlations.error) console.error('[analyst] correlations query error:', correlations.error);
    if (hrZones7d.error) console.error('[analyst] hrZones query error:', hrZones7d.error);
    if (ouraRecent.error) console.error('[analyst] ouraRecent query error:', ouraRecent.error);

    // Tylko istotne zależności (|r| >= 0.25); reszta to szum przy małym n
    const corr: any = correlations.data
    let corrText = 'Brak danych korelacyjnych.'
    if (corr) {
      const strong = Object.entries(corr)
        .filter(([k, v]) => k !== 'user_id' && k !== 'n_dni' && v !== null && Math.abs(Number(v)) >= 0.25)
        .map(([k, v]) => `${k}: r=${v}`)
      corrText = strong.length
        ? `n=${corr.n_dni} dni. Istotne (|r|≥0.25): ${strong.join('; ')}`
        : `n=${corr.n_dni} dni — brak istotnych korelacji (|r|<0.25). Za mało danych na pewne wnioski biometryczne.`
    }

    const loadText = (hrZones7d.data || [])
      .map((z: any) => `${z.day}: Z3 ${z.z3_tempo_min || 0}min, Z4 ${z.z4_prog_min || 0}min, Z5 ${z.z5_max_min || 0}min, max ${z.hr_max || '—'}`)
      .join('\n')

    const recoveryText = (ouraRecent.data || [])
      .map((o: any) => `${o.date}: readiness ${o.readiness_score ?? '—'}, sen-score ${o.sleep_score ?? '—'}, stres ${o.stress_high_minutes != null ? Math.round(o.stress_high_minutes) + 'min' : '—'}, resilience ${o.resilience_level || '—'}`)
      .join('\n')

    // --- BUDOWANIE KONTEKSTU ---
    const frictionList = (frictionRecent.data || [])
    const frictionText = frictionList.length > 0
      ? frictionList.map(f =>
          `[${f.occurred_at}] ${f.friction_type} | deviation: ${f.deviation || '—'} | koszt: ${f.immediate_cost || '—'} | intencja: ${f.declared_intention || '—'} [${f.confidence_source}, conf=${f.confidence}]`
        ).join('\n')
      : 'Brak friction events z ostatnich 14 dni.'

    // Policz powtórzenia per typ (kandydaci na wzorzec)
    const frictionCounts: Record<string, number> = {}
    for (const f of frictionList) {
      if (f.friction_type) frictionCounts[f.friction_type] = (frictionCounts[f.friction_type] || 0) + 1
    }
    const repeatedTypes = Object.entries(frictionCounts)
      .filter(([, count]) => count >= 2)
      .map(([type, count]) => `${type}: ${count}x`)
      .join(', ')

    const stream72hText = (stream72h.data || [])
      .map(s => `[${s.created_at}][${s.category}] ${s.content?.substring(0, 120)}`)
      .join('\n')

    const streamPatternText = (streamPattern || [])
      .map(s => `[${s.created_at}][${s.category}] ${s.content?.substring(0, 80)}`)
      .join('\n')

    const graphText = (graph || [])
      .map(g => `${g.source_entity} --(${g.relation})--> ${g.target_entity} [evidence=${g.evidence_count}]`)
      .join('\n')

    const biometricsText = (biometrics.data || [])
      .map(b => `${b.date}: ${b.final_state}, exec=${b.execution_score?.toFixed(2)}, sen=${b.sleep_hours}h, HRV=${b.hrv_avg}`)
      .join('\n')

    // 4. DEEPSEEK REASONER — analiza friction patterns
    const analystRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-reasoner',
        messages: [
          {
            role: 'system',
            content: `Jesteś Vanguard OS Analyst — silnikiem wykrywania wzorców behawioralnych.

ZASADY:
1. CURRENT-FIRST: Analiza opiera się na danych z ostatnich 72h jako głównym źródle.
2. Dane z zakresu 3-21 dni to wyłącznie kontekst wzorca — nie aktualna prawda.
3. EVIDENCE-FIRST: Każda hipoteza MUSI mieć odniesienie do konkretnych wpisów (data + typ).
4. Bez evidence → piszesz "Hipoteza słaba — za mało danych."
5. Nie psychoanalizujesz. Nie generujesz "głębokich prawd". Szukasz powtórzeń.
6. Jeden mikrotest na kolejną okazję — konkretne zachowanie, nie ogólna rada.
7. BIOMETRIA: Masz zmierzone zależności (auto-liczone korelacje) + obciążenie treningowe (strefy HR) + regenerację. Jeśli dane pokazują koszt regeneracyjny (spadek readiness/HRV lub wzrost stresu po obciążeniu) — uwzględnij to w mikroteście (np. lżejszy wieczór po dniu w Z4/Z5). NIGDY nie wymyślaj korelacji, której nie ma na liście istotnych — jeśli "za mało danych", to tak napisz.

ZAKAZ:
- "holistyczna analiza"
- "nieoczywiste powiązania psychologiczne"
- tez bez daty i źródła
- interpretacji motywów bez danych

ZADANIE:
1. EWALUACJA PENDING HYPOTHESES: Oceń każdą pending hipotezę na podstawie stream72h. Status: validated_true | validated_false | ignored.
2. FRICTION PATTERN DETECTION: Które friction_types powtarzają się? Jakie mają wspólne deviation/cost?
3. REPEATED_PATTERN_CANDIDATES: Jeśli dany friction_type wystąpił ≥2x w 14 dniach — opisz kandydata na wzorzec.
4. JEDEN MIKROTEST: Na podstawie najczęstszego friction_type zaproponuj jeden konkretny mikrotest na najbliższą 24-48h.

FORMAT JSON:
{
  "evaluations": [
    {"id": "...", "status": "validated_true|validated_false|ignored", "reason": "konkretny wpis/data potwierdzający"}
  ],
  "friction_summary": {
    "dominant_type": "...",
    "evidence_count": 0,
    "common_deviation": "...",
    "common_cost": "..."
  },
  "pattern_candidates": [
    {
      "friction_type": "...",
      "evidence_count": 0,
      "first_seen": "...",
      "last_seen": "...",
      "common_context": "...",
      "hypothesis_confidence": 0.0,
      "evidence_refs": ["data1: ...", "data2: ..."]
    }
  ],
  "micro_test": {
    "trigger": "...",
    "test": "Konkretne jedno zachowanie do przetestowania",
    "based_on": "friction_type X, N evidences"
  },
  "provocation": "Jedno zdanie — obserwacja oparta na powtarzającym się wzorcu (NIE psychologia, tylko fakt z danych)"
}`
          },
          {
            role: 'user',
            content: `PENDING HYPOTHESES (do ewaluacji):
${JSON.stringify(pendingHypotheses.data || [])}

STREAM — OSTATNIE 72H (primary):
${stream72hText || 'Brak wpisów.'}

STREAM — 3-21 DNI (pattern context only):
${streamPatternText || 'Brak.'}

FRICTION EVENTS — ostatnie 14 dni:
${frictionText}

POWTÓRZENIA (friction_type ≥2x): ${repeatedTypes || 'Brak'}

BIOMETRIA — ostatnie 14 dni:
${biometricsText || 'Brak.'}

GRAF (current/declared <21d):
${graphText || 'Brak aktywnych krawędzi.'}

ZALEŻNOŚCI BIOMETRYCZNE (auto-liczone korelacje):
${corrText}

OBCIĄŻENIE TRENINGOWE — strefy HR, ostatnie 7 dni:
${loadText || 'Brak danych o strefach tętna.'}

REGENERACJA — ostatnie 7 dni:
${recoveryText || 'Brak danych Oura.'}`
          }
        ]
      }),
    })

    if (!analystRes.ok) {
      const errText = await analystRes.text()
      throw new Error(`DeepSeek Analyst error (${analystRes.status}): ${errText.substring(0, 200)}`)
    }

    const analystData = await analystRes.json()
    let rawContent = analystData.choices?.[0]?.message?.content || "{}"
    rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    if (rawContent.includes('```json')) {
      rawContent = rawContent.split('```json')[1].split('```')[0].trim()
    } else if (rawContent.includes('```')) {
      rawContent = rawContent.split('```')[1].split('```')[0].trim()
    }

    let result: any
    try {
      result = JSON.parse(rawContent)
    } catch (e) {
      console.error("[analyst] JSON parse failed:", e, "raw:", rawContent.substring(0, 300))
      throw new Error("Analyst returned invalid JSON.")
    }

    // 5. Aktualizacja pending hypotheses
    if (result.evaluations?.length > 0) {
      for (const ev of result.evaluations) {
        if (ev.status !== 'ignored') {
          await supabase
            .from('vanguard_curiosity_queue')
            .update({ status: ev.status, updated_at: new Date().toISOString() })
            .eq('id', ev.id)
        }
      }
    }

    // 6. Zapis pattern candidates do curiosity_queue (z evidence)
    const hypotheses = result.pattern_candidates || []
    for (const h of hypotheses) {
      if ((h.hypothesis_confidence || 0) < 0.3) continue // zbyt słabe — pomiń
      await supabase.from('vanguard_curiosity_queue').insert({
        user_id,
        hypothesis: `[FRICTION PATTERN] ${h.friction_type} x${h.evidence_count}: ${h.common_context}`,
        provocation: result.provocation || result.micro_test?.test || '',
        confidence_score: h.hypothesis_confidence,
        category: 'friction_pattern',
        status: 'pending'
      })
    }

    // pattern_candidate → repeated_pattern_candidates: disabled until Sprint 1 QA gate (BACKLOG).

    console.log(`[analyst] done. patterns: ${hypotheses.length}, micro_test: ${result.micro_test?.test?.substring(0, 60)}`)
    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (err) {
    console.error("[analyst] error:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
