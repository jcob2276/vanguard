/**
 * @function vanguard-auto-classify
 * @trigger DB trigger / cron na nowe wpisy w vanguard_stream
 * @role Klasyfikacja strumienia: automatycznie wykrywa i zapisuje tarcia (friction_events) i ich odzyskiwanie (recovery).
 * @reads vanguard_stream, friction_events
 * @writes friction_events, audit_events
 * @calls deepseek-v4-flash, text-embedding-3-small, api.telegram.org (poprzez send.ts)
 * @consumer Zapis tarcia i regeneracji (baza dowodów)
 * @status active
 */
import { getEmbedding } from "../_shared/openai.ts";
import { safeExecute, createServiceClient, corsHeaders, resolveUserScope } from '../_shared/supabase.ts'
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

const TODO_CLASSIFY_SYSTEM = `Jestes asystentem organizacji zadan dla Jakuba (23 lata, Rzeszow, Polska).
Dostajesz JEDNO zadanie i zwracasz klasyfikacje w JSON.

Zasady bucket:
- "today"  = cos pilnego lub na dzis
- "soon"   = do zrobienia w ciagu 1-7 dni
- "later"  = za 1-4 tygodnie, brak jasnosci co do czasu
- "future" = konkretna data za >1 miesiac (np. "we wrzesniu", "w grudniu")

Zasady due_date:
- Wyciagnij date z tekstu jesli mozliwe (format YYYY-MM-DD, Warsaw TZ)
- "we wrzesniu" -> ustaw na ok. 5 dni PRZED (np. 2026-08-26 jako przypomnienie)
- Jesli brak daty -> null

Zasady priority (tylko gdy uzytkownik NIE podal priorytetu):
- "urgent" = blokuje cos innego lub jest deadline dzisiaj
- "high"   = wazne, trzeba zrobic w tym tygodniu
- "normal" = standardowe
- "low"    = kiedys, nice to have

Odpowiedz WYLACZNIE poprawnym JSON z polami: ai_bucket, due_date, priority.`;

