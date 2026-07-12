/**
 * @function vanguard-analyst
 * @trigger pg_cron `0 3 * * *` UTC (daily-analyst) / manual
 * @role Nocna analiza wzorców: wykrywa tarcia i sugeruje system_proposals na bazie korelacji.
 * @reads vanguard_stream, friction_events, vanguard_curiosity_queue, system_proposals, user_settings, vanguard_daily_aggregates, vanguard_behavioral_patterns, vanguard_entity_links, oura_hr_zones_daily, oura_enhanced
 * @writes system_proposals, audit_events, vanguard_curiosity_queue, vanguard_stream
 * @calls deepseek-reasoner, api.telegram.org (poprzez send.ts)
 * @consumer Action Center w aplikacji frontendowej (propozycje system_proposals)
 * @status active
 */
import { serveJson } from "../_shared/http.ts"
import { deepseekChat } from "../_shared/deepseek.ts"
import { checkProactiveAlert } from "./proactiveAlert.ts"
import { detectSpirals } from "./detectSpirals.ts"

Deno.serve(serveJson(async (_req, ctx) => {
  const supabase = ctx.supabase

  const { data: users } = await supabase.from('user_settings').select('user_id')
    const user_id = users?.[0]?.user_id
    if (!user_id) throw new Error("User not found")

    console.log(`[analyst] start for user: ${user_id}`)

    const { error: syncPropErr } = await supabase.rpc('sync_friction_proposals', { p_user_id: user_id })
    if (syncPropErr) console.warn('[analyst] sync_friction_proposals:', syncPropErr.message)

    const now = new Date()
    const cut72h = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString()
    const cut14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const cut21d = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString()

    // Data fetch
    const [stream72h, frictionRecent, biometrics, pendingHypotheses, behavioralPatterns] = await Promise.all([
      supabase.from('vanguard_stream').select('content, category, created_at').eq('user_id', user_id).gte('created_at', cut72h).order('created_at', { ascending: false }).limit(30),
      supabase.from('friction_events').select('friction_type, deviation, immediate_cost, later_cost, declared_intention, actual_behavior, occurred_at, confidence, confidence_source').eq('user_id', user_id).in('event_kind', ['friction_event', 'positive_micro_action']).gte('occurred_at', cut14d).order('occurred_at', { ascending: false }),
      supabase.from('vanguard_daily_aggregates').select('date, final_state, execution_score, sleep_hours, hrv_avg, readiness_score, dopamine_load_index').eq('user_id', user_id).order('date', { ascending: false }).limit(14),
      supabase.from('vanguard_curiosity_queue').select('id, hypothesis, provocation, created_at').eq('user_id', user_id).eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
      supabase.from('vanguard_behavioral_patterns').select('pattern_type, title, evidence_text, status, confidence, occurrence_count').eq('user_id', user_id).neq('status', 'archived').neq('status', 'user_rejected').order('confidence', { ascending: false }),
    ])
    if (stream72h.error) console.error('[analyst] stream72h error:', stream72h.error);
    if (frictionRecent.error) console.error('[analyst] frictionRecent error:', frictionRecent.error);
    if (biometrics.error) console.error('[analyst] biometrics error:', biometrics.error);
    if (pendingHypotheses.error) console.error('[analyst] pendingHypotheses error:', pendingHypotheses.error);
    if (behavioralPatterns.error) console.error('[analyst] behavioralPatterns error:', behavioralPatterns.error);

    const { data: streamPattern } = await supabase.from('vanguard_stream').select('content, category, created_at').eq('user_id', user_id).gte('created_at', cut21d).lt('created_at', cut72h).order('created_at', { ascending: false }).limit(20)

    const { data: graph } = await supabase.from('vanguard_entity_links').select('source_entity, relation, target_entity, evidence_count, temporal_status').eq('user_id', user_id).in('temporal_status', ['current', 'declared']).gte('valid_from', cut21d).order('evidence_count', { ascending: false }).limit(20)

    const [hrZones7d, ouraRecent] = await Promise.all([
      supabase.from('oura_hr_zones_daily').select('day, z3_tempo_min, z4_prog_min, z5_max_min, hr_max').eq('user_id', user_id).order('day', { ascending: false }).limit(7),
      supabase.from('oura_enhanced').select('date, readiness_score, sleep_score, stress_high_minutes, resilience_level, sleep_average_hrv').eq('user_id', user_id).order('date', { ascending: false }).limit(7),
    ])
    if (hrZones7d.error) console.error('[analyst] hrZones error:', hrZones7d.error);
    if (ouraRecent.error) console.error('[analyst] ouraRecent error:', ouraRecent.error);

    // Build context texts
    const loadText = (hrZones7d.data || []).map((z: any) => `${z.day}: Z3 ${z.z3_tempo_min || 0}min, Z4 ${z.z4_prog_min || 0}min, Z5 ${z.z5_max_min || 0}min, max ${z.hr_max || '—'}`).join('\n')
    const recoveryText = (ouraRecent.data || []).map((o: any) => `${o.date}: readiness ${o.readiness_score ?? '—'}, sen-score ${o.sleep_score ?? '—'}, stres ${o.stress_high_minutes != null ? Math.round(o.stress_high_minutes) + 'min' : '—'}, resilience ${o.resilience_level || '—'}`).join('\n')

    const frictionList = (frictionRecent.data || [])
    const frictionText = frictionList.length > 0
      ? frictionList.map(f => `[${f.occurred_at}] ${f.friction_type} | deviation: ${f.deviation || '—'} | koszt: ${f.immediate_cost || '—'} | intencja: ${f.declared_intention || '—'} [${f.confidence_source}, conf=${f.confidence}]`).join('\n')
      : 'Brak friction events z ostatnich 14 dni.'

    const frictionCounts: Record<string, number> = {}
    for (const f of frictionList) { if (f.friction_type) frictionCounts[f.friction_type] = (frictionCounts[f.friction_type] || 0) + 1 }
    const repeatedTypes = Object.entries(frictionCounts).filter(([, count]) => count >= 2).map(([type, count]) => `${type}: ${count}x`).join(', ')

    const stream72hText = (stream72h.data || []).map(s => `[${s.created_at}][${s.category}] ${s.content?.substring(0, 120)}`).join('\n')
    const streamPatternText = (streamPattern || []).map(s => `[${s.created_at}][${s.category}] ${s.content?.substring(0, 80)}`).join('\n')
    const graphText = (graph || []).map(g => `${g.source_entity} --(${g.relation})--> ${g.target_entity} [evidence=${g.evidence_count}]`).join('\n')
    const biometricsText = (biometrics.data || []).map(b => `${b.date}: ${b.final_state}, exec=${b.execution_score?.toFixed(2)}, sen=${b.sleep_hours}h, HRV=${b.hrv_avg}`).join('\n')
    const behavioralPatternsText = (behavioralPatterns.data || []).map(p => `- [${p.status}] ${p.title || p.pattern_type}: ${p.evidence_text} (confidence: ${p.confidence}, count: ${p.occurrence_count})`).join('\n')

    const spiral = detectSpirals(biometrics.data || [], frictionRecent.data || [])
    const spiralText = spiral ? `🚨 ${spiral.reason}` : 'Stan trajektorii stabilny — brak wyraźnych spiral/trendów gwałtownych w danych.'

    // LLM analysis
    const { content: rawContentParsed } = await deepseekChat({
      apiKey: Deno.env.get('DEEPSEEK_API_KEY') ?? '',
      model: 'deepseek-reasoner',
      messages: [
        {
          role: 'system',
          content: `Jesteś Vanguard OS Analyst — silnikiem wykrywania wzorców behawioralnych.
ZASADY:
1. CURRENT-FIRST: Analiza opiera się na danych z ostatnich 72h.
2. Dane 3-21 dni to wyłącznie kontekst wzorca.
3. EVIDENCE-FIRST: Każda hipoteza MUSI mieć odniesienie do konkretnych wpisów.
4. Bez evidence → piszesz "Hipoteza słaba — za mało danych."
5. Nie psychoanalizujesz. Szukasz powtórzeń.
6. Jeden mikrotest na kolejną okazję.

4 SOCZEWKI ANALIZY:
A. HIDDEN_CONTEXTS — niewidoczne ograniczenia czasowe, ukryte stresy biometryczne.
B. ENERGY_TIDES — kiedy najostrzejszy vs najsłabszy? Mapuj energię na godziny/dni.
C. MICRO_CONSISTENCY — co przetrwało złe dni? To "anchors".
D. INTERACTIVE_CURIOSITY — co jest nieoczekiwane? Jedno konkretne pytanie.

ZADANIE:
1. EWALUACJA PENDING HYPOTHESES: Oceń każdą pending hipotezę. Status: validated_true|validated_false|ignored.
2. FRICTION PATTERN DETECTION: Które friction_types powtarzają się?
3. REPEATED_PATTERN_CANDIDATES: friction_type ≥2x w 14 dniach — opisz kandydata.
4. JEDEN MIKROTEST: na najczęstszy friction_type.

FORMAT JSON:
{
  "evaluations": [{"id": "...", "status": "validated_true|validated_false|ignored", "reason": "..."}],
  "friction_summary": {"dominant_type": "...", "evidence_count": 0, "common_deviation": "...", "common_cost": "..."},
  "pattern_candidates": [{"friction_type": "...", "evidence_count": 0, "first_seen": "...", "last_seen": "...", "common_context": "...", "hypothesis_confidence": 0.0, "evidence_refs": ["..."]}],
  "micro_test": {"trigger": "...", "test": "...", "based_on": "..."},
  "provocation": "Jedno zdanie — obserwacja oparta na powtarzającym się wzorcu"
}`
        },
        {
          role: 'user',
          content: `EXISTING BEHAVIORAL PATTERNS (Etap 1):\n${behavioralPatternsText || 'Brak.'}

PENDING HYPOTHESES (do ewaluacji):\n${JSON.stringify(pendingHypotheses.data || [])}

STREAM — OSTATNIE 72H (primary):\n${stream72hText || 'Brak wpisów.'}

STREAM — 3-21 DNI (pattern context only):\n${streamPatternText || 'Brak.'}

WYKRYTE TRAJEKTORIE/SPIRALE:\n${spiralText}

FRICTION EVENTS — ostatnie 14 dni:\n${frictionText}

POWTÓRZENIA (friction_type ≥2x): ${repeatedTypes || 'Brak'}

BIOMETRIA — ostatnie 14 dni:\n${biometricsText || 'Brak.'}

GRAF (current/declared <21d):\n${graphText || 'Brak aktywnych krawędzi.'}

OBCIĄŻENIE TRENINGOWE — strefy HR, ostatnie 7 dni:\n${loadText || 'Brak danych.'}

REGENERACJA — ostatnie 7 dni:\n${recoveryText || 'Brak danych Oura.'}`
        }
      ],
      temperature: null,
      maxTokens: null,
    });

    let rawContent = (rawContentParsed || "{}").replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    if (rawContent.includes('```json')) rawContent = rawContent.split('```json')[1].split('```')[0].trim()
    else if (rawContent.includes('```')) rawContent = rawContent.split('```')[1].split('```')[0].trim()

    let result: any
    try { result = JSON.parse(rawContent) }
    catch (e) { console.error("[analyst] JSON parse failed:", e, "raw:", rawContent.substring(0, 300)); throw new Error("Analyst returned invalid JSON.") }

    // Update pending hypotheses
    if (result.evaluations?.length > 0) {
      for (const ev of result.evaluations) {
        if (ev.status !== 'ignored') await supabase.from('vanguard_curiosity_queue').update({ status: ev.status, updated_at: new Date().toISOString() }).eq('id', ev.id)
      }
    }

    // Save pattern candidates
    const hypotheses = result.pattern_candidates || []
    for (const h of hypotheses) {
      if ((h.hypothesis_confidence || 0) < 0.3) continue
      const { error: qErr } = await supabase.from('vanguard_curiosity_queue').insert({
        user_id, hypothesis: `[FRICTION PATTERN] ${h.friction_type} x${h.evidence_count}: ${h.common_context}`,
        provocation: result.provocation || result.micro_test?.test || '',
        confidence_score: h.hypothesis_confidence, category: 'friction_pattern', status: 'pending'
      })
      if (qErr) console.warn('[analyst] curiosity_queue insert failed:', qErr.message)
    }

    // Proactive alert
    if (!biometrics.error) await checkProactiveAlert(supabase, user_id, biometrics.data || [], graph || [], spiral)

    console.log(`[analyst] done. patterns: ${hypotheses.length}, micro_test: ${result.micro_test?.test?.substring(0, 60)}`)
    return { success: true, result }
}, { auth: 'service' }))
