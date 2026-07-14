/**
 * @function vanguard-eval-interview
 * @trigger pg_cron Mon-Fri `0 10 * * 1-5` UTC (12:00 Warsaw) / manual
 * @role Interaktywny wywiad ("Wywiad"): zadaje na Telegramie jedno pytanie mające uzupełnić luki w grafie wiedzy.
 * @reads vanguard_eval_results, vanguard_eval_runs, vanguard_stream, daily_reconciliations, vanguard_wiki_review_items, vanguard_entity_links, vanguard_curiosity_queue, vanguard_behavioral_patterns, vanguard_wiki_pages, confirmed_friction_events, oura_daily_summary, oracle_clarification_requests
 * @writes vanguard_eval_results, vanguard_stream, oracle_clarification_requests, vanguard_wiki_review_items
 * @calls deepseek-v4-flash, api.telegram.org (poprzez send.ts)
 * @consumer Czat z botem na Telegramie (pytanie i odpowiedź)
 * @status active
 */
import { serveJson } from "../_shared/http.ts";
import { getVanguardUserId } from "../_shared/constants.ts";
import { deepseekChat } from "../_shared/deepseek.ts";
import { LLM_TASKS } from "../_shared/llm/tasks.ts";
import { sendMessageParsed } from "../_shared/telegram.ts";
import { getStreamBySource, insertStreamRecord } from "../_shared/repos/streamRepo.ts";
import { isUsableQuestion, buildDeterministicMemoryQuestion, generateActiveLearningQuestion, generateDeepeningQuestion } from "./questionGenerator.ts";
import { checkInterviewCooldown, fetchActiveLearningSources, fetchFailingEvalQuestions, fetchDeepeningContext } from "./interviewRepo.ts";

const TARGET_CATEGORIES = ["fact_recall", "relation_reasoning"];

