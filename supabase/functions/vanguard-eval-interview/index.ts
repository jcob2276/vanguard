/**
 * @function vanguard-eval-interview
 * @trigger pg_cron Mon-Fri `0 10 * * 1-5` UTC (12:00 Warsaw) / manual
 * @role Interaktywny wywiad ("Wywiad"): zadaje na Telegramie jedno pytanie mające uzupełnić luki w grafie wiedzy.
 * @reads vanguard_eval_results, vanguard_eval_runs, vanguard_stream, daily_reconciliations
 * @writes vanguard_eval_results, vanguard_stream
 * @calls deepseek-v4-flash, api.telegram.org (poprzez send.ts)
 * @consumer Czat z botem na Telegramie (pytanie i odpowiedź)
 * @status active
 */
import { createServiceClient, corsHeaders } from "../_shared/supabase.ts";
import { getVanguardUserId } from "../_shared/constants.ts";
import { deepseekChat } from "../_shared/deepseek.ts";
import { sendMessageParsed } from "../_shared/telegram.ts";

// Categories with worst eval performance — target these first
const TARGET_CATEGORIES = ["fact_recall", "relation_reasoning"];

function isUsableQuestion(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 45) return false;
  if (!t.includes("?")) return false;
  if (/^(opowiedz mi|powiedz mi|jak to|co masz na myśli)\s*,?\s*$/i.test(t)) return false;
  return true;
}

function cleanMemoryLabel(text: string): string {
  return text
    .replace(/\[[^\]]+\]\s*/g, "")
    .replace(/\b[a-z]+(?:_[a-z]+)+\b/gi, "")
    .replace(/\s+x\d+\s*:/i, ":")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[:;,\-.]+\s*/, "")
    .replace(/\.\s*\./g, ".")
    .trim()
    .replace(/[.:;,\s]+$/, "");
}

