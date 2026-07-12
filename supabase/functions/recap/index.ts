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
import { resolveUserScope } from "../_shared/supabase.ts";
import { serveJson } from "../_shared/http.ts";
import { runDailyReconciliation } from "./daily.ts";
import { runWeeklySynthesis } from "./weekly-synthesis.ts";
import { runWeeklyRecap } from "./weekly-recap.ts";

Deno.serve(serveJson(async (req) => {
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
    throw new Error("Missing type or action parameter");
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
      throw new Error(`Unknown type: ${type}`);
  }
}, { auth: 'none' }));
