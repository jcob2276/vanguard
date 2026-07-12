import { addDaysStr, getSprintInfoForDate, monthThemeSourceForWeek, mean, isVoiceEntry, avgBedtimeLabel } from "./helpers.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../_shared/database.types.ts";

const PILLAR_LABEL: Record<string, string> = { cialo: "Ciało", duch: "Duch", konto: "Konto" };

// Supabase query results — data is T[] | null, but complex selects don't always infer T.
// Using Record<string, unknown>[] instead of any[] to preserve runtime safety.
type Row = any;

export async function gatherWeekFacts(db: SupabaseClient<Database>, userId: string, weekStart: string) {
  const weekEnd = addDaysStr(weekStart, 6);

  const [
    winsRes, ouraRes, nutrRes, targetRes, runsRes, habitLogsRes,
    staleHighRes, linksRes, thisWeekStreamRes, sectionsRes, doneTasksRes, projectsRes,
    kpisRes, kpiEntriesRes, reconciliationsRes, behavioralPatternsRes, curiosityQueueRes,
    claimsRes,
  ] = await Promise.all([
    db.from("daily_wins").select("date, result, task_1, task_2, task_3, task_4, task_5, category_1, category_2, category_3, category_4, category_5, done_1, done_2, done_3, done_4, done_5, day_note, task_1_project_id, task_2_project_id, task_3_project_id, task_4_project_id, task_5_project_id, task_1_target_value, task_2_target_value, task_3_target_value, task_4_target_value, task_5_target_value").eq("user_id", userId).gte("date", weekStart).lte("date", weekEnd).order("date"),
    db.from("oura_daily_summary").select("date, total_sleep_hours, bedtime_timestamp, readiness_score").eq("user_id", userId).gte("date", weekStart).lte("date", weekEnd),
    db.from("daily_nutrition").select("date, calories, protein").eq("user_id", userId).gte("date", weekStart).lte("date", weekEnd),
    db.from("nutrition_targets").select("target_kcal").eq("user_id", userId).order("date", { ascending: false }).limit(1).maybeSingle(),
    db.from("strava_activities").select("start_date, name, distance, sport_type").eq("user_id", userId).gte("start_date", weekStart).lte("start_date", weekEnd + "T23:59:59"),
    db.from("habit_logs").select("date, logged_at, final_stimulus, context_note").eq("user_id", userId).gte("date", weekStart).lte("date", weekEnd),
    db.from("todo_items").select("title, priority, created_at").eq("user_id", userId).eq("status", "open").eq("priority", "high").order("created_at", { ascending: true }),
    db.from("vanguard_links").select("status").eq("user_id", userId).eq("status", "unread"),
    db.from("vanguard_stream").select("source, content, timestamp, importance_score, classification").eq("user_id", userId).gte("timestamp", weekStart + "T00:00:00").lte("timestamp", weekEnd + "T23:59:59").or("source.eq.identity_vault,source.eq.telegram,source.eq.eval_interview").order("timestamp"),
    db.from("todo_sections").select("id, name, project_id").eq("user_id", userId).eq("is_archived", false),
    db.from("todo_items").select("title, status, section_id, updated_at").eq("user_id", userId).in("status", ["done", "dropped"]).gte("updated_at", weekStart + "T00:00:00").lte("updated_at", weekEnd + "T23:59:59"),
    db.from("projects").select("id, name, goal, status").eq("user_id", userId).eq("status", "active"),
    db.from("goal_kpis").select("id, name, unit, target, project_id, higher_is_better").eq("user_id", userId),
    db.from("kpi_entries").select("kpi_id, value").eq("user_id", userId).eq("week_start", weekStart),
    db.from("daily_reconciliations").select("date, day_score, mode, morning_action, midday_status, midday_blocker, planning_summary, user_response").eq("user_id", userId).gte("date", weekStart).lte("date", weekEnd).order("date"),
    db.from("vanguard_behavioral_patterns").select("pattern_type, title, evidence_text, status, confidence, occurrence_count").eq("user_id", userId).neq("status", "archived").neq("status", "user_rejected").order("confidence", { ascending: false }),
    db.from("vanguard_curiosity_queue").select("hypothesis, provocation, category, confidence_score").eq("user_id", userId).eq("status", "pending").order("confidence_score", { ascending: false }).limit(5),
    db.from("claims").select("fact_text, epistemic_status, status, learned_at").eq("user_id", userId).gte("learned_at", weekStart + "T00:00:00").lte("learned_at", weekEnd + "T23:59:59"),
  ]);

  const sprintInfo = getSprintInfoForDate(weekEnd);
  const themeSourceStart = monthThemeSourceForWeek(weekStart);
  const [sprintGoalRes, monthThemeRes] = await Promise.all([
    db.from("sprint_goals").select("goal_text").eq("user_id", userId).eq("personal_year", sprintInfo.personalYear).eq("sprint_number", sprintInfo.sprintNumber).maybeSingle(),
    db.from("monthly_reviews").select("month_theme").eq("user_id", userId).eq("month_start", themeSourceStart).maybeSingle(),
  ]);

  const sprintGoal = sprintGoalRes.data?.goal_text?.trim() || null;
  const monthTheme = monthThemeRes.data?.month_theme?.trim() || null;

  // PowerList
  const wins = winsRes.data ?? [];
  const pillarTally: Record<string, { done: number; total: number }> = { cialo: { done: 0, total: 0 }, duch: { done: 0, total: 0 }, konto: { done: 0, total: 0 } };
  const dayLines: string[] = [];
  for (const w of wins as Row[]) {
    const parts: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const cat = w[`category_${i}`];
      const task = w[`task_${i}`];
      if (!task) continue;
      const done = !!w[`done_${i}`];
      parts.push(`${task}${cat && PILLAR_LABEL[cat] ? ` [${PILLAR_LABEL[cat]}]` : ""}: ${done ? "✓" : "✗"}`);
      if (cat && pillarTally[cat]) { pillarTally[cat].total++; if (done) pillarTally[cat].done++; }
    }
    if (parts.length) {
      const resultTag = w.result ? ` [${w.result}]` : "";
      const note = w.day_note ? ` [nota: ${String(w.day_note).slice(0, 120)}]` : "";
      dayLines.push(`${w.date}${resultTag}: ${parts.join(" · ")}${note}`);
    }
  }

  const oura = ouraRes.data ?? [];
  const sleepHrs = mean(oura.map((o: any) => o.total_sleep_hours).filter(Boolean));
  const bedtime = avgBedtimeLabel(oura.map((o: any) => o.bedtime_timestamp).filter(Boolean));
  const readiness = oura.map((o: any) => ({ date: o.date, score: o.readiness_score })).filter((r: any) => r.score != null);

  const avgKcal = mean((nutrRes.data ?? []).map((n: any) => n.calories).filter(Boolean));
  const avgProtein = mean((nutrRes.data ?? []).map((n: any) => n.protein).filter(Boolean));
  const targetKcal = targetRes.data?.target_kcal ?? null;

  const runs = (runsRes.data ?? []) as Row[];
  const totalKm = runs.reduce((s, r) => s + (r.distance || 0), 0) / 1000;

  const habitLines = ((habitLogsRes.data ?? []) as Row[]).map((l) => {
    const t = l.logged_at ? new Date(l.logged_at).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : l.date;
    return `${t}${l.final_stimulus ? ` — ${l.final_stimulus}` : ""}${l.context_note ? ` (${l.context_note})` : ""}`;
  });

  const staleHighLines = ((staleHighRes.data ?? []) as Row[]).slice(0, 8).map((t) => {
    const ageDays = Math.round((new Date(weekEnd + "T12:00:00Z").getTime() - new Date(t.created_at).getTime()) / 86400000);
    return `"${t.title}" — ${ageDays}d bez ruchu`;
  });

  const allStream = (thisWeekStreamRes.data ?? []) as Row[];
  const thisWeekVoice = allStream.filter((s) => isVoiceEntry(s.source, s.content));
  const thisWeekShortMsgs = allStream.filter((s) => s.source === "telegram" && s.content?.length <= 150);

  const sections = (sectionsRes.data ?? []) as Row[];
  const sectionMap: Record<string, string> = {};
  for (const s of sections) sectionMap[s.id] = s.name;

  const doneTasks = ((doneTasksRes.data ?? []) as Row[]).map((t) => ({ title: t.title, status: t.status, section: t.section_id ? (sectionMap[t.section_id] ?? null) : null }));
  const activeProjects = (projectsRes.data ?? []) as Row[];

  const projectMap: Record<string, string> = {};
  for (const p of activeProjects) projectMap[p.id] = p.name;

  const kpis = kpisRes.data ?? [];
  const kpiEntries = kpiEntriesRes.data ?? [];
  const valueByKpi = new Map(kpiEntries.map((e: any) => [e.kpi_id, e.value]));
  const kpiValuesList = kpis.map((k: any) => ({
    name: k.name, unit: k.unit, value: valueByKpi.get(k.id) ?? null, target: k.target,
    projectName: k.project_id ? (projectMap[k.project_id] ?? null) : null, higherIsBetter: k.higher_is_better,
  }));

  const reconciliations = reconciliationsRes.data ?? [];
  const reconciliationList = reconciliations.map((r: any) => ({
    date: r.date, score: r.day_score, mode: r.mode, morningAction: r.morning_action,
    middayStatus: r.midday_status, middayBlocker: r.midday_blocker,
    summary: r.planning_summary, userResponse: r.user_response,
  }));

  return {
    weekStart, weekEnd, pillarTally, dayLines,
    sleepHrs, bedtime, readiness,
    avgKcal, avgProtein, targetKcal, nutritionDays: (nutrRes.data ?? []).length,
    totalKm, runCount: runs.length,
    runs: runs.map((r) => ({ name: r.name, km: (r.distance / 1000).toFixed(1), type: r.sport_type })),
    habitLines, staleHighLines,
    unreadLinksCount: (linksRes.data ?? []).length,
    thisWeekVoice, thisWeekShortMsgs, doneTasks, activeProjects,
    kpiValuesList, reconciliationList,
    sprintGoal, monthTheme,
    behavioralPatterns: behavioralPatternsRes.data ?? [],
    curiosityQueue: curiosityQueueRes.data ?? [],
    claims: claimsRes.data ?? [],
  };
}
