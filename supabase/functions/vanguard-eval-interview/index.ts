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
import { createServiceClient, corsHeaders } from "../_shared/supabase.ts";
import { requireServiceRole } from "../_shared/auth.ts";
import { getVanguardUserId } from "../_shared/constants.ts";
import { deepseekChat } from "../_shared/deepseek.ts";
import { sendMessageParsed } from "../_shared/telegram.ts";
import { getStreamBySource, insertStreamRecord } from "../_shared/repos/streamRepo.ts";
import { isUsableQuestion, buildDeterministicMemoryQuestion, generateActiveLearningQuestion, generateDeepeningQuestion } from "./questionGenerator.ts";

const TARGET_CATEGORIES = ["fact_recall", "relation_reasoning"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authError = requireServiceRole(req);
  if (authError) return authError;

  try {
    let manual = false;
    if (req.method === "POST") {
      try {
        const payload = await req.json();
        manual = payload?.manual === true;
      } catch (_: unknown) {
        console.error('[Edge Function Error]', _);
        return new Response(JSON.stringify({ error: _ instanceof Error ? _.message : String(_) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    const supabase = createServiceClient();
    const userId = getVanguardUserId();
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
    const chatId = parseInt(Deno.env.get("TELEGRAM_CHAT_ID") ?? "0");
    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY") ?? "";

    // Guard: skip Saturday
    const now = new Date();
    const isoDay = now.toLocaleDateString("en-US", { timeZone: "Europe/Warsaw", weekday: "long" });
    if (isoDay === "Saturday" && !manual) {
      return new Response(JSON.stringify({ skipped: true, reason: "Saturday — saturday_checkin handles this" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Guard: skip if previous question unanswered < 20h ago
    const twentyHoursAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();
    const recentInterviewRows = await getStreamBySource(supabase, userId, "eval_interview", { from: twentyHoursAgo, limit: 1 });
    const recentInterview = recentInterviewRows[0] ?? null;
    if (recentInterview) {
      const { data: userReply } = await supabase
        .from("vanguard_stream").select("id").eq("user_id", userId)
        .neq("source", "eval_interview").neq("source", "oracle_chat")
        .gt("created_at", recentInterview.created_at).limit(1).maybeSingle();
      if (!userReply && !manual) {
        return new Response(JSON.stringify({ skipped: true, reason: "Previous interview question still unanswered" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Fetch active learning sources and eval results
    const [{ data: wikiReviewItems }, { data: staleLinks }] = await Promise.all([
      supabase.from("vanguard_wiki_review_items").select("id, item_type, title, detail, severity")
        .eq("user_id", userId).eq("status", "open").order("severity", { ascending: false }).order("created_at", { ascending: false }).limit(1),
      supabase.from("vanguard_entity_links")
        .select("id, source_entity, relation, target_entity, source_type, target_type, confidence_score, fact_text")
        .eq("user_id", userId).eq("status", "active").eq("memory_type", "fact").lt("confidence_score", 0.7)
        .order("created_at", { ascending: true }).limit(1),
    ]);

    let latestRun: any = null;
    let resolvedFailingResults: any[] = [];
    let useGeneratedQuestion = false;

    const hasActiveLearning = (wikiReviewItems && wikiReviewItems.length > 0) || (staleLinks && staleLinks.length > 0);
    if (hasActiveLearning) {
      useGeneratedQuestion = true;
    } else {
      // Find most recent eval run and failing questions
      const { data: runData, error: runErr } = await supabase
        .from("vanguard_eval_runs").select("id, summary, completed_at")
        .eq("user_id", userId).eq("status", "completed").order("completed_at", { ascending: false }).limit(1).maybeSingle();
      latestRun = runData;

      if (latestRun && !runErr) {
        const { data: failingResults } = await supabase
          .from("vanguard_eval_results").select("question_id, question, category, score, judge_notes")
          .eq("run_id", latestRun.id).eq("passed", false).in("category", TARGET_CATEGORIES)
          .order("score", { ascending: true }).limit(20);
        resolvedFailingResults = failingResults || [];

        if (resolvedFailingResults.length === 0) {
          const { data: allFailing } = await supabase
            .from("vanguard_eval_results").select("question_id, question, category, score, judge_notes")
            .eq("run_id", latestRun.id).eq("passed", false).order("score", { ascending: true }).limit(20);
          resolvedFailingResults = allFailing || [];
        }
      }
      if (resolvedFailingResults.length === 0) useGeneratedQuestion = true;
    }

    // ── GENERATED DEEPENING QUESTION PATH ──────────────────────────────────
    if (useGeneratedQuestion) {
      let generatedPrompt = "";
      let activeLearningType = "";
      let activeLearningItemId = "";
      let activeLearningDedupeKey = "";
      let proposedMemoryStr = "";

      if (wikiReviewItems && wikiReviewItems.length > 0) {
        const item = wikiReviewItems[0];
        activeLearningType = "wiki_review";
        activeLearningItemId = item.id;
        activeLearningDedupeKey = `wiki_review_${item.id}`;
        const result = await generateActiveLearningQuestion(deepseekApiKey, userId, "wiki_review", item);
        if (result) { generatedPrompt = result.question; proposedMemoryStr = JSON.stringify(result.proposed_memory); }
      } else if (staleLinks && staleLinks.length > 0) {
        const link = staleLinks[0];
        activeLearningType = "stale_link";
        activeLearningItemId = link.id;
        activeLearningDedupeKey = `stale_link_${link.id}`;
        const result = await generateActiveLearningQuestion(deepseekApiKey, userId, "stale_link", link);
        if (result) { generatedPrompt = result.question; proposedMemoryStr = JSON.stringify(result.proposed_memory); }
      }

      // Fallback to deepening question from memory context
      if (!isUsableQuestion(generatedPrompt)) {
        const cut72h = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
        const cut30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const [curiosityRes, patternsRes, wikiRes, graphRes, frictionRes, streamRes, ouraRes, recentTopicsRes] = await Promise.all([
          supabase.from("vanguard_curiosity_queue").select("hypothesis, provocation, confidence_score, category, evidence_count, created_at").eq("user_id", userId).eq("status", "pending").order("confidence_score", { ascending: false }).limit(5),
          supabase.from("vanguard_behavioral_patterns").select("pattern_type, title, evidence_text, occurrence_count, confidence, status, last_seen").eq("user_id", userId).in("status", ["active", "candidate"]).order("confidence", { ascending: false }).limit(5),
          supabase.from("vanguard_wiki_pages").select("title, page_type, status, confidence, summary, tags, last_seen_at").eq("user_id", userId).in("status", ["active", "needs_review"]).order("last_seen_at", { ascending: false }).limit(8),
          supabase.from("vanguard_entity_links").select("source_entity, relation, target_entity, temporal_status, memory_type, confidence_score, evidence_count, last_seen, fact_text").eq("user_id", userId).eq("status", "active").order("evidence_count", { ascending: false }).limit(12),
          supabase.from("confirmed_friction_events").select("occurred_at, friction_type, declared_intention, actual_behavior, deviation, immediate_cost, confidence").eq("user_id", userId).gte("occurred_at", cut30d).order("occurred_at", { ascending: false }).limit(8),
          supabase.from("vanguard_stream").select("content, category, created_at").eq("user_id", userId).not("source", "eq", "eval_interview").not("source", "eq", "oracle_chat").gte("created_at", cut72h).order("created_at", { ascending: false }).limit(12),
          supabase.from("oura_daily_summary").select("date, sleep_start, sleep_end, total_sleep_hours, sleep_score, readiness_score").eq("user_id", userId).order("date", { ascending: false }).limit(7),
          supabase.from("vanguard_stream").select("metadata, content").eq("user_id", userId).eq("source", "eval_interview").gte("created_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()).limit(10),
        ]);

        const recentTopicTags: string[] = (recentTopicsRes.data || []).flatMap((r: any) => [r.metadata?.topic_tag, r.metadata?.friction_type_focus]).filter(Boolean);
        const ouraRows = ouraRes.data || [];
        const ouraSleepSummary = ouraRows.length > 0 ? ouraRows.map((r: any) => {
          const bedtime = r.sleep_start ? new Date(r.sleep_start).toLocaleTimeString("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" }) : null;
          return `${r.date}: pora zaśnięcia=${bedtime ?? "??"}, sen=${r.total_sleep_hours?.toFixed(1) ?? "??"}h, score=${r.sleep_score ?? "??"}`;
        }) : [];

        const memoryContext = {
          instruction: "Select one high-information-gain question for the user. Do not quote long source text. Do not force unrelated recent topics together.",
          pending_curiosity: curiosityRes.data || [], behavioral_patterns: patternsRes.data || [],
          wiki_pages: wikiRes.data || [], graph_edges: graphRes.data || [],
          friction_events: frictionRes.data || [], recent_stream_72h: streamRes.data || [],
          oura_sleep_last_7d: ouraSleepSummary, recently_asked_topic_tags: recentTopicTags,
        };

        const deepened = await generateDeepeningQuestion(deepseekApiKey, userId, memoryContext);
        if (deepened) generatedPrompt = deepened;
      }

      if (!isUsableQuestion(generatedPrompt)) {
        // Final fallback: build from memory context deterministically
        const cut72h = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
        const cut30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const [curiosityRes, patternsRes, wikiRes, graphRes, frictionRes] = await Promise.all([
          supabase.from("vanguard_curiosity_queue").select("hypothesis, provocation").eq("user_id", userId).eq("status", "pending").order("confidence_score", { ascending: false }).limit(5),
          supabase.from("vanguard_behavioral_patterns").select("pattern_type, title, evidence_text").eq("user_id", userId).in("status", ["active", "candidate"]).limit(5),
          supabase.from("vanguard_wiki_pages").select("title").eq("user_id", userId).in("status", ["active", "needs_review"]).limit(8),
          supabase.from("vanguard_entity_links").select("source_entity, target_entity").eq("user_id", userId).eq("status", "active").limit(12),
          supabase.from("confirmed_friction_events").select("friction_type").eq("user_id", userId).gte("occurred_at", cut30d).limit(8),
        ]);
        const fallbackCtx = {
          pending_curiosity: curiosityRes.data || [], behavioral_patterns: patternsRes.data || [],
          wiki_pages: wikiRes.data || [], graph_edges: graphRes.data || [], friction_events: frictionRes.data || [],
        };
        generatedPrompt = buildDeterministicMemoryQuestion(fallbackCtx);
        console.warn("[eval-interview] using deterministic memory fallback question");
      }

      // Save active learning clarification request
      if (activeLearningType && proposedMemoryStr) {
        const { error: insertErr } = await supabase.from("oracle_clarification_requests").insert({
          user_id: userId, question: generatedPrompt, response_type: "confirm",
          options: [{ id: "yes", label: "Tak", value: "yes" }, { id: "no", label: "Nie", value: "no" }],
          dedupe_key: activeLearningDedupeKey, proposed_memory: proposedMemoryStr, confidence: 0.5, status: "pending",
        });
        if (insertErr) console.error("[eval-interview] Failed to insert active learning clarification request:", insertErr.message);
        else {
          console.log(`[eval-interview] Created clarification request for ${activeLearningType}`);
          if (activeLearningType === "wiki_review") await supabase.from("vanguard_wiki_review_items").update({ status: "resolved" }).eq("id", activeLearningItemId);
        }
      }

      // Send to Telegram
      const telegramMsg = `🎙️ Pytanie pogłębiające\n\n${generatedPrompt}\n\nOdpowiedz głosem lub tekstem.`;
      if (chatId && telegramToken) {
        const sendResult = await sendMessageParsed(telegramToken, chatId, telegramMsg);
        if (!sendResult.ok) throw new Error(`Telegram send failed: ${sendResult.description}`);
      }

      // Save to stream
      const topicTag = activeLearningType === "wiki_review" ? "wiki_verification"
        : activeLearningType === "stale_link" ? "stale_verification"
        : /sen|śpi|spanie|nocn|sleep/i.test(generatedPrompt) ? "sleep"
        : /trening|siłown|sport|workout|ćwicz/i.test(generatedPrompt) ? "training"
        : /jedzen|posiłek|kalorii|białk|dieta|jedzeni/i.test(generatedPrompt) ? "nutrition"
        : /relacj|przyjacie|znajom|spotkan/i.test(generatedPrompt) ? "social"
        : /praca|projekt|kariera|biznes/i.test(generatedPrompt) ? "work" : "other";

      await insertStreamRecord(supabase, {
        user_id: userId, source: "eval_interview",
        content: `[PYTANIE POGŁĘBIAJĘCE]: ${generatedPrompt}`,
        metadata: { generated: true, sent_at: now.toISOString(), topic_tag: topicTag, active_learning_type: activeLearningType || null, active_learning_item_id: activeLearningItemId || null },
      });

      console.log("[eval-interview] sent generated deepening question");
      return new Response(JSON.stringify({ success: true, generated: true, prompt_sent: generatedPrompt, active_learning_type: activeLearningType }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── EVAL QUESTION REPHRASE + SEND ──────────────────────────────────────
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const recentlyAsked = await getStreamBySource(supabase, userId, "eval_interview", { from: fourteenDaysAgo });
    const recentQuestionIds = new Set((recentlyAsked || []).map((r: any) => r.metadata?.eval_question_id).filter(Boolean));

    let eligibleQuestions = resolvedFailingResults.filter((q: any) => !recentQuestionIds.has(q.question_id));
    if (eligibleQuestions.length === 0 && manual) eligibleQuestions = resolvedFailingResults;
    if (eligibleQuestions.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "All failing questions asked recently (< 14d)" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const chosen = eligibleQuestions[0];
    let interviewPrompt = chosen.question;
    try {
      const reformulationResult = await deepseekChat({
        apiKey: deepseekApiKey, model: "deepseek-v4-flash", maxTokens: 120, temperature: 0.3, timeoutMs: 6000,
        messages: [
          { role: "system", content: `Przekształć pytanie ewaluacyjne systemu w naturalne pytanie-prośbę do użytkownika (Jakuba), które zachęci go do opowiedzenia o tym temacie głosem. Zasady: Max 2 zdania, naturalny ton, zacznij od "Opowiedz mi..." lub "Powiedz mi więcej o..." lub "Jak było z...", nie zdradzaj że to pytanie testowe, po polsku` },
          { role: "user", content: chosen.question },
        ],
      });
      if (reformulationResult.content && reformulationResult.content.length > 10) interviewPrompt = reformulationResult.content.trim();
    } catch (reformErr) {
      console.warn("[eval-interview] reformulation failed (using original):", reformErr);
    }

    const categoryLabel = chosen.category === "fact_recall" ? "przypomnienie faktów" : "łączenie wątków";
    const telegramMsg = `🎙️ Wywiad — ${categoryLabel}\n\n${interviewPrompt}\n\nOdpowiedz głosem lub tekstem — informacja trafi do Twojej pamięci.`;

    try {
      await insertStreamRecord(supabase, {
        user_id: userId, source: "eval_interview",
        content: `[WYWIAD WYSŁANY]: ${interviewPrompt}`,
        metadata: { eval_question_id: chosen.question_id, eval_category: chosen.category, eval_run_id: latestRun.id, original_question: chosen.question, sent_at: now.toISOString() },
      });
    } catch (e: any) {
      throw new Error(`[eval-interview] stream insert failed — aborting Telegram send: ${e.message}`);
    }

    if (chatId && telegramToken) {
      const sendResult = await sendMessageParsed(telegramToken, chatId, telegramMsg);
      if (!sendResult.ok) throw new Error(`Telegram send failed: ${sendResult.description}`);
    }

    console.log(`[eval-interview] sent question_id=${chosen.question_id} category=${chosen.category} score=${chosen.score}`);
    return new Response(JSON.stringify({ success: true, question_id: chosen.question_id, category: chosen.category, score: chosen.score, prompt_sent: interviewPrompt }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[eval-interview] fatal error:", err);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
