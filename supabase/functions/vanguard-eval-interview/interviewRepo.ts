import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ActiveLearningSources {
  wikiReviewItems: any[];
  staleLinks: any[];
}

export interface FailingQuestionsContext {
  latestRun: any | null;
  failingResults: any[];
}

export interface DeepeningContext {
  curiosity: any[];
  patterns: any[];
  wikiPages: any[];
  graphEdges: any[];
  frictionEvents: any[];
  recentStream: any[];
  ouraSleepSummary: string[];
  recentTopicTags: string[];
}

/** Checks if the user is in a cooldown period since the last interview. */
export async function checkInterviewCooldown(
  supabase: SupabaseClient,
  userId: string,
  twentyHoursAgo: string,
): Promise<{ hasCooldown: boolean; recentInterview: any | null }> {
  const { data: recentInterviewRows } = await supabase
    .from("vanguard_stream")
    .select("id, created_at, content, metadata")
    .eq("user_id", userId)
    .eq("source", "eval_interview")
    .gte("created_at", twentyHoursAgo)
    .order("created_at", { ascending: false })
    .limit(1);

  const recentInterview = recentInterviewRows?.[0] ?? null;
  if (!recentInterview) {
    return { hasCooldown: false, recentInterview: null };
  }

  const { data: userReply } = await supabase
    .from("vanguard_stream")
    .select("id")
    .eq("user_id", userId)
    .neq("source", "eval_interview")
    .neq("source", "oracle_chat")
    .gt("created_at", recentInterview.created_at)
    .limit(1)
    .maybeSingle();

  return { hasCooldown: !userReply, recentInterview };
}

/** Fetches active learning items (wiki reviews and stale links). */
export async function fetchActiveLearningSources(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveLearningSources> {
  const [wikiReviewRes, staleLinksRes] = await Promise.all([
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
      .limit(1),
  ]);

  return {
    wikiReviewItems: wikiReviewRes.data || [],
    staleLinks: staleLinksRes.data || [],
  };
}

/** Fetches recent failing evaluation questions for the user. */
export async function fetchFailingEvalQuestions(
  supabase: SupabaseClient,
  userId: string,
  targetCategories: string[],
): Promise<FailingQuestionsContext> {
  const { data: latestRun, error: runErr } = await supabase
    .from("vanguard_eval_runs")
    .select("id, summary, completed_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runErr || !latestRun) {
    return { latestRun: null, failingResults: [] };
  }

  const { data: failingResults } = await supabase
    .from("vanguard_eval_results")
    .select("question_id, question, category, score, judge_notes")
    .eq("run_id", latestRun.id)
    .eq("passed", false)
    .in("category", targetCategories)
    .order("score", { ascending: true })
    .limit(20);

  let results = failingResults || [];
  if (results.length === 0) {
    const { data: allFailing } = await supabase
      .from("vanguard_eval_results")
      .select("question_id, question, category, score, judge_notes")
      .eq("run_id", latestRun.id)
      .eq("passed", false)
      .order("score", { ascending: true })
      .limit(20);
    results = allFailing || [];
  }

  return { latestRun, failingResults: results };
}

/** Fetches full world state and historical aggregates for generating deepening questions. */
export async function fetchDeepeningContext(
  supabase: SupabaseClient,
  userId: string,
  cut72h: string,
  cut30d: string,
  now: Date,
): Promise<DeepeningContext> {
  const [
    curiosityRes,
    patternsRes,
    wikiRes,
    graphRes,
    frictionRes,
    streamRes,
    ouraRes,
    recentTopicsRes,
  ] = await Promise.all([
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
      .eq("status", "active")
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
    .flatMap((r: any) => [r.metadata?.topic_tag, r.metadata?.friction_type_focus])
    .filter(Boolean);

  const ouraRows = ouraRes.data || [];
  const ouraSleepSummary = ouraRows.length > 0
    ? ouraRows.map((r: any) => {
        const bedtime = r.sleep_start
          ? new Date(r.sleep_start).toLocaleTimeString("pl-PL", {
              timeZone: "Europe/Warsaw",
              hour: "2-digit",
              minute: "2-digit",
            })
          : null;
        return `${r.date}: pora zaśnięcia=${bedtime ?? "??"}, sen=${r.total_sleep_hours?.toFixed(1) ?? "?"}h, score=${r.sleep_score ?? "??"}`;
      })
    : [];

  return {
    curiosity: curiosityRes.data || [],
    patterns: patternsRes.data || [],
    wikiPages: wikiRes.data || [],
    graphEdges: graphRes.data || [],
    frictionEvents: frictionRes.data || [],
    recentStream: streamRes.data || [],
    ouraSleepSummary,
    recentTopicTags,
  };
}
