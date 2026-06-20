/**
 * vanguard-eval-interview — Daily eval-driven interview mode
 *
 * Picks one failing eval question per day and sends it as a natural
 * interview prompt to Telegram. User's voice/text reply goes through
 * the normal pipeline (stream → Architect), filling the exact knowledge
 * gaps detected by the eval runner.
 *
 * Trigger: pg_cron `0 10 * * 1-5` UTC (12:00 Warsaw, Mon–Fri only)
 * JWT: false (--no-verify-jwt on deploy)
 *
 * Safety:
 * - Skips Saturday (already has saturday_checkin)
 * - Skips if a previous interview question is still unanswered (< 20h old)
 * - Never repeats the same eval question within 14 days
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    return `Opowiedz mi, co jest prawdą, a co fałszem w tej hipotezie: ${hypothesis}. Jaki konkretny przykład z życia ją potwierdza albo obala?`;
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let manual = false;
    if (req.method === "POST") {
      try {
        const payload = await req.json();
        manual = payload?.manual === true;
      } catch (_) {}
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

    // Find the most recent eval run
    const { data: latestRun, error: runErr } = await supabase
      .from("vanguard_eval_runs")
      .select("id, summary, completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runErr || !latestRun) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No completed eval run found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get failing questions from target categories
    const { data: failingResults, error: failErr } = await supabase
      .from("vanguard_eval_results")
      .select("question_id, question, category, score, judge_notes")
      .eq("run_id", latestRun.id)
      .eq("passed", false)
      .in("category", TARGET_CATEGORIES)
      .order("score", { ascending: true }) // worst first
      .limit(20);

    let resolvedFailingResults = failingResults;
    let useGeneratedQuestion = false;

    if (failErr || !failingResults || failingResults.length === 0) {
      // Fall back to any failing question across all categories
      const { data: allFailing } = await supabase
        .from("vanguard_eval_results")
        .select("question_id, question, category, score, judge_notes")
        .eq("run_id", latestRun.id)
        .eq("passed", false)
        .order("score", { ascending: true })
        .limit(20);

      if (!allFailing || allFailing.length === 0) {
        // Everything passing — generate a deepening question from recent stream
        useGeneratedQuestion = true;
      } else {
        resolvedFailingResults = allFailing;
      }
    }

    // --- Generated deepening question path ---
    if (useGeneratedQuestion) {
      const cut72h = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
      const cut30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [curiosityRes, patternsRes, wikiRes, graphRes, frictionRes, streamRes] = await Promise.all([
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
      ]);

      const memoryContext = {
        instruction: "Select one high-information-gain question for the user. Do not quote long source text. Do not force unrelated recent topics together.",
        pending_curiosity: curiosityRes.data || [],
        behavioral_patterns: patternsRes.data || [],
        wiki_pages: wikiRes.data || [],
        graph_edges: graphRes.data || [],
        friction_events: frictionRes.data || [],
        recent_stream_72h: streamRes.data || [],
      };

      let generatedPrompt = "";
      try {
        const result = await deepseekChat({
          apiKey: deepseekApiKey,
          model: "deepseek-v4-flash",
          maxTokens: 150,
          temperature: 0.5,
          timeoutMs: 8000,
          messages: [
            {
              role: "system",
              content: `Jesteś selektorem pytań dla Vanguard OS.

Masz pamięć użytkownika: pending hypotheses, wzorce, wiki, graf, tarcia i świeży stream.
Wybierz JEDNO pytanie o najwyższej wartości informacyjnej dla pamięci systemu.

Zasady:
- Nie musisz pytać o ostatnie 24h.
- Nie łącz dwóch wątków tylko dlatego, że są obok siebie czasowo.
- Preferuj: lukę w grafie, needs_review, pending hypothesis, powtarzalny wzorzec z N, albo niejasną decyzję.
- Pytanie ma być naturalne, krótkie, konkretne, po polsku.
- Możesz dać jedno zdanie obserwacji, ale MUSISZ zakończyć jednym operacyjnym pytaniem ze znakiem "?".
- Nie cytuj długich fragmentów źródłowych.
- Max 2 zdania.
- Zacznij od "Opowiedz mi..." / "Powiedz mi..." / "Kiedy..." / "Co dokładnie...".
- Nie diagnozuj i nie psychoanalizuj.`,
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
      } catch (err) {
        console.warn("[eval-interview] deepening question generation failed:", err);
      }

      if (!isUsableQuestion(generatedPrompt)) {
        generatedPrompt = buildDeterministicMemoryQuestion(memoryContext);
        console.warn("[eval-interview] using deterministic memory fallback question");
      }

      const telegramMsg = `🎙️ Pytanie pogłębiające\n\n${generatedPrompt}\n\nOdpowiedz głosem lub tekstem.`;
      if (chatId && telegramToken) {
        const sendResult = await sendMessageParsed(telegramToken, chatId, telegramMsg);
        if (!sendResult.ok) {
          throw new Error(`Telegram send failed: ${sendResult.description}`);
        }
      }

      await supabase.from("vanguard_stream").insert({
        user_id: userId,
        source: "eval_interview",
        content: `[PYTANIE POGŁĘBIAJĄCE]: ${generatedPrompt}`,
        metadata: { generated: true, sent_at: now.toISOString() },
      });

      console.log("[eval-interview] sent generated deepening question");
      return new Response(
        JSON.stringify({ success: true, generated: true, prompt_sent: generatedPrompt }),
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

    if (chatId && telegramToken) {
      const sendResult = await sendMessageParsed(telegramToken, chatId, telegramMsg);
      if (!sendResult.ok) {
        throw new Error(`Telegram send failed: ${sendResult.description}`);
      }
    }

    // Record the sent interview prompt in stream for tracking
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
      console.error("[eval-interview] stream insert error:", streamErr);
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
