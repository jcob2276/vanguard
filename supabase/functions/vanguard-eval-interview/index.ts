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
import { sendMessage } from "../_shared/telegram.ts";

// Categories with worst eval performance — target these first
const TARGET_CATEGORIES = ["fact_recall", "relation_reasoning"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createServiceClient();
    const userId = getVanguardUserId();
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
    const chatId = parseInt(Deno.env.get("TELEGRAM_CHAT_ID") ?? "0");
    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY") ?? "";

    // Guard: skip Saturday (day 6 in Warsaw)
    const now = new Date();
    const dayOfWeek = parseInt(
      now.toLocaleDateString("en-US", { timeZone: "Europe/Warsaw", weekday: "numeric" })
    );
    // Saturday = 0 in some locales; safer: check ISO day
    const isoDay = now.toLocaleDateString("en-US", { timeZone: "Europe/Warsaw", weekday: "long" });
    if (isoDay === "Saturday") {
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

      if (!userReply) {
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

    if (failErr || !failingResults || failingResults.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No failing questions in target categories" }),
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

    const eligibleQuestions = failingResults.filter(
      (q: any) => !recentQuestionIds.has(q.question_id),
    );

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
    const telegramMsg = `🎙️ *Wywiad — ${categoryLabel}*\n\n${interviewPrompt}\n\n_Odpowiedz głosem lub tekstem — informacja trafi do Twojej pamięci._`;

    if (chatId && telegramToken) {
      await sendMessage(telegramToken, chatId, telegramMsg, { parseMode: "Markdown" });
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