function buildDeterministicMemoryQuestion(memoryContext: any): string {
  const curiosity = memoryContext.pending_curiosity?.[0];
  if (curiosity?.provocation && curiosity.provocation.includes("?")) return curiosity.provocation;
  if (curiosity?.hypothesis) {
    const hypothesis = cleanMemoryLabel(curiosity.hypothesis);
    // Take only the first clause (before ; or , or 60 chars) to avoid dumping a long hypothesis verbatim
    const firstClause = hypothesis.split(/[;,]/)[0].trim().slice(0, 80);
    return `Kiedy ostatnio zdarzyło się: ${firstClause}? Co wtedy było inaczej niż zwykle?`;
  }

  const pattern = memoryContext.behavioral_patterns?.[0];
  if (pattern?.title || pattern?.evidence_text) {
    const patternLabel = cleanMemoryLabel(pattern.title || pattern.evidence_text || pattern.pattern_type);
    return `Opowiedz mi więcej o tym wzorcu: ${patternLabel}. Kiedy ostatnio się uruchomił i jaki był pierwszy zauważalny sygnał?`;
  }

  const wiki = memoryContext.wiki_pages?.[0];
  if (wiki?.title) {
    return `Opowiedz mi, co trzeba doprecyzować w temacie "${wiki.title}". Jaki fakt, przykład albo decyzja najlepiej uzupełniłaby pamięć Vanguard?`;
  }

  const edge = memoryContext.graph_edges?.[0];
  if (edge?.source_entity && edge?.target_entity) {
    return `Opowiedz mi więcej o relacji "${edge.source_entity} → ${edge.target_entity}". Co jest tu aktualne, a co może być już stare albo nieprecyzyjne?`;
  }

  const friction = memoryContext.friction_events?.[0];
  if (friction?.friction_type) {
    return `Opowiedz mi więcej o ostatnim tarciu typu "${friction.friction_type}". Jaka była intencja, co faktycznie zrobiłeś i jaki był koszt?`;
  }

  return "Opowiedz mi, które miejsce w pamięci Vanguard najbardziej wymaga doprecyzowania: fakt, relacja, decyzja, wzorzec albo wynik działania.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let manual = false;
    if (req.method === "POST") {
      try {
        const payload = await req.json();
        manual = payload?.manual === true;
      } catch (_: unknown) {
    console.error('[Edge Function Error]', _);
    return new Response(JSON.stringify({ error: _ instanceof Error ? _.message : String(_) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
    }

    const supabase = createServiceClient();
    const userId = getVanguardUserId();
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
    const chatId = parseInt(Deno.env.get("TELEGRAM_CHAT_ID") ?? "0");
    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY") ?? "";

    // Guard: skip Saturday (day 6 in Warsaw)
    const now = new Date();
    const isoDay = now.toLocaleDateString("en-US", { timeZone: "Europe/Warsaw", weekday: "long" });
    if (isoDay === "Saturday" && !manual) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Saturday — saturday_checkin handles this" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Guard: skip if a previous interview question sent < 20h ago still has no reply
    const twentyHoursAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();
    const { data: recentInterview } = await supabase
      .from("vanguard_stream")
      .select("id, created_at, metadata")
      .eq("user_id", userId)
      .eq("source", "eval_interview")
      .gte("created_at", twentyHoursAgo)
      .limit(1)
      .maybeSingle();

    if (recentInterview) {
      // Check if there's a subsequent stream entry (user replied)
      const { data: userReply } = await supabase
        .from("vanguard_stream")
        .select("id")
        .eq("user_id", userId)
        .neq("source", "eval_interview")
        .neq("source", "oracle_chat")
        .gt("created_at", recentInterview.created_at)
        .limit(1)
        .maybeSingle();

      if (!userReply && !manual) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "Previous interview question still unanswered" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 1. Spróbuj pobrać zadanie aktywnego uczenia (wiki review lub przeterminowany link)
    const [{ data: wikiReviewItems }, { data: staleLinks }] = await Promise.all([
      supabase
        .from("vanguard_wiki_review_items")
        .select("id, item_type, title, detail, severity")
        .eq("user_id", userId)
        .eq("status", "open")
        .order("severity", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("vanguard_entity_links")
        .select("id, source_entity, relation, target_entity, source_type, target_type, confidence_score, fact_text")
        .eq("user_id", userId)
        .eq("status", "active")
        .eq("memory_type", "fact")
        .lt("confidence_score", 0.7)
        .order("created_at", { ascending: true })
        .limit(1)
    ]);

    let latestRun: any = null;
    let resolvedFailingResults: any[] = [];
    let useGeneratedQuestion = false;

    const hasActiveLearning = (wikiReviewItems && wikiReviewItems.length > 0) || (staleLinks && staleLinks.length > 0);

    if (hasActiveLearning) {
      useGeneratedQuestion = true;
    } else {
      // Find the most recent eval run
      const { data: runData, error: runErr } = await supabase
        .from("vanguard_eval_runs")
        .select("id, summary, completed_at")
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      latestRun = runData;

      if (latestRun && !runErr) {
        // Get failing questions from target categories
        const { data: failingResults } = await supabase
          .from("vanguard_eval_results")
          .select("question_id, question, category, score, judge_notes")
          .eq("run_id", latestRun.id)
          .eq("passed", false)
          .in("category", TARGET_CATEGORIES)
          .order("score", { ascending: true }) // worst first
          .limit(20);

        resolvedFailingResults = failingResults || [];

        if (resolvedFailingResults.length === 0) {
          // Fall back to any failing question across all categories
          const { data: allFailing } = await supabase
            .from("vanguard_eval_results")
            .select("question_id, question, category, score, judge_notes")
            .eq("run_id", latestRun.id)
            .eq("passed", false)
            .order("score", { ascending: true })
            .limit(20);

          resolvedFailingResults = allFailing || [];
        }
      }

      if (resolvedFailingResults.length === 0) {
        // Everything passing — generate a deepening question from recent stream
        useGeneratedQuestion = true;
      }
    }

    // --- Generated deepening question path ---
    if (useGeneratedQuestion) {
      let activeLearningPrompt = "";
      let proposedMemoryStr = "";
      let activeLearningDedupeKey = "";
      let activeLearningType = "";
      let activeLearningItemId = "";

      if (wikiReviewItems && wikiReviewItems.length > 0) {
        const item = wikiReviewItems[0];
        activeLearningType = "wiki_review";
        activeLearningItemId = item.id;
        activeLearningDedupeKey = `wiki_review_${item.id}`;

        try {
          const reform = await deepseekChat({
            apiKey: deepseekApiKey,
            model: "deepseek-chat", // use V3 for structured JSON output
            userId,
            feature: "eval-interview-active-learning",
            responseFormat: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `Jesteś systemem aktywnego uczenia w Vanguard OS. Formułujesz krótkie, bezpośrednie pytania po polsku do użytkownika (Jakuba) w celu wyjaśnienia konfliktów lub niepewności w jego bazie wiedzy.
Twoja odpowiedź musi być poprawnym obiektem JSON:
{
  "question": "Jasne pytanie wyjaśniające (max 20 słów), np. Czy na stałe przestałeś pić kawę po 15:00?",
  "proposed_memory": {
    "source": "Jakub",
    "relation": "relacja",
    "target": "wartość",
    "source_type": "user",
    "target_type": "trait"
  }
}
proposed_memory powinno reprezentować fakt, który zostanie zapisany w bazie wiedzy, jeśli Jakub odpowie twierdząco (TAK).`
              },
              {
                role: "user",
                content: `Kontekst niepewności/konfliktu:
Typ: ${item.item_type}
Tytuł: ${item.title}
Szczegóły: ${item.detail}`
              }
            ]
          });

          const parsed = JSON.parse(reform.content || "{}");
          if (parsed.question && parsed.proposed_memory) {
            activeLearningPrompt = parsed.question;
            proposedMemoryStr = JSON.stringify(parsed.proposed_memory);
          }
        } catch (e) {
          console.error("[eval-interview] Failed to format wiki review active learning question:", e);
        }
      } else if (staleLinks && staleLinks.length > 0) {
        const link = staleLinks[0];
        activeLearningType = "stale_link";
        activeLearningItemId = link.id;
        activeLearningDedupeKey = `stale_link_${link.id}`;

        try {
          const reform = await deepseekChat({
            apiKey: deepseekApiKey,
            model: "deepseek-chat",
            userId,
            feature: "eval-interview-active-learning",
            responseFormat: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `Jesteś systemem aktywnego uczenia w Vanguard OS. Formułujesz krótkie, bezpośrednie pytania po polsku do użytkownika (Jakuba) w celu weryfikacji starego lub niepewnego faktu z bazy wiedzy.
Twoja odpowiedź musi być poprawnym obiektem JSON:
{
  "question": "Jasne pytanie weryfikacyjne (max 20 słów), np. Czy to prawda, że wciąż studiujesz na AGH?",
  "proposed_memory": {
    "source": "Jakub",
    "relation": "relacja",
    "target": "wartość",
    "source_type": "user",
    "target_type": "trait"
  }
}
proposed_memory powinno reprezentować fakt, który zostanie potwierdzony/zaktualizowany w bazie wiedzy, jeśli Jakub odpowie twierdząco (TAK).`
              },
              {
                role: "user",
                content: `Stary/niepewny fakt:
Podmiot: ${link.source_entity}
Relacja: ${link.relation}
Obiekt: ${link.target_entity}
Tekst faktu: ${link.fact_text || ""}
Aktualna pewność: ${link.confidence_score}`
              }
            ]
          });

          const parsed = JSON.parse(reform.content || "{}");
          if (parsed.question && parsed.proposed_memory) {
            activeLearningPrompt = parsed.question;
            proposedMemoryStr = JSON.stringify(parsed.proposed_memory);
          }
        } catch (e) {
          console.error("[eval-interview] Failed to format stale link active learning question:", e);
        }
      }

      let generatedPrompt = activeLearningPrompt;

      // Jeśli nie udało się wygenerować pytania aktywnego uczenia, fall back do oryginalnego generycznego przepływu
      if (!isUsableQuestion(generatedPrompt)) {
        const cut72h = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
        const cut30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const [curiosityRes, patternsRes, wikiRes, graphRes, frictionRes, streamRes, ouraRes, recentTopicsRes] = await Promise.all([
          supabase
            .from("vanguard_curiosity_queue")
            .select("hypothesis, provocation, confidence_score, category, evidence_count, created_at")
            .eq("user_id", userId)
            .eq("status", "pending")
            .order("confidence_score", { ascending: false })
            .limit(5),
          supabase
            .from("vanguard_behavioral_patterns")
            .select("pattern_type, title, evidence_text, occurrence_count, confidence, status, last_seen")
            .eq("user_id", userId)
            .in("status", ["active", "candidate"])
            .order("confidence", { ascending: false })
            .limit(5),
          supabase
            .from("vanguard_wiki_pages")
            .select("title, page_type, status, confidence, summary, tags, last_seen_at")
            .eq("user_id", userId)
            .in("status", ["active", "needs_review"])
            .order("last_seen_at", { ascending: false })
            .limit(8),
          supabase
            .from("vanguard_entity_links")
            .select("source_entity, relation, target_entity, temporal_status, memory_type, confidence_score, evidence_count, last_seen, fact_text")
            .eq("user_id", userId)
            .in("status", ["active"])
            .order("evidence_count", { ascending: false })
            .limit(12),
          supabase
            .from("confirmed_friction_events")
            .select("occurred_at, friction_type, declared_intention, actual_behavior, deviation, immediate_cost, confidence")
            .eq("user_id", userId)
            .gte("occurred_at", cut30d)
            .order("occurred_at", { ascending: false })
            .limit(8),
          supabase
            .from("vanguard_stream")
            .select("content, category, created_at")
            .eq("user_id", userId)
            .not("source", "eq", "eval_interview")
            .not("source", "eq", "oracle_chat")
            .gte("created_at", cut72h)
            .order("created_at", { ascending: false })
            .limit(12),
          supabase
            .from("oura_daily_summary")
            .select("date, sleep_start, sleep_end, total_sleep_hours, sleep_score, readiness_score")
            .eq("user_id", userId)
            .order("date", { ascending: false })
            .limit(7),
          supabase
            .from("vanguard_stream")
            .select("metadata, content")
            .eq("user_id", userId)
            .eq("source", "eval_interview")
            .gte("created_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .limit(10),
        ]);

        const recentTopicTags: string[] = (recentTopicsRes.data || [])
          .flatMap((r: any) => [
            r.metadata?.topic_tag,
            r.metadata?.friction_type_focus,
          ])
          .filter(Boolean);

        const ouraRows = ouraRes.data || [];
        const ouraSleesSummary = ouraRows.length > 0
          ? ouraRows.map((r: any) => {
              const bedtime = r.sleep_start
                ? new Date(r.sleep_start).toLocaleTimeString("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" })
                : null;
              return `${r.date}: pora zaśnięcia=${bedtime ?? "??"}, sen=${r.total_sleep_hours?.toFixed(1) ?? "??"}h, score=${r.sleep_score ?? "??"}`;
            })
          : [];

        const memoryContext = {
          instruction: "Select one high-information-gain question for the user. Do not quote long source text. Do not force unrelated recent topics together.",
          pending_curiosity: curiosityRes.data || [],
          behavioral_patterns: patternsRes.data || [],
          wiki_pages: wikiRes.data || [],
          graph_edges: graphRes.data || [],
          friction_events: frictionRes.data || [],
          recent_stream_72h: streamRes.data || [],
          oura_sleep_last_7d: ouraSleesSummary,
          recently_asked_topic_tags: recentTopicTags,
        };

        try {
          const result = await deepseekChat({
            apiKey: deepseekApiKey,
            model: "deepseek-chat",
            userId,
            feature: "eval-interview-deepening",
            maxTokens: 120,
            temperature: 0.5,
            timeoutMs: 15000,
            messages: [
              {
                role: "system",
                content: `Jesteś selektorem pytań dla Vanguard OS.
Masz pamięć użytkownika: pending hypotheses, wzorce, wiki, graf, tarcia, świeży stream i dane biometryczne Oura.
Wybierz JEDNO pytanie o najwyższej wartości informacyjnej dla pamięci systemu.

FORMAT — jeden z tych wzorców:
- "Co konkretnie [obserwacja] — co wtedy robisz?"
- "Kiedy ostatnio [wzorzec], co było inaczej?"
- "Co sprawia że [hipoteza] — jeden przykład?"
- "Jak wygląda [zjawisko] w praktyce?"

Zasady:
- JEDNO zdanie — max 20 słów.
- Musi kończyć się znakiem "?".
- Zero wstępu, zero obserwacji przed pytaniem — tylko samo pytanie.
- Konkretne i operacyjne, nie filozoficzne.
- Zacznij bezpośrednio od pytania (nie od "Opowiedz mi o hipotezie").
- Nie cytuj hipotez ani źródeł — przetłumacz na ludzkie pytanie.
- Nie diagnozuj i nie psychoanalizuj.

ZAKAZY:
- NIE pytaj "dlaczego nie logujesz X" ani "nie odnotowałeś X".
- Jeśli recently_asked_topic_tags zawiera dany temat, wybierz INNY — 7 dni cooldown.
- Unikaj pytań czysto faktograficznych które można sprawdzić w bazie.`,
              },
              {
                role: "user",
                content: `KONTEKST PAMIĘCI:
${JSON.stringify(memoryContext, null, 2)}

Zwróć tylko treść pytania, bez komentarza.`,
              },
            ],
          });
          const candidate = result.content?.trim() || "";
          if (isUsableQuestion(candidate)) {
            generatedPrompt = candidate;
          }
        } catch (err: unknown) {
          console.error('[Edge Function Error]', err);
          return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (!isUsableQuestion(generatedPrompt)) {
          generatedPrompt = buildDeterministicMemoryQuestion(memoryContext);
          console.warn("[eval-interview] using deterministic memory fallback question");
        }
      }

      // 2. Jeśli wygenerowaliśmy ustrukturyzowane pytanie aktywnego uczenia, zapisz je do oracle_clarification_requests
      if (activeLearningPrompt && proposedMemoryStr) {
        const { error: insertErr } = await supabase
          .from("oracle_clarification_requests")
          .insert({
            user_id: userId,
            question: generatedPrompt,
            response_type: "confirm",
            options: [
              { id: "yes", label: "Tak", value: "yes" },
              { id: "no", label: "Nie", value: "no" }
            ],
            dedupe_key: activeLearningDedupeKey,
            proposed_memory: proposedMemoryStr,
            confidence: 0.5,
            status: "pending"
          });

        if (insertErr) {
          console.error("[eval-interview] Failed to insert active learning clarification request:", insertErr.message);
        } else {
          console.log(`[eval-interview] Created clarification request for ${activeLearningType}`);
          
          // Jeśli to był wiki review item, oznacz go jako resolved
          if (activeLearningType === "wiki_review") {
            await supabase
              .from("vanguard_wiki_review_items")
              .update({ status: "resolved" })
              .eq("id", activeLearningItemId);
          }
        }
      }

      // 3. Wyślij do Telegrama i zapisz do streamu
      const telegramMsg = `🎙️ Pytanie pogłębiające\n\n${generatedPrompt}\n\nOdpowiedz głosem lub tekstem.`;
      if (chatId && telegramToken) {
        const sendResult = await sendMessageParsed(telegramToken, chatId, telegramMsg);
        if (!sendResult.ok) {
          throw new Error(`Telegram send failed: ${sendResult.description}`);
        }
      }

      const topicTag = activeLearningType === "wiki_review" ? "wiki_verification"
        : activeLearningType === "stale_link" ? "stale_verification"
        : /sen|śpi|spanie|nocn|sleep/i.test(generatedPrompt) ? "sleep"
        : /trening|siłown|sport|workout|ćwicz/i.test(generatedPrompt) ? "training"
        : /jedzen|posiłek|kalorii|białk|dieta|jedzeni/i.test(generatedPrompt) ? "nutrition"
        : /relacj|przyjacie|znajom|spotkan/i.test(generatedPrompt) ? "social"
        : /praca|projekt|kariera|biznes/i.test(generatedPrompt) ? "work"
        : "other";

      await supabase.from("vanguard_stream").insert({
        user_id: userId,
        source: "eval_interview",
        content: `[PYTANIE POGŁĘBIAJĘCE]: ${generatedPrompt}`,
        metadata: { 
          generated: true, 
          sent_at: now.toISOString(), 
          topic_tag: topicTag,
          active_learning_type: activeLearningType || null,
          active_learning_item_id: activeLearningItemId || null
        },
      }).throwOnError();

      console.log("[eval-interview] sent generated deepening question");
      return new Response(
        JSON.stringify({ success: true, generated: true, prompt_sent: generatedPrompt, active_learning_type: activeLearningType }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Exclude questions asked in the last 14 days
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentlyAsked } = await supabase
      .from("vanguard_stream")
      .select("metadata")
      .eq("user_id", userId)
      .eq("source", "eval_interview")
      .gte("created_at", fourteenDaysAgo);

    const recentQuestionIds = new Set(
      (recentlyAsked || [])
        .map((r: any) => r.metadata?.eval_question_id)
        .filter(Boolean),
    );

    let eligibleQuestions = resolvedFailingResults!.filter(
      (q: any) => !recentQuestionIds.has(q.question_id),
    );

    if (eligibleQuestions.length === 0 && manual) {
      eligibleQuestions = resolvedFailingResults!;
    }

    if (eligibleQuestions.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "All failing questions asked recently (< 14d)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pick the worst-scoring eligible question
    const chosen = eligibleQuestions[0] as any;

    // Rephrase the eval question into a natural interview prompt (in Polish)
    let interviewPrompt = chosen.question;
    try {
      const reformulationResult = await deepseekChat({
        apiKey: deepseekApiKey,
        model: "deepseek-v4-flash",
        maxTokens: 120,
        temperature: 0.3,
        timeoutMs: 6000,
        messages: [
          {
            role: "system",
            content: `Przekształć pytanie ewaluacyjne systemu w naturalne pytanie-prośbę do użytkownika (Jakuba), które zachęci go do opowiedzenia o tym temacie głosem. 
Zasady:
- Max 2 zdania
- Naturalny ton, jakbyś prosił przyjaciela o opowieść
- Zacznij od "Opowiedz mi..." lub "Powiedz mi więcej o..." lub "Jak było z..."
- Nie zdradzaj że to pytanie testowe
- Po polsku`,
          },
          {
            role: "user",
            content: chosen.question,
          },
        ],
      });
      if (reformulationResult.content && reformulationResult.content.length > 10) {
        interviewPrompt = reformulationResult.content.trim();
      }
    } catch (reformErr) {
      console.warn("[eval-interview] reformulation failed (using original):", reformErr);
    }

    // Build the Telegram message
    const categoryLabel = chosen.category === "fact_recall"
      ? "przypomnienie faktów"
      : "łączenie wątków";
    const telegramMsg = `🎙️ Wywiad — ${categoryLabel}\n\n${interviewPrompt}\n\nOdpowiedz głosem lub tekstem — informacja trafi do Twojej pamięci.`;

    // Insert to stream BEFORE sending Telegram — if insert fails, abort (prevents spam on retry)
    const { error: streamErr } = await supabase.from("vanguard_stream").insert({
      user_id: userId,
      source: "eval_interview",
      content: `[WYWIAD WYSŁANY]: ${interviewPrompt}`,
      metadata: {
        eval_question_id: chosen.question_id,
        eval_category: chosen.category,
        eval_run_id: latestRun.id,
        original_question: chosen.question,
        sent_at: now.toISOString(),
      },
    });

    if (streamErr) {
      throw new Error(`[eval-interview] stream insert failed — aborting Telegram send: ${streamErr.message}`);
    }

    if (chatId && telegramToken) {
      const sendResult = await sendMessageParsed(telegramToken, chatId, telegramMsg);
      if (!sendResult.ok) {
        throw new Error(`Telegram send failed: ${sendResult.description}`);
      }
    }

    console.log(
      `[eval-interview] sent question_id=${chosen.question_id} category=${chosen.category} score=${chosen.score}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        question_id: chosen.question_id,
        category: chosen.category,
        score: chosen.score,
        prompt_sent: interviewPrompt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[eval-interview] fatal error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
