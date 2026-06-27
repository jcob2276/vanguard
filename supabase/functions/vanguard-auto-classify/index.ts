import { getEmbedding } from "../_shared/openai.ts";
import { safeExecute, createServiceClient, corsHeaders } from '../_shared/supabase.ts'
import { sendMessage } from '../_shared/telegram.ts'
import { logCriticalError } from '../_shared/errorLogging.ts'
import { logAuditEvent } from '../_shared/audit.ts'
import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";

const TELEGRAM_TOKEN   = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TELEGRAM_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '0');

import { ALLOWED_CATEGORIES, ALLOWED_EVENT_KINDS, ALLOWED_FRICTION_TYPES } from '../_shared/domain.ts';

// Normalizuje output LLM dla klasyfikacji: wymusza zamknięte słowniki i bezpieczne typy.
function normalizeClassification(raw: any): any {
  const category = ALLOWED_CATEGORIES.includes(raw?.category) ? raw.category : 'Chaos';
  const tags = Array.isArray(raw?.tags)
    ? [...new Set(raw.tags.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 5)
    : [];

  let importance_score = parseInt(raw?.importance_score);
  if (isNaN(importance_score) || importance_score < 1 || importance_score > 10) {
    importance_score = 5;
  }

  const temporality = (raw?.temporality === 'trwałe' || raw?.temporality === 'tymczasowe')
    ? raw.temporality
    : 'tymczasowe';

  return {
    ...raw,
    category,
    tags,
    importance_score,
    temporality,
    is_closure: !!raw?.is_closure,
    closed_topic_description: typeof raw?.closed_topic_description === 'string' ? raw.closed_topic_description : null,
    expiration_date: typeof raw?.expiration_date === 'string' ? raw.expiration_date : null,
  };
}

// Normalizuje output LLM dla mikrotarć.
function normalizeFriction(raw: any): any {
  const event_kind = ALLOWED_EVENT_KINDS.includes(raw?.event_kind) ? raw.event_kind : null;
  const friction_type = ALLOWED_FRICTION_TYPES.includes(raw?.friction_type) ? raw.friction_type : 'other';
  const is_relevant = typeof raw?.is_relevant === 'boolean' ? raw.is_relevant : (event_kind !== null);

  return {
    ...raw,
    event_kind,
    friction_type,
    is_relevant
  };
}

Deno.serve(async (req) => {
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
    // != null (not truthy) — importance_score: 0 is a valid score and must not look "unclassified"
    if (record.classification != null && record.importance_score != null) {
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

    const apiKey = Deno.env.get('DEEPSEEK_API_KEY') || '';

    // === KROK 1: Klasyfikacja i KROK 2: Friction detection (równolegle) ===
    let classifyRes, frictionRes;
    try {
      [classifyRes, frictionRes] = await Promise.all([
        deepseekChat({
          apiKey,
          model: 'deepseek-v4-flash',
          messages: [
            {
              role: 'system',
              content: `Jesteś systemem analitycznym Vanguard OS. Zwróć TYLKO JSON:
{
  "importance_score": (1-10),
  "category": ("Ciało" | "Konto" | "Duch" | "Chaos" | "Relacje"),
  "tags": [max 5 tagów],
  "temporality": ("trwałe" | "tymczasowe"),
  "fingerprint_text": "2-zdaniowe podsumowanie stanu biometrycznego i tematu notatki",
  "is_closure": boolean,
  "closed_topic_description": "krótki opis zamykanego wątku jeśli is_closure=true, inaczej null",
  "expiration_date": "ISO string jeśli w tekście jest termin LUB jeśli temporality=tymczasowe, inaczej null"
}

ZASADA TRWAŁOŚCI (temporality) — zapobiega długoterminowaniu szumu dnia:
- Test 7 dni: czy ten fakt będzie istotny za 7 dni? NIE → "tymczasowe". TAK → "trwałe".
- Test atrybut vs zdarzenie: zapisuj CO TO ZNACZY o użytkowniku, nie CO SIĘ WYDARZYŁO. Jednorazowe zdarzenie/transakcja/stan dnia → "tymczasowe". Wzorzec, nawyk, trwałe ograniczenie/preferencja → "trwałe".
- Jeśli temporality="tymczasowe" i nie podałeś expiration_date w treści, USTAW expiration_date na +3 dni od teraz — tymczasowe wpisy MUSZĄ mieć datę wygaśnięcia, inaczej zaśmiecają długoterminowy kontekst.

Przykłady:
"Boli mnie dziś brzuch, stresuję się przed weselem" → temporality="tymczasowe" (stan przejściowy, konkretny dzień)
"Mam refluks, muszę unikać kawy po 16" → temporality="trwałe" (stałe ograniczenie zdrowotne)
"Zaspałem dziś bo siedziałem do 2 w nocy" → temporality="tymczasowe" (jednorazowe zdarzenie)
"Zawsze zasypiam po północy, to mój wzorzec" → temporality="trwałe" (nawyk)
"Kupiłem nowe buty do biegania za 600zł" → temporality="tymczasowe" (transakcja, szum)
"Biegam tylko w Asicsach, inne mi obcierają" → temporality="trwałe" (trwała preferencja)`
            },
            {
              role: 'user',
              content: `KONTEKST: ${contextStr}\nNOTATKA: ${record.content}`
            }
          ],
          temperature: 0.1,
          maxTokens: null,
          responseFormat: { type: 'json_object' }
        }),
        deepseekChat({
          apiKey,
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
3. \`recovery_event\` — przełamanie oporu, powrót do pionu po tarciu, lub zrobienie czegoś mimo niechęci (adaptive move).
   - Przykład: "chciałem scrollować, ale odłożyłem telefon" lub "nie chciało mi się, ale i tak poszedłem na trening".
4. \`state_observation\` — stan emocjonalny lub fizyczny użytkownika bez jawnego odchylenia intencji.
   - Przykład: "jadę na wesele, boli mnie brzuch, stresuję się" lub "jestem zmęczony, mam dziś mało energii".
5. \`micro_behavior_observation\` — zaobserwowane zachowanie bez jawnej intencji w danym momencie (nawykowe gesty, tiki, sposoby reakcji).
   - Przykład: "zauważyłem, że nie patrzę w oczy podczas mówienia".
6. \`reflection\` — refleksja, generalizacja, wniosek, przemyślenia.
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
- recovery_anchor: świadome powstrzymanie złego nawyku (np. odłożył telefon, wyszedł z aplikacji)
- adaptive_move: zrobienie czegoś trudnego/ważnego pomimo oporu (np. poszedł na trening mimo braku sił)
- other: inne odchylenie lub stan niepasujący do powyższych

Zwróć TYLKO JSON:
{
  "is_relevant": boolean,
  "event_kind": "friction_event" | "positive_micro_action" | "recovery_event" | "state_observation" | "micro_behavior_observation" | "reflection" | null,
  "friction_type": "sleep_disruption"|"avoidance"|"procrastination"|"habit_break"|"training_drop"|"social_hesitation"|"communication_drift"|"emotional_spike"|"self_control_break"|"positive_micro_action"|"recovery_anchor"|"adaptive_move"|"other"|null,
  "declared_intention": "dosłownie z tekstu co miało być zrobione (lub null jeśli nie podano)",
  "actual_behavior": "dosłownie z tekstu co się stało/co zaobserwowano (lub null)",
  "deviation": "różnica między intencją a zachowaniem — tylko jeśli obie strony są jawne w tekście (lub null)",
  "immediate_cost": "TYLKO jeśli koszt jest jawnie wymieniony w tekście (lub null)",
  "emotional_state": "stan emocjonalny jeśli wymieniony (lub null)",
  "people_involved": ["osoby jeśli wymienione z imienia"],
  "location_context": "miejsce jeśli wymienione (lub null)"
}

WAŻNE: positive_micro_action oraz recovery_event zawsze mają is_relevant=true (to zdarzenia warte zalogowania).

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
        maxTokens: null,
        responseFormat: { type: 'json_object' }
      })
    ]);
  } catch (err: any) {
    console.error(`[auto-classify] DeepSeek error:`, err);
    return new Response(JSON.stringify({
      error: `DeepSeek upstream error: ${err.message}`,
      record_id: record.id
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // === Parse klasyfikacja ===
  // parseJsonFromContent (brace-depth scan) instead of raw JSON.parse — DeepSeek sometimes
  // wraps JSON in markdown fences despite responseFormat:json_object, which raw JSON.parse
  // can't handle; that silently dropped every such message into the generic "Chaos" fallback
  // below instead of its real classification.
  let classification: any = parseJsonFromContent(classifyRes.content || '{}');
  if (!classification) {
    console.error(`[auto-classify] classify JSON parse failed, using fallback. Raw: ${(classifyRes.content || '').slice(0, 200)}`);
    // Skip z dowodem: zamiast cichego fallbacku, audit_events dostaje konkretny powód
    // i fragment surowej odpowiedzi — żeby nie trzeba było grzebać w edge logs by zrozumieć dlaczego.
    await logAuditEvent({
      eventType: 'classify_parse_fallback',
      severity: 'warning',
      message: 'auto-classify: classify JSON parse failed, used Chaos fallback',
      userId: record.user_id,
      relatedTable: 'vanguard_stream',
      relatedId: record.id,
      metadata: { raw_response: (classifyRes.content || '').slice(0, 500) },
    });
    classification = { importance_score: 5, category: 'Chaos', tags: [], temporality: 'tymczasowe', fingerprint_text: null, is_closure: false, closed_topic_description: null, expiration_date: null };
  }
  classification = normalizeClassification(classification);

  // Tymczasowe wpisy bez wyraźnej daty wygaśnięcia dostają domyślne +3 dni —
  // zapobiega temu, żeby stan jednego dnia (np. "boli mnie brzuch") długoterminował się
  // w vanguard_stream bez ograniczenia (patrz lessons.md: bug z nadpisywaniem valid_from).
  if (classification.temporality === 'tymczasowe' && !classification.expiration_date) {
    const fallbackExpiry = new Date();
    fallbackExpiry.setDate(fallbackExpiry.getDate() + 3);
    classification.expiration_date = fallbackExpiry.toISOString();
  }

  // === Parse friction ===
  let friction: any = parseJsonFromContent(frictionRes.content || '{"is_relevant":false}');
  if (!friction) {
    console.error(`[auto-classify] friction JSON parse failed, using fallback. Raw: ${(frictionRes.content || '').slice(0, 200)}`);
    await logAuditEvent({
      eventType: 'friction_parse_fallback',
      severity: 'warning',
      message: 'auto-classify: friction JSON parse failed, used is_relevant=false fallback',
      userId: record.user_id,
      relatedTable: 'vanguard_stream',
      relatedId: record.id,
      metadata: { raw_response: (frictionRes.content || '').slice(0, 500) },
    });
    friction = { is_relevant: false, event_kind: null, friction_type: null };
  } else {
    friction = normalizeFriction(friction);
  }

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
        const { data: matches, error: matchErr } = await supabase.rpc('match_vanguard_content', {
          query_embedding: closureEmbedding,
          match_threshold: CLOSURE_THRESHOLD,
          match_count: 5,
          user_id_param: record.user_id
        })
        if (matchErr) console.error('[auto-classify] match_vanguard_content failed:', matchErr)
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

    // === INSERT friction_event jeśli wykryto mikrotarcie, gest lub obserwację ===
    // Wstawiamy rekord zawsze gdy model zwrócił poprawne event_kind (nawet jeśli is_relevant=false).
    // Dzięki temu wspieramy pełną taksonomię z promptu (w tym state_observation, micro_behavior_observation, reflection).
    const shouldLog = friction.event_kind !== null && friction.event_kind !== undefined

    // Declare outside shouldLog block so it's available in the response JSON
    let extractionQuality: number | null = null;

    if (shouldLog) {
      // safeExecute returns data directly (throws on error) — do NOT destructure { data }
      const existingFriction = await safeExecute(
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
        } else if (friction.event_kind === 'positive_micro_action' || friction.event_kind === 'recovery_event') {
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
              people_involved: Array.isArray(friction.people_involved) && friction.people_involved.length > 0
                ? friction.people_involved
                : typeof friction.people_involved === 'string' && friction.people_involved.length > 0
                  ? [friction.people_involved]
                  : null,
              location_context: friction.location_context || null,
              confidence_source: 'inferred',
              confidence: null,
              status: finalStatus,
              extraction_quality: extractionQuality,
              parser_version: 'auto-classify-v41'
            })
        )
        console.log(`[auto-classify] friction_event inserted: ${friction.event_kind} | ${friction.friction_type} | quality=${extractionQuality}% | status=${finalStatus}`)
      }
    }

    // === Update stream record (mint-then-fill: zapisane na końcu) ===
    // Idempotency gate na początku tej funkcji (classification != null) sprawdza dokładnie te pola —
    // jeśli friction_events insert wyżej rzuci wyjątkiem, ten update nigdy się nie wykona, rekord
    // zostaje "niesklasyfikowany" i retry/webhook-replay spróbuje całego pipeline'u od nowa,
    // zamiast trwale gubić friction_event przy częściowym sukcesie.
    await safeExecute(
      supabase
        .from('vanguard_stream')
        .update({
          importance_score: classification.importance_score,
          category: classification.category,
          tags: classification.tags,
          situation_fingerprint: embedding,
          classification: classification.category?.toLowerCase(),
          valid_from: record.valid_from || record.created_at || new Date().toISOString(),
          valid_until: classification.expiration_date || null
        })
        .eq('id', record.id)
    )

    return new Response(JSON.stringify({
      success: true,
      classification,
      friction_detected: friction.is_relevant && (friction.event_kind === 'friction_event' || friction.event_kind === 'positive_micro_action' || friction.event_kind === 'recovery_event'),
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