Deno.serve(serveJson(async (req, ctx) => {
  const supabase = ctx.supabase;
  let manual = false;
  if (req.method === "POST") {
    const payload = await req.clone().json().catch(() => ({}));
    manual = payload?.manual === true;
  }

  const userId = getVanguardUserId();
  const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const chatId = parseInt(Deno.env.get("TELEGRAM_CHAT_ID") ?? "0");
  const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY") ?? "";

  // Guard: skip Saturday
  const now = new Date();
  const isoDay = now.toLocaleDateString("en-US", { timeZone: "Europe/Warsaw", weekday: "long" });
  if (isoDay === "Saturday" && !manual) {
    return { skipped: true, reason: "Saturday — saturday_checkin handles this" };
  }

  // Guard: skip if previous question unanswered < 20h ago
  const twentyHoursAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();
  const { hasCooldown } = await checkInterviewCooldown(supabase, userId, twentyHoursAgo);
  if (hasCooldown && !manual) {
    return { skipped: true, reason: "Previous interview question still unanswered" };
  }

  // Fetch active learning sources
  const { wikiReviewItems, staleLinks } = await fetchActiveLearningSources(supabase, userId);

  let latestRun: any = null;
  let resolvedFailingResults: any[] = [];
  let useGeneratedQuestion = false;

  const hasActiveLearning = wikiReviewItems.length > 0 || staleLinks.length > 0;
  if (hasActiveLearning) {
    useGeneratedQuestion = true;
  } else {
    // Find most recent eval run and failing questions
    const { latestRun: runData, failingResults } = await fetchFailingEvalQuestions(supabase, userId, TARGET_CATEGORIES);
    latestRun = runData;
    resolvedFailingResults = failingResults;
    if (resolvedFailingResults.length === 0) {
      useGeneratedQuestion = true;
    }
  }

  // ── GENERATED DEEPENING QUESTION PATH ──────────────────────────────────
  if (useGeneratedQuestion) {
    let generatedPrompt = "";
    let activeLearningType = "";
    let activeLearningItemId = "";
    let activeLearningDedupeKey = "";
    let proposedMemoryStr = "";

    if (wikiReviewItems.length > 0) {
      const item = wikiReviewItems[0];
      activeLearningType = "wiki_review";
      activeLearningItemId = item.id;
      activeLearningDedupeKey = `wiki_review_${item.id}`;
      const result = await generateActiveLearningQuestion(deepseekApiKey, userId, "wiki_review", item);
      if (result) {
        generatedPrompt = result.question;
        proposedMemoryStr = JSON.stringify(result.proposed_memory);
      }
    } else if (staleLinks.length > 0) {
      const link = staleLinks[0];
      activeLearningType = "stale_link";
      activeLearningItemId = link.id;
      activeLearningDedupeKey = `stale_link_${link.id}`;
      const result = await generateActiveLearningQuestion(deepseekApiKey, userId, "stale_link", link);
      if (result) {
        generatedPrompt = result.question;
        proposedMemoryStr = JSON.stringify(result.proposed_memory);
      }
    }

    // Fallback to deepening question from memory context
    if (!isUsableQuestion(generatedPrompt)) {
      const cut72h = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
      const cut30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const deepeningData = await fetchDeepeningContext(supabase, userId, cut72h, cut30d, now);

      const memoryContext = {
        instruction: "Select one high-information-gain question for the user. Do not quote long source text. Do not force unrelated recent topics together.",
        pending_curiosity: deepeningData.curiosity,
        behavioral_patterns: deepeningData.patterns,
        wiki_pages: deepeningData.wikiPages,
        graph_edges: deepeningData.graphEdges,
        friction_events: deepeningData.frictionEvents,
        recent_stream_72h: deepeningData.recentStream,
        oura_sleep_last_7d: deepeningData.ouraSleepSummary,
        recently_asked_topic_tags: deepeningData.recentTopicTags,
      };

      const deepened = await generateDeepeningQuestion(deepseekApiKey, userId, memoryContext);
      if (deepened) {
        generatedPrompt = deepened;
      }
    }

    if (!isUsableQuestion(generatedPrompt)) {
      // Final fallback: build from memory context deterministically
      const cut72h = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
      const cut30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const deepeningData = await fetchDeepeningContext(supabase, userId, cut72h, cut30d, now);

      const fallbackCtx = {
        pending_curiosity: deepeningData.curiosity,
        behavioral_patterns: deepeningData.patterns,
        wiki_pages: deepeningData.wikiPages,
        graph_edges: deepeningData.graphEdges,
        friction_events: deepeningData.frictionEvents,
      };
      generatedPrompt = buildDeterministicMemoryQuestion(fallbackCtx);
      console.warn("[eval-interview] using deterministic memory fallback question");
    }

    // Save active learning clarification request
    if (activeLearningType && proposedMemoryStr) {
      const { error: insertErr } = await supabase.from("oracle_clarification_requests").insert({
        user_id: userId,
        question: generatedPrompt,
        response_type: "confirm",
        options: [
          { id: "yes", label: "Tak", value: "yes" },
          { id: "no", label: "Nie", value: "no" },
        ],
        dedupe_key: activeLearningDedupeKey,
        proposed_memory: proposedMemoryStr,
        confidence: 0.5,
        status: "pending",
      });

      if (insertErr) {
        console.error("[eval-interview] Failed to insert active learning clarification request:", insertErr.message);
      } else {
        console.log(`[eval-interview] Created clarification request for ${activeLearningType}`);
        if (activeLearningType === "wiki_review") {
          await supabase.from("vanguard_wiki_review_items").update({ status: "resolved" }).eq("id", activeLearningItemId);
        }
      }
    }

    // Send to Telegram
    const telegramMsg = `🎙️ Pytanie pogłębiające\n\n${generatedPrompt}\n\nOdpowiedz głosem lub tekstem.`;
    if (chatId && telegramToken) {
      const sendResult = await sendMessageParsed(telegramToken, chatId, telegramMsg);
      if (!sendResult.ok) {
        throw new Error(`Telegram send failed: ${sendResult.description}`);
      }
    }

    // Save to stream
    const topicTag =
      activeLearningType === "wiki_review"
        ? "wiki_verification"
        : activeLearningType === "stale_link"
        ? "stale_verification"
        : /sen|śpi|spanie|nocn|sleep/i.test(generatedPrompt)
        ? "sleep"
        : /trening|siłown|sport|workout|ćwicz/i.test(generatedPrompt)
        ? "training"
        : /jedzen|posiłek|kalorii|białk|dieta|jedzeni/i.test(generatedPrompt)
        ? "nutrition"
        : /relacj|przyjacie|znajom|spotkan/i.test(generatedPrompt)
        ? "social"
        : /praca|projekt|kariera|biznes/i.test(generatedPrompt)
        ? "work"
        : "other";

    await insertStreamRecord(supabase, {
      user_id: userId,
      source: "eval_interview",
      content: `[PYTANIE POGŁĘBIAJĘCE]: ${generatedPrompt}`,
      metadata: {
        generated: true,
        sent_at: now.toISOString(),
        topic_tag: topicTag,
        active_learning_type: activeLearningType || null,
        active_learning_item_id: activeLearningItemId || null,
      },
    });

    console.log("[eval-interview] sent generated deepening question");
    return { success: true, generated: true, prompt_sent: generatedPrompt, active_learning_type: activeLearningType };
  }

  // ── EVAL QUESTION REPHRASE + SEND ──────────────────────────────────────
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const recentlyAsked = await getStreamBySource(supabase, userId, "eval_interview", { from: fourteenDaysAgo });
  const recentQuestionIds = new Set((recentlyAsked || []).map((r: any) => r.metadata?.eval_question_id).filter(Boolean));

  let eligibleQuestions = resolvedFailingResults.filter((q: any) => !recentQuestionIds.has(q.question_id));
  if (eligibleQuestions.length === 0 && manual) {
    eligibleQuestions = resolvedFailingResults;
  }
  if (eligibleQuestions.length === 0) {
    return { skipped: true, reason: "All failing questions asked recently (< 14d)" };
  }

  const chosen = eligibleQuestions[0];
  let interviewPrompt = chosen.question;
  try {
    const reformulationResult = await deepseekChat({
      apiKey: deepseekApiKey,
      ...LLM_TASKS.synthesis,
      maxTokens: 120,
      temperature: 0.3,
      timeoutMs: 6000,
      messages: [
        {
          role: "system",
          content: `Przekształć pytanie ewaluacyjne systemu w naturalne pytanie-prośbę do użytkownika (Jakuba), które zachęci go do opowiedzenia o tym temacie głosem. Zasady: Max 2 zdania, naturalny ton, zacznij od "Opowiedz mi..." lub "Powiedz mi więcej o..." lub "Jak było z...", nie zdradzaj że to pytanie testowe, po polsku`,
        },
        { role: "user", content: chosen.question },
      ],
    });
    if (reformulationResult.content && reformulationResult.content.length > 10) {
      interviewPrompt = reformulationResult.content.trim();
    }
  } catch (reformErr) {
    console.warn("[eval-interview] reformulation failed (using original):", reformErr);
  }

  const categoryLabel = chosen.category === "fact_recall" ? "przypomnienie faktów" : "łączenie wątków";
  const telegramMsg = `🎙️ Wywiad — ${categoryLabel}\n\n${interviewPrompt}\n\nOdpowiedz głosem lub tekstem — informacja trafi do Twojej pamięci.`;

  try {
    await insertStreamRecord(supabase, {
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
  } catch (e: any) {
    throw new Error(`[eval-interview] stream insert failed — aborting Telegram send: ${e.message}`);
  }

  if (chatId && telegramToken) {
    const sendResult = await sendMessageParsed(telegramToken, chatId, telegramMsg);
    if (!sendResult.ok) {
      throw new Error(`Telegram send failed: ${sendResult.description}`);
    }
  }

  console.log(`[eval-interview] sent question_id=${chosen.question_id} category=${chosen.category} score=${chosen.score}`);
  return { success: true, question_id: chosen.question_id, category: chosen.category, score: chosen.score, prompt_sent: interviewPrompt };
}, { auth: "service" }));
