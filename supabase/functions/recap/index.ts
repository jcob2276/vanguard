/**
 * @function recap
 * @trigger HTTP POST / manual / cron
 * @role Router dla podsumowań (recap): wywołuje daily reconciliation, weekly synthesis lub weekly recap.
 * @reads daily_reconciliations, vanguard_stream, friction_events, vanguard_daily_aggregates, vanguard_curiosity_queue, daily_wins, oura_daily_summary, daily_nutrition, nutrition_targets, strava_activities, habit_logs, todo_items, vanguard_links, todo_sections, projects, goal_kpis, kpi_entries, vanguard_behavioral_patterns, claims, sprint_goals, monthly_reviews, weekly_reviews
 * @writes daily_reconciliations, vanguard_stream, friction_events, monthly_reviews, weekly_reviews
 * @calls api.telegram.org (poprzez send.ts), deepseek-chat
 * @consumer Powiadomienia Telegram z podsumowaniem dnia/tygodnia
 * @status active
 */
import { corsHeaders, resolveUserScope } from "../_shared/supabase.ts";
import { runDailyReconciliation } from "./daily.ts";
import { runWeeklySynthesis } from "./weekly-synthesis.ts";
import { runWeeklyRecap } from "./weekly-recap.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let type = url.searchParams.get("type") || url.searchParams.get("action");

    let body: any = {};
    if (req.method === "POST") {
      const text = await req.clone().text().catch(() => "");
      try {
        if (text) body = JSON.parse(text);
      } catch (_) {}
    }

    const requestedUserId = url.searchParams.get("userId") || body.userId;
    await resolveUserScope(req, requestedUserId ?? null);

    if (!type && body) {
      type = body.type || body.action;
    }

    if (!type) {
      return new Response(JSON.stringify({ error: "Missing type or action parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (type) {
      case "daily":
      case "reflection":
        return await runDailyReconciliation(req);
      case "weekly-synthesis":
      case "synthesis":
        return await runWeeklySynthesis(req);
      case "weekly-recap":
      case "recap":
        return await runWeeklyRecap(req);
      default:
        return new Response(JSON.stringify({ error: `Unknown type: ${type}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err: any) {
    console.error("[recap router] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
