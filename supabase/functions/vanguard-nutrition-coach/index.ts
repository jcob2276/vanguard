/**
 * @function vanguard-nutrition-coach
 * @trigger pg_cron `0 6 * * *` UTC (08:00 Warsaw) / manual
 * @role Trener żywieniowy: oblicza rzeczywiste zapotrzebowanie (TDEE), ustala cele i wysyła codzienne podsumowanie na Telegram.
 * @reads nutrition_profile, nutrition_targets, body_metrics, daily_nutrition, oura_daily_summary, strava_activities_clean, workout_sessions, medical_lab_results, medical_documents, body_composition_measurements
 * @writes nutrition_targets
 * @calls deepseek-chat, api.telegram.org (poprzez send.ts)
 * @consumer Powiadomienia Telegram i cele w zakładce diety w aplikacji
 * @status active
 */
import { serveJson } from "../_shared/http.ts";
import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";
import { LLM_TASKS } from "../_shared/llm/tasks.ts";
import { getVanguardUserId } from "../_shared/constants.ts";
import { sendMessage } from "../_shared/telegram.ts";
import { getWarsawDateString } from "../_shared/time.ts";
import { fetchNutritionData, computeNutritionSignals } from "./nutritionCompute.ts";

function buildPushMessage(date: string, s: any, verdict: any): string {
  const t = s.today, e = s.energy, b = s.body;
  const L: string[] = [];
  L.push(`🍽️ Cel na dziś — ${date}`, "");
  if (t.intake_so_far != null && t.intake_so_far > 0) { const rem = t.remaining_kcal; L.push(`🎯 Cel dnia ${t.target_kcal} kcal · zjedzone ${Math.round(t.intake_so_far)} · ${rem >= 0 ? `zostało ${rem}` : `przekroczone o ${Math.abs(rem)}`}`); L.push(`🥩 Białko: zostało ${t.remaining_protein} g (floor ${t.protein_floor_g})`); }
  else { L.push(`🎯 Target: ${t.target_kcal} kcal (deficyt ${t.deficit_kcal})`); L.push(`🥩 Białko: min ${t.protein_floor_g} g`); }
  L.push(`⚖️ Maintenance ~${e.est_maintenance} kcal · trend ${b.weight_trend_kg_per_week} kg/tydz`);
  if (e.underlog_gap_kcal > 150) L.push(`📉 Niedolog ~${e.underlog_gap_kcal} kcal/dzień`);
  const f = s.forecast;
  if (f?.days_to_goal_est != null) L.push(`📅 Cel BF za ~${f.days_to_goal_est}d`);
  if (f?.adaptive_correction_kcal) L.push(`🔧 Adaptive: ${f.adaptive_correction_kcal > 0 ? '-' : '+'}${Math.abs(f.adaptive_correction_kcal)} kcal`);
  if (verdict?.today_focus) { L.push("", `👉 ${verdict.today_focus}`); }
  if (Array.isArray(verdict?.flags) && verdict.flags.length) { L.push(""); for (const fl of verdict.flags) L.push(`⚠️ ${fl}`); }
  if (Array.isArray(verdict?.food_suggestions) && verdict.food_suggestions.length) { L.push("", "🍴 Propozycje:"); for (const fl of verdict.food_suggestions) L.push(`• ${fl}`); }
  return L.join("\n");
}

Deno.serve(serveJson(async (req, ctx) => {
  const { supabase } = ctx;
  const body = await req.clone().json().catch(() => ({}));
  const userId = ctx.userId || getVanguardUserId();
  const notify = body.notify === true;
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";
  const today = body.date || getWarsawDateString(new Date());

  const data = await fetchNutritionData(supabase, userId, today);
  const { signals, forecast30, forecast60, forecast90, daysToGoalEst, estMaintenance, targetKcal, proteinFloor, deficitPerDay, adaptiveCorrectionKcal, weightTrendPerWeek, underlogGap: underlogGap, avgTdeeOura, avgIntake } = computeNutritionSignals(data);

  let verdict: Record<string, unknown> | null = null;
  let verdictError: string | null = apiKey ? null : "no_deepseek_key";
  if (apiKey) {
    try {
      const SYSTEM = `Jesteś trenerem żywieniowym maratończyka. Masz NAJDOKŁADNIEJSZE dane: spalanie Oura, makra, trend wagi, sen, trening.
Zasady: Prawdziwe maintenance > wzór. Deficyt ŁAGODNY. Białko to floor. Sen < 7h i niski błonnik to hamulce. forecast.* to projekcja CURRENT trendu. Konkretne polskie produkty. Mówisz po polsku, liczbami.`;
      const USER = `DANE:\n${JSON.stringify(signals, null, 2)}\n\nZwróć JSON: {"summary":"...","trajectory":"on_track|behind|ahead","trajectory_note":"...","forecast_note":"...","today_focus":"...","flags":["..."],"protein_note":"...","food_suggestions":["..."]}`;
      const res = await deepseekChat({
        apiKey,
        ...LLM_TASKS.structured,
        temperature: 0.3,
        maxTokens: 2500,
        timeoutMs: 40000,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: USER }]
      });
      verdict = parseJsonFromContent(res.content);
      if (!verdict) verdictError = `parse_failed len=${res.content.length}`;
    } catch (e) { verdictError = (e as Error).message; console.error("[nutrition-coach] deepseek failed:", verdictError); }
  }

  const { error: upErr } = await supabase.from("nutrition_targets").upsert({
    user_id: userId, date: today, est_maintenance_kcal: estMaintenance, target_kcal: targetKcal,
    protein_floor_g: proteinFloor, deficit_kcal: deficitPerDay, weight_trend_kg_per_week: weightTrendPerWeek,
    underlog_gap_kcal: underlogGap, avg_tdee_oura: avgTdeeOura, avg_intake_logged: avgIntake,
    forecast_30d_weight_kg: forecast30.weight, forecast_60d_weight_kg: forecast60.weight, forecast_90d_weight_kg: forecast90.weight,
    forecast_30d_bf_pct: forecast30.bf, forecast_60d_bf_pct: forecast60.bf, forecast_90d_bf_pct: forecast90.bf,
    days_to_goal_est: daysToGoalEst, adaptive_correction_kcal: adaptiveCorrectionKcal, inputs: signals, verdict,
  }, { onConflict: "user_id,date" });
  if (upErr) console.error("[nutrition-coach] upsert error:", upErr.message);

  let notified = false;
  if (notify) { const tgToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? ""; const tgChat = parseInt(Deno.env.get("TELEGRAM_CHAT_ID") ?? "0"); if (tgToken && tgChat) { try { const res = await sendMessage(tgToken, tgChat, buildPushMessage(today, signals, verdict)); notified = res.ok; } catch (e) { console.error("[nutrition-coach] telegram failed:", (e as Error).message); } } }

  return { success: !upErr, date: today, signals, verdict, verdictError, notified, persistError: upErr?.message ?? null };
}));