async function handleTodoClassify(req: Request, body: any, supabase: any): Promise<Response> {
  const { itemId, userId: requestedUserId, title, notes, due_date, priority } = body;
  const { userId } = await resolveUserScope(req, requestedUserId ?? null);

  if (!itemId || !userId || !title) {
    return new Response(JSON.stringify({ error: "missing fields" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";
  const todayFull = new Date().toLocaleDateString("pl-PL", {
    timeZone: "Europe/Warsaw",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });

  const userMsg = [
    `Zadanie: "${title}"`,
    notes ? `Opis: "${notes}"` : null,
    due_date ? `Uzytkownik juz wpisal date: ${due_date} - NIE nadpisuj.` : null,
    priority ? `Uzytkownik juz wpisal priorytet: ${priority} - NIE nadpisuj.` : null,
    `Dzisiaj: ${todayFull} (${todayIso})`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await deepseekChat({
    apiKey,
    model: "deepseek-chat",
    messages: [
      { role: "system", content: TODO_CLASSIFY_SYSTEM },
      { role: "user", content: userMsg },
    ],
    maxTokens: 120,
    temperature: 0,
    responseFormat: { type: "json_object" },
  });

  const classification = parseJsonFromContent(result.content) || {};
  const ai_bucket = (classification.ai_bucket as string) || "later";

  const patch: Record<string, unknown> = {
    ai_bucket,
    ai_classified_at: new Date().toISOString(),
  };
  if (!due_date && classification.due_date) patch.due_date = classification.due_date;
  if (!priority && classification.priority) patch.priority = classification.priority;

  const { error: updateErr } = await supabase
    .from("todo_items")
    .update(patch)
    .eq("id", itemId)
    .eq("user_id", userId);
  if (updateErr) throw new Error(updateErr.message);

  return new Response(JSON.stringify({ ok: true, ...patch }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TODO_EXTRACT_SYSTEM = `Jestes asystentem Jakuba. Dostajesz dowolny wklejony tekst (notatki ze spotkania, e-mail, plan, luzne mysli) i wyciagasz z niego KONKRETNE, WYKONALNE zadania do zrobienia.

Zasady:
- Kazde zadanie to jedna konkretna akcja (czasownik + obiekt), maks 12 slow
- Ignoruj zdania ktore nie sa zadaniami (opisy, kontekst, pytania retoryczne)
- Jesli w tekscie jest jasna data dla zadania, ustaw due_date (YYYY-MM-DD, Warsaw TZ, dzisiaj = {{TODAY}})
- Jesli brak daty, due_date = null
- Priorytet ustaw tylko gdy tekst jednoznacznie sugeruje pilnosc: "urgent" (blokuje/deadline dzisiaj), "high" (wazne w tym tygodniu), w innym wypadku null
- Maksymalnie 20 zadan
- Jezyk polski

Odpowiedz WYLACZNIE poprawnym JSON: { "tasks": [{ "title": string, "due_date": string|null, "priority": string|null }] }`;

async function handleTodoExtract(req: Request, body: any): Promise<Response> {
  const { text, userId: requestedUserId } = body;
  const { userId } = await resolveUserScope(req, requestedUserId ?? null);

  if (!userId || !text || typeof text !== "string" || !text.trim()) {
    return new Response(JSON.stringify({ error: "missing fields" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
  const system = TODO_EXTRACT_SYSTEM.replace("{{TODAY}}", todayIso);

  const result = await deepseekChat({
    apiKey,
    model: "deepseek-chat",
    messages: [
      { role: "system", content: system },
      { role: "user", content: text.slice(0, 6000) },
    ],
    maxTokens: 1500,
    temperature: 0.2,
    responseFormat: { type: "json_object" },
  });

  const parsed = parseJsonFromContent(result.content) || {};
  const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const tasks = rawTasks
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => ({
      title: typeof t.title === "string" ? t.title.trim() : "",
      due_date: typeof t.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : null,
      priority: typeof t.priority === "string" && ["urgent", "high", "normal", "low"].includes(t.priority) ? t.priority : null,
    }))
    .filter((t) => t.title.length > 0)
    .slice(0, 20);

  return new Response(JSON.stringify({ tasks }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createServiceClient()

    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || body.action;

    if (action) {
      if (action === "todo-classify") {
        return await handleTodoClassify(req, body, supabase);
      }
      if (action === "todo-extract") {
        return await handleTodoExtract(req, body);
      }
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { record } = body;

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
2. \`positive_micro_action\` — dobry mikrogest, pozytywne mikrozachowanie.
3. \`recovery_event\` — przełamanie oporu, powrót do pionu po tarciu, lub zrobienie czegoś mimo niechęci (adaptive move).
4. \`state_observation\` — stan emocjonalny lub fizyczny użytkownika bez jawnego odchylenia intencji.
5. \`micro_behavior_observation\` — zaobserwowane zachowanie bez jawnej intencji w danym momencie (nawykowe gesty, tiki, sposoby reakcji).
6. \`reflection\` — refleksja, generalizacja, wniosek, przemyślenia.

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

Zwróć TYLKO JSON w formacie:
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

WAŻNE: positive_micro_action oraz recovery_event zawsze mają is_relevant=true.

### PRZYKŁADY FEW-SHOT (Wejście -> Wyjście JSON):

1. Wejście: "Boli mnie dziś brzuch od rana i czuję spory stres przed tym spotkaniem."
Wyjście JSON:
{
  "is_relevant": true,
  "event_kind": "state_observation",
  "friction_type": "other",
  "declared_intention": null,
  "actual_behavior": "ból brzucha od rana, stres przed spotkaniem",
  "deviation": null,
  "immediate_cost": null,
  "emotional_state": "stres",
  "people_involved": [],
  "location_context": null
}

2. Wejście: "Miałem napisać podsumowanie projektu przed 15:00, ale zamiast tego scrollowałem Twittera i odłożyłem to na jutro."
Wyjście JSON:
{
  "is_relevant": true,
  "event_kind": "friction_event",
  "friction_type": "procrastination",
  "declared_intention": "napisanie podsumowania projektu przed 15:00",
  "actual_behavior": "scrollowanie Twittera, odłożenie zadania na jutro",
  "deviation": "zamiast pisać raport, scrollował social media i odłożył pracę",
  "immediate_cost": "opóźnienie raportu o 1 dzień",
  "emotional_state": null,
  "people_involved": [],
  "location_context": null
}

3. Wejście: "Chciałem wejść na Instagrama z przyzwyczajenia, ale złapałem się na tym, zamknąłem aplikację i odłożyłem telefon."
Wyjście JSON:
{
  "is_relevant": true,
  "event_kind": "recovery_event",
  "friction_type": "recovery_anchor",
  "declared_intention": "wejście na Instagram z przyzwyczajenia",
  "actual_behavior": "zauważenie impulsu, zamknięcie aplikacji, odłożenie telefonu",
  "deviation": "przełamanie nawyku scrollowania w zalążku",
  "immediate_cost": null,
  "emotional_state": null,
  "people_involved": [],
  "location_context": null
}

4. Wejście: "Zauważyłem, że kiedy ktoś mówi coś głupiego, to natychmiast przewracam oczami."
Wyjście JSON:
{
  "is_relevant": true,
  "event_kind": "micro_behavior_observation",
  "friction_type": "other",
  "declared_intention": null,
  "actual_behavior": "przewracanie oczami w reakcji na głupie wypowiedzi",
  "deviation": null,
  "immediate_cost": null,
  "emotional_state": null,
  "people_involved": [],
  "location_context": null
}

5. Wejście: "Myślę, że większość ludzi unika trudnych rozmów, bo boi się dyskomfortu."
Wyjście JSON:
{
  "is_relevant": true,
  "event_kind": "reflection",
  "friction_type": null,
  "declared_intention": null,
  "actual_behavior": "refleksja o unikaniu trudnych rozmów przez ludzi",
  "deviation": null,
  "immediate_cost": null,
  "emotional_state": null,
  "people_involved": [],
  "location_context": null
}

6. Wejście: "Jutro muszę wstać o 6:00 i zrobić trening biegowy."
Wyjście JSON:
{
  "is_relevant": false,
  "event_kind": null,
  "friction_type": null,
  "declared_intention": null,
  "actual_behavior": null,
  "deviation": null,
  "immediate_cost": null,
  "emotional_state": null,
  "people_involved": [],
  "location_context": null
}`
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
