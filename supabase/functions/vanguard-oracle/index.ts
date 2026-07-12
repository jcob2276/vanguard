/**
 * @function vanguard-oracle
 * @trigger HTTP POST / Wywoływane z Telegrama lub frontendowego czatu Wyroczni
 * @role Silnik Wyroczni: obsługuje czat z RAG, generuje odpowiedzi, wnioskuje fakty i decyduje o akcjach.
 * @reads vanguard_oracle_runs, vanguard_stream, entities, claims, daily_strain, medical_lab_results, system_proposals, todo_items, projects, vanguard_notes, oracle_recommendations, oracle_clarification_requests, oracle_pending_actions, knowledge_insight_cards, daily_reconciliations, user_fundament, vanguard_preferences, oura_daily_summary, daily_nutrition, daily_food_entries, daily_wins, friction_events, vanguard_wiki_pages, vanguard_iron_rules
 * @writes vanguard_oracle_runs, audit_events, knowledge_insight_cards, oracle_clarification_requests, oracle_pending_actions, oracle_recommendations
 * @calls deepseek-v4-flash (default), deepseek-reasoner (deep mode `!!`), text-embedding-3-small (RAG)
 * @consumer Czat Wyroczni w Telegramie oraz w aplikacji webowej
 * @status active
 *
 * ⚠️  This file is intentionally thin — a Deno.serve wrapper only.
 *     All Oracle query-processing logic lives in ./oracle/core.ts.
 *     If you need to call Oracle logic from another edge function, import
 *     runOracleQuery from ./oracle/core.ts, NOT from this file.
 */
import { resolveUserScope } from "../_shared/supabase.ts";
import { serveJson } from "../_shared/http.ts";
import { handleSearch } from "./handlers/search.ts";
import { handleGoalCreate } from "./handlers/goalCreate.ts";
import { handleTaskBreakdown } from "./handlers/taskBreakdown.ts";
import { runOracleQuery } from "./oracle/core.ts";

Deno.serve(serveJson(async (req, ctx) => {
  try {
    const body = await req.clone().json().catch(() => ({}));
    const db = ctx.supabase;

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || body.action;

    if (action) {
      if (action === "search") return await handleSearch(req, body, db);
      if (action === "goal-create") return await handleGoalCreate(req, body);
      if (action === "task-breakdown") return await handleTaskBreakdown(req, body);
      throw new Error(`Unknown action: ${action}`);
    }

    const { userId } = await resolveUserScope(req, body.user_id ?? null);
    if (!userId) throw new Error("Missing user_id");

    return await runOracleQuery(db, userId, body, req);
  } catch (error: unknown) {
    console.error("[oracle] fatal:", error);
    throw error;
  }
}, { auth: "none" }));
