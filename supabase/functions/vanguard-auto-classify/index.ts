import { getEmbedding } from "../_shared/openai.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { safeExecute, createServiceClient, corsHeaders } from '../_shared/supabase.ts'
import { sendMessage } from '../_shared/telegram.ts'
import { logCriticalError } from '../_shared/errorLogging.ts'

const TELEGRAM_TOKEN   = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TELEGRAM_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '0');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createServiceClient()

    const payload = await req.json()
    const { record } = payload

    if (!record || !record.content || !record.user_id) {
      return new Response(JSON.stringify({ message: 'No content to classify' }), { status: 200 })
    }

    // Skip system-generated entries (anchors, planning summaries, Oracle responses, etc.)
    // These are written by Vanguard itself and don't represent user behaviour to classify.
    if (record.source === 'system') {
      console.log(`[auto-classify] skipping system record: ${record.id}`)
      return new Response(JSON.stringify({ message: 'system source, skipped' }), { status: 200 })
    }

    // Idempotency gate: skip if already classified (webhook retry / double-trigger protection)
    if (record.classification && record.importance_score) {
      console.log(`[auto-classify] already classified, skipping: ${record.id}`)
      return new Response(JSON.stringify({ message: 'already classified' }), { status: 200 })
    }

    console.log(`[auto-classify] start for record: ${record.id}`)

    // Use Warsaw local date — toISOString() returns UTC which drifts at midnight (22:00 UTC in summer)
    const today = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' })

    const aggregate = await safeExecute(
      supabase
        .from('vanguard_daily_aggregates')
        .select('hrv_avg, sleep_hours, final_state')
        .eq('user_id', record.user_id)
        .eq('date', today)
        .maybeSingle()
    )

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
          model: 'deepseek-v4-flash',
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
          model: 'deepseek-v4-flash',
          messages: [
            {
              role: 'system',
              content: `Jesteś detektorem obserwacji behawioralnych i mikrotarć Vanguard OS.
Analizujesz tekst i klasyfikujesz go do jednego z poniższych typów (\`event_kind\`):

1. \`friction_event\` — konkretne tarcie behawioralne (odchylenie zachowania od intencji).
   - **Musi** zawierać jednocześnie: (a) intencję/zamiar co miało być zrobione + (b) wyraźne odchylenie w zachowaniu.
   - Jeśli brak jednej z tych dwóch rzeczy → nie dawaj \`friction_event\`, daj \`state_observation\` lub \`micro_behavior_observation\`.
   - Przykład: "miałem napisać raport ale znowu odłożyłem" lub "chciałem poprosić do tańca ale się zawahałem".
2. \`positive_micro_action\` — dobry mikrogest, pozytywne mikrozachowanie.
   - Przykład: "podałem ramię przy schodach" lub "powiedziałem komplement".
3. \`state_observation\` — stan emocjonalny lub fizyczny użytkownika bez jawnego odchylenia intencji.
   - Przykład: "jadę na wesele, boli mnie brzuch, stresuję się" lub "jestem zmęczony, mam dziś mało energii".
4. \`micro_behavior_observation\` — zaobserwowane zachowanie bez jawnej intencji w danym momencie (nawykowe gesty, tiki, sposoby reakcji).
   - Przykład: "zauważyłem, że nie patrzę w oczy podczas mówienia".
5. \`reflection\` — refleksja, generalizacja, wniosek, przemyślenia.
   - Przykład: "ludzie boją się ciszy, więc gadają o byle czym".

Jeśli tekst nie opisuje żadnego z powyższych (np. jest to zwykłe neutralne powiadomienie, suchy plan dnia bez opisu wykonania, pytanie) → set \`is_relevant = false\` i \`event_kind = null\`.
W przeciwnym wypadku set \`is_relevant = true\`.

**Krytyczna zasada anty-fałszywych tarć:**
- \`friction_event\` tylko gdy w tekście jest **jawna lub jasno implikowana intencja** + **odchylenie od niej**.
- Czysty stan (ból, zmęczenie, stres) bez odchylenia → \`state_observation\`.
- Zaobserwowane nawykowe zachowanie bez intencji w momencie → \`micro_behavior_observation\`.

SŁOWNIK friction_type (dla wszystkich typów oprócz 'reflection' i neutralnych, jeśli pasuje):
- sleep_disruption: późne spanie, zaspanie, nocny ekran zamiast snu
- avoidance: unikanie sytuacji/osoby/tematu mimo że miał podejść
- procrastination: odkładanie zadania mimo że miał je zrobić
- habit_break: przerwanie rutyny (siłownia, dieta, nawyk)
- training_drop: skrócenie/pominięcie treningu
- social_hesitation: zawahanie w sytuacji społecznej (nie poprosił do tańca, nie zagadał, unikał kontaktu wzrokowego)
- communication_drift: nie odpisał, skrócił rozmowę, nie powiedział czegoś wprost
- emotional_spike: nieoczekiwana, silna reakcja emocjonalna
- self_control_break: złamanie własnej zasady (nie pić, nie sprawdzać telefonu, nie jeść X)
- positive_micro_action: dobry mikrogest (podał ramię, zaproponował napój, powiedział komplement)
- other: inne odchylenie lub stan niepasujący do powyższych

Zwróć TYLKO JSON:
{
  "is_relevant": boolean,
  "event_kind": "friction_event" | "positive_micro_action" | "state_observation" | "micro_behavior_observation" | "reflection" | null,
  "friction_type": "sleep_disruption"|"avoidance"|"procrastination"|"habit_break"|"training_drop"|"social_hesitation"|"communication_drift"|"emotional_spike"|"self_control_break"|"positive_micro_action"|"other"|null,
  "declared_intention": "dosłownie z tekstu co miało być zrobione (lub null jeśli nie podano)",
  "actual_behavior": "dosłownie z tekstu co się stało/co zaobserwowano (lub null)",
  "deviation": "różnica między intencją a zachowaniem — tylko jeśli obie strony są jawne w tekście (lub null)",
  "immediate_cost": "TYLKO jeśli koszt jest jawnie wymieniony w tekście (lub null)",
  "emotional_state": "stan emocjonalny jeśli wymieniony (lub null)",
  "people_involved": ["osoby jeśli wymienione z imienia"],
  "location_context": "miejsce jeśli wymienione (lub null)"
}

WAŻNE: positive_micro_action zawsze ma is_relevant=true (to zdarzenie warte zalogowania).

Przykłady:
"zaspałem" → is_relevant=true, event_kind="friction_event", friction_type="sleep_disruption", declared_intention=null, actual_behavior="zaspał", immediate_cost=null
"zaspałem i nie poszedłem na siłownię" → is_relevant=true, event_kind="friction_event", friction_type="sleep_disruption", immediate_cost="nie poszedł na siłownię"
"miałem napisać ale znowu odłożyłem" → is_relevant=true, event_kind="friction_event", friction_type="procrastination"
"chciałem poprosić do tańca ale się zawahałem" → is_relevant=true, event_kind="friction_event", friction_type="social_hesitation", declared_intention="poprosić do tańca", actual_behavior="zawahał się i nie poprosił"
"podałem ramię przy schodach" → is_relevant=true, event_kind="positive_micro_action", friction_type="positive_micro_action", actual_behavior="podał ramię"
"siedziałem do 2 w nocy" → is_relevant=true, event_kind="friction_event", friction_type="sleep_disruption", actual_behavior="siedział do 2 w nocy"
"boli mnie dziś brzuch i się stresuję" → is_relevant=true, event_kind="state_observation", friction_type="other", actual_behavior="boli brzuch, stresuje się", emotional_state="stres"
"zauważyłem, że krzyżuję ręce podczas prezentacji" → is_relevant=true, event_kind="micro_behavior_observation", friction_type="other", actual_behavior="krzyżuje ręce"
"nie patrzę w oczy podczas rozmów" → is_relevant=true, event_kind="micro_behavior_observation", friction_type="other"   ← zaobserwowane zachowanie, brak intencji w tym momencie
"pytam co słychać" → is_relevant=false (pytanie, nie zdarzenie)
"planuję jutro pobiec" → is_relevant=false (plan, nie zdarzenie)
"dzisiaj był dobry trening" → is_relevant=false (neutralna obserwacja bez odchylenia)`
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

    // === Guard: DeepSeek errors (429, 500, etc.) ===
    if (!classifyRes.ok || !frictionRes.ok) {
      const classifyStatus = classifyRes.status
      const frictionStatus = frictionRes.status
      console.error(`[auto-classify] DeepSeek error — classify: ${classifyStatus}, friction: ${frictionStatus}`)
      return new Response(JSON.stringify({
        error: `DeepSeek upstream error (classify: ${classifyStatus}, friction: ${frictionStatus})`,
        record_id: record.id
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // === Parse klasyfikacja ===
    const classifyData = await classifyRes.json()
    const classification = JSON.parse(classifyData.choices?.[0]?.message?.content || '{}')

    // === Parse friction ===
    const frictionData = await frictionRes.json()
    const friction = JSON.parse(frictionData.choices?.[0]?.message?.content || '{"is_relevant":false}')

    console.log(`[auto-classify] category=${classification.category}, is_relevant=${friction.is_relevant}, kind=${friction.event_kind}, type=${friction.friction_type}`)

    // === Wektoryzacja fingerprint ===
    let embedding = null
    if (classification.fingerprint_text) {
      embedding = await getEmbedding(classification.fingerprint_text, Deno.env.get('OPENAI_API_KEY') ?? '');
    }

    // === Bi-temporalna logika: zamykanie wątków ===
    if (classification.is_closure && classification.closed_topic_description && embedding) {
      console.log(`[auto-classify] closing topic: ${classification.closed_topic_description}`)
      const closureEmbedding = await getEmbedding(classification.closed_topic_description, Deno.env.get('OPENAI_API_KEY') ?? '');

      if (closureEmbedding) {
        const CLOSURE_THRESHOLD = 0.65
        const { data: matches } = await supabase.rpc('match_vanguard_content', {
          query_embedding: closureEmbedding,
          match_threshold: CLOSURE_THRESHOLD,
          match_count: 5,
          user_id_param: record.user_id
        })
        const idsToClose = (matches || [])
          .filter((m: any) => m.table_name === 'vanguard_stream' && m.id !== record.id)
          .map((m: any) => m.id)
        if (idsToClose.length > 0) {
          // Human gate: LLM inference cannot mutate evidence layer without confirmation.
          // Telegram notification sent immediately — user approves/rejects via buttons.
          const { data: proposalData } = await supabase
            .from('vanguard_stream_closure_proposals')
            .insert({
              user_id: record.user_id,
              proposed_by_record_id: record.id,
              target_record_ids: idsToClose,
              closed_topic_description: classification.closed_topic_description,
              similarity_threshold: CLOSURE_THRESHOLD,
              status: 'pending'
            })
            .select('id')
            .single();

          console.log(`[auto-classify] closure proposal created for ${idsToClose.length} record(s), topic: ${classification.closed_topic_description}`)

          // Send Telegram notification with approve/reject buttons
          if (proposalData?.id && TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
            const proposalId = proposalData.id;
            const topicSnippet = (classification.closed_topic_description as string || '').substring(0, 120);
            await sendMessage(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID,
              `🔄 *Zamknięcie wątku?*\n\nSystem wykrył że ta notatka może zamykać temat:\n_${topicSnippet}_\n\nDotyczy ${idsToClose.length} wpis(ów) w strumieniu.\n\nZatwierdzić? Wpisy przestaną być widoczne dla Oracle.`,
              {
                parseMode: 'Markdown',
                replyMarkup: {
                  inline_keyboard: [[
                    { text: '✅ Zamknij wątek', callback_data: `closure_approve_${proposalId}` },
                    { text: '❌ Zostaw otwarty', callback_data: `closure_reject_${proposalId}` }
                  ]]
                }
              }
            ).catch((err: Error) => console.warn('[auto-classify] closure Telegram notify failed:', err.message));
          }
        }
      }
    }

    // === Update stream record ===
    await safeExecute(
      supabase
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
    )

    // === INSERT friction_event jeśli wykryto mikrotarcie, gest lub obserwację ===
    // Wstawiamy rekord zawsze gdy model zwrócił poprawne event_kind (nawet jeśli is_relevant=false).
    // Dzięki temu wspieramy pełną taksonomię z promptu (w tym state_observation, micro_behavior_observation, reflection).
    const shouldLog = friction.event_kind !== null && friction.event_kind !== undefined

    // Declare outside shouldLog block so it's available in the response JSON
    let extractionQuality: number | null = null;

    if (shouldLog) {
      const { data: existingFriction } = await safeExecute(
        supabase
          .from('friction_events')
          .select('id')
          .eq('stream_record_id', record.id)
          .maybeSingle()
      )

      if (existingFriction) {
        console.log(`[auto-classify] friction_event already exists for stream record: ${record.id}`)
      } else {
        // Compute extraction quality tailored to event_kind to surface prompt vs reality drift
        let criticalFields: string[] = [];

        if (friction.event_kind === 'friction_event') {
          criticalFields = ['declared_intention', 'actual_behavior', 'deviation'];
        } else if (friction.event_kind === 'positive_micro_action') {
          criticalFields = ['actual_behavior'];
        } else if (friction.event_kind === 'state_observation' || friction.event_kind === 'micro_behavior_observation') {
          criticalFields = ['actual_behavior', 'emotional_state'];
        } else {
          criticalFields = ['actual_behavior'];
        }

        const present = criticalFields.filter(f => friction[f] && String(friction[f]).trim().length > 3);
        extractionQuality = criticalFields.length > 0
          ? Math.round((present.length / criticalFields.length) * 100)
          : 70;

        // extraction_quality (0-100) already captures quality — status stays 'raw' always
        const finalStatus = 'raw';

        await safeExecute(
          supabase
            .from('friction_events')
            .insert({
              user_id: record.user_id,
              stream_record_id: record.id,
              occurred_at: record.created_at || new Date().toISOString(),
              raw_text: record.content,
              event_kind: friction.event_kind,
              friction_type: friction.friction_type || 'other',
              declared_intention: friction.declared_intention || null,
              actual_behavior: friction.actual_behavior || null,
              deviation: friction.deviation || null,
              immediate_cost: friction.immediate_cost || null,
              emotional_state: friction.emotional_state || null,
              people_involved: friction.people_involved?.length > 0 ? friction.people_involved : null,
              location_context: friction.location_context || null,
              confidence_source: 'inferred',
              confidence: null,
              status: finalStatus,
              extraction_quality: extractionQuality
            })
        )
        console.log(`[auto-classify] friction_event inserted: ${friction.event_kind} | ${friction.friction_type} | quality=${extractionQuality}% | status=${finalStatus}`)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      classification,
      friction_detected: friction.is_relevant && (friction.event_kind === 'friction_event' || friction.event_kind === 'positive_micro_action'),
      event_kind: friction.event_kind || null,
      friction_type: friction.friction_type || null,
      extraction_quality: extractionQuality   // exposed for monitoring drift
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    await logCriticalError({
      area: 'auto-classify',
      error,
      message: 'Auto-classify function error',
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
