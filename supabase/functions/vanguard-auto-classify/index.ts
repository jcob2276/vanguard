import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    const payload = await req.json()
    const { record } = payload

    if (!record || !record.content || !record.user_id) {
      return new Response(JSON.stringify({ message: 'No content to classify' }), { status: 200 })
    }

    // Idempotency gate: skip if already classified (webhook retry / double-trigger protection)
    if (record.classification && record.importance_score) {
      console.log(`[auto-classify] already classified, skipping: ${record.id}`)
      return new Response(JSON.stringify({ message: 'already classified' }), { status: 200 })
    }

    console.log(`[auto-classify] start for record: ${record.id}`)

    const today = new Date().toISOString().split('T')[0]

    const { data: aggregate } = await supabase
      .from('vanguard_daily_aggregates')
      .select('hrv_avg, sleep_hours, final_state')
      .eq('user_id', record.user_id)
      .eq('date', today)
      .maybeSingle()

    const contextStr = aggregate
      ? `BIOMETRIA DZIŚ: HRV ${aggregate.hrv_avg}, Sen ${aggregate.sleep_hours}h, Stan: ${aggregate.final_state}.`
      : 'BIOMETRIA DZIŚ: Brak danych.'

    // === KROK 1: Klasyfikacja 5-bucket (równolegle z friction detection) ===
    const [classifyRes, frictionRes] = await Promise.all([
      fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `Jesteś systemem analitycznym Vanguard OS. Zwróć TYLKO JSON:
{
  "importance_score": (1-10),
  "category": ("Ciało" | "Konto" | "Duch" | "Chaos" | "Relacje"),
  "tags": [max 5 tagów],
  "fingerprint_text": "2-zdaniowe podsumowanie stanu biometrycznego i tematu notatki",
  "is_closure": boolean,
  "closed_topic_description": "krótki opis zamykanego wątku jeśli is_closure=true, inaczej null",
  "expiration_date": "ISO string jeśli w tekście jest termin, inaczej null"
}`
            },
            {
              role: 'user',
              content: `KONTEKST: ${contextStr}\nNOTATKA: ${record.content}`
            }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        }),
      }),

      // === KROK 2: Friction detection (równolegle) ===
      fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `Jesteś detektorem mikrotarć behawioralnych Vanguard OS.
Analizujesz tekst i decydujesz czy opisuje mikrotarcie lub pozytywny mikrogest.

ZASADY ABSOLUTNE:
1. Wyciągaj TYLKO to, co jest jawnie w tekście. Nie dopowiadaj, nie interpretuj motywów.
2. Jeśli koszt nie jest wymieniony w tekście → immediate_cost = null. NIE wymyślaj kosztu.
3. Jeśli intencja nie jest wyraźna → declared_intention = null. NIE zgaduj intencji.
4. Tylko jedno zdarzenie = jeden event. Nie łącz wielu odchyleń w jeden rekord.
5. Neutralne obserwacje, pytania, plany → is_friction = false.

SŁOWNIK friction_type:
- sleep_disruption: późne spanie, zaspanie, nocny ekran zamiast snu
- avoidance: unikanie sytuacji/osoby/tematu mimo że miał podejść
- procrastination: odkładanie zadania mimo że miał je zrobić
- habit_break: przerwanie rutyny (siłownia, dieta, nawyk)
- training_drop: skrócenie/pominięcie treningu
- social_hesitation: zawahanie w sytuacji społecznej (nie poprosił do tańca, nie zagadał, unikał kontaktu wzrokowego)
- communication_drift: nie odpisał, skrócił rozmowę, nie powiedział czegoś wprost
- emotional_spike: nieoczekiwana, silna reakcja emocjonalna odnotowana przez użytkownika
- self_control_break: złamanie własnej zasady (nie pić, nie sprawdzać telefonu, nie jeść X)
- positive_micro_action: dobry mikrogest (podał ramię, zaproponował napój, poprosił do tańca, powiedział komplement)
- other: inne odchylenie nie pasujące do powyższych

Zwróć TYLKO JSON:
{
  "is_friction": boolean,
  "friction_type": "sleep_disruption"|"avoidance"|"procrastination"|"habit_break"|"training_drop"|"social_hesitation"|"communication_drift"|"emotional_spike"|"self_control_break"|"positive_micro_action"|"other"|null,
  "declared_intention": "dosłownie z tekstu co miało być zrobione (lub null jeśli nie podano)",
  "actual_behavior": "dosłownie z tekstu co się stało (lub null)",
  "deviation": "różnica między intencją a zachowaniem — tylko jeśli obie strony są jawne w tekście (lub null)",
  "immediate_cost": "TYLKO jeśli koszt jest jawnie wymieniony w tekście (lub null)",
  "emotional_state": "stan emocjonalny jeśli wymieniony (lub null)",
  "people_involved": ["osoby jeśli wymienione z imienia"],
  "location_context": "miejsce jeśli wymienione (lub null)"
}

WAŻNE: positive_micro_action zawsze ma is_friction=true (to zdarzenie warte zalogowania).

Przykłady:
"zaspałem" → is_friction=true, sleep_disruption, declared_intention=null, actual_behavior="zaspał", immediate_cost=null
"zaspałem i nie poszedłem na siłownię" → is_friction=true, sleep_disruption, cost="nie poszedł na siłownię"
"miałem napisać ale znowu odłożyłem" → is_friction=true, procrastination
"chciałem poprosić do tańca ale się zawahałem" → is_friction=true, social_hesitation, declared_intention="poprosić do tańca", actual_behavior="zawahał się i nie poprosił"
"podałem ramię przy schodach" → is_friction=true, positive_micro_action, actual_behavior="podał ramię"
"siedziałem do 2 w nocy" → is_friction=true, sleep_disruption, actual_behavior="siedział do 2 w nocy"
"pytam co słychać" → is_friction=false (pytanie, nie zdarzenie)
"planuję jutro pobiec" → is_friction=false (plan, nie zdarzenie)
"dzisiaj był dobry trening" → is_friction=false (neutralna obserwacja bez odchylenia)`
            },
            {
              role: 'user',
              content: record.content
            }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        }),
      })
    ])

    // === Parse klasyfikacja ===
    const classifyData = await classifyRes.json()
    const classification = JSON.parse(classifyData.choices?.[0]?.message?.content || '{}')

    // === Parse friction ===
    const frictionData = await frictionRes.json()
    const friction = JSON.parse(frictionData.choices?.[0]?.message?.content || '{"is_friction":false}')

    console.log(`[auto-classify] category=${classification.category}, is_friction=${friction.is_friction}, type=${friction.friction_type}`)

    // === Wektoryzacja fingerprint ===
    let embedding = null
    if (classification.fingerprint_text) {
      const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: classification.fingerprint_text,
        }),
      })
      const embedData = await embedRes.json()
      embedding = embedData.data?.[0]?.embedding || null
    }

    // === Bi-temporalna logika: zamykanie wątków ===
    if (classification.is_closure && classification.closed_topic_description && embedding) {
      console.log(`[auto-classify] closing topic: ${classification.closed_topic_description}`)
      const closureEmbedRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: classification.closed_topic_description,
        }),
      })
      const closureEmbedData = await closureEmbedRes.json()
      const closureEmbedding = closureEmbedData.data?.[0]?.embedding

      if (closureEmbedding) {
        const { data: matches } = await supabase.rpc('match_vanguard_content', {
          query_embedding: closureEmbedding,
          match_threshold: 0.65,
          match_count: 5,
          user_id_param: record.user_id
        })
        const idsToClose = (matches || [])
          .filter((m: any) => m.table_name === 'vanguard_stream' && m.id !== record.id)
          .map((m: any) => m.id)
        if (idsToClose.length > 0) {
          await supabase
            .from('vanguard_stream')
            .update({ valid_until: new Date().toISOString() })
            .in('id', idsToClose)
        }
      }
    }

    // === Update stream record ===
    await supabase
      .from('vanguard_stream')
      .update({
        importance_score: classification.importance_score,
        category: classification.category,
        tags: classification.tags,
        situation_fingerprint: embedding,
        classification: classification.category?.toLowerCase(),
        valid_from: new Date().toISOString(),
        valid_until: classification.expiration_date || null
      })
      .eq('id', record.id)

    // === INSERT friction_event jeśli wykryto mikrotarcie lub pozytywny mikrogest ===
    // positive_micro_action zawsze logujemy (model może zwrócić is_friction=false dla pozytywnych gestów)
    const shouldLog = friction.friction_type && (
      friction.is_friction === true ||
      friction.friction_type === 'positive_micro_action'
    )
    if (shouldLog) {
      const { error: frictionErr } = await supabase
        .from('friction_events')
        .insert({
          user_id: record.user_id,
          stream_record_id: record.id,
          occurred_at: record.created_at || new Date().toISOString(),
          raw_text: record.content,
          friction_type: friction.friction_type,
          declared_intention: friction.declared_intention || null,
          actual_behavior: friction.actual_behavior || null,
          deviation: friction.deviation || null,
          immediate_cost: friction.immediate_cost || null,
          emotional_state: friction.emotional_state || null,
          people_involved: friction.people_involved?.length > 0 ? friction.people_involved : null,
          location_context: friction.location_context || null,
          confidence_source: 'inferred',
          confidence: null, // hardcoded 0.65 was decorative — null is more honest until real scoring exists
          status: 'raw'
        })

      if (frictionErr) {
        console.error('[auto-classify] friction insert error:', frictionErr)
      } else {
        console.log(`[auto-classify] friction_event inserted: ${friction.friction_type}`)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      classification,
      friction_detected: friction.is_friction,
      friction_type: friction.friction_type || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('[auto-classify] error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
