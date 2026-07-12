import { getWarsawDayBoundaries, getWarsawDateString } from "../_shared/time.ts";
import { fetchMedicalContext } from "../_shared/medicalContext.ts";

const KCAL_PER_KG = 7700;
const OURA_CORRECTION = 0.88;

const num = (v: unknown): number | null => (v == null || isNaN(Number(v)) ? null : Number(v));
const mean = (xs: number[]): number | null => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const clean = (rows: any[] | null, key: string) => (rows || []).map((r) => num(r[key])).filter((v): v is number => v != null && v > 0);

export async function fetchNutritionData(supabase: any, userId: string, today: string) {
  const targetDate = new Date(today + "T12:00:00Z");
  const daysAgo = (n: number) => { const d = new Date(targetDate); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().split("T")[0]; };
  const d30 = daysAgo(30), d45 = daysAgo(45);

  const { data: profile } = await supabase.from("nutrition_profile").select("*").eq("user_id", userId).maybeSingle();
  if (!profile) throw new Error("Brak nutrition_profile.");

  const [bmRes, ouraRes, nutrRes, runsRes, gymRes, todayOuraRes, todayNutrRes, medicalContext] = await Promise.all([
    supabase.from("body_metrics").select("date, weight, waist, belly, body_fat").eq("user_id", userId).gte("date", d45).order("date", { ascending: true }),
    supabase.from("oura_daily_summary").select("date, total_calories, active_calories, steps, total_sleep_hours, readiness_score, hrv_avg, rhr_avg, deep_sleep_hours").eq("user_id", userId).gte("date", d30).order("date", { ascending: false }),
    supabase.from("daily_nutrition").select("date, calories, protein, carbs, fat, fiber").eq("user_id", userId).gte("date", d30).order("date", { ascending: false }),
    supabase.from("strava_activities_clean").select("start_date, sport_type, distance").eq("user_id", userId).eq("is_oura", false).gte("start_date", getWarsawDayBoundaries(d30).start).ilike("sport_type", "%run%"),
    supabase.from("workout_sessions").select("date, workout_day").eq("user_id", userId).gte("date", d30),
    supabase.from("oura_daily_summary").select("total_calories, active_calories, steps").eq("user_id", userId).eq("date", today).maybeSingle(),
    supabase.from("daily_nutrition").select("calories, protein, carbs, fat, fiber").eq("user_id", userId).eq("date", today).maybeSingle(),
    fetchMedicalContext(supabase, userId, today),
  ]);

  return { profile, bm: bmRes.data || [], oura: ouraRes.data || [], nutr: nutrRes.data || [], runs: runsRes.data || [], gym: gymRes.data || [], todayOura: todayOuraRes.data, todayNutr: todayNutrRes.data, medicalContext, today, targetDate, d30 };
}

export function computeNutritionSignals(data: Awaited<ReturnType<typeof fetchNutritionData>>) {
  const { profile, bm, oura, nutr, runs, gym, todayOura, todayNutr, medicalContext, today, targetDate, d30 } = data;

  const weights = bm.filter((r: any) => num(r.weight) != null);
  const latestWeight = weights.length ? num(weights[weights.length - 1].weight)! : null;
  let weightTrendPerWeek = 0, weightChangeKg = 0, weightDaysSpan = 0;
  if (weights.length >= 2) { const first = weights[0], last = weights[weights.length - 1]; weightChangeKg = num(last.weight)! - num(first.weight)!; weightDaysSpan = Math.max(1, (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000); weightTrendPerWeek = +(weightChangeKg / (weightDaysSpan / 7)).toFixed(2); }
  const weightForCalc = latestWeight ?? 74.5;
  const latestWaist = weights.length ? num(bm[bm.length - 1].waist) : null;
  const latestBelly = bm.length ? num(bm[bm.length - 1].belly) : null;

  const FAT_LOSS_FRACTION = 0.85;
  const reliableWeightWindow = weightDaysSpan >= 14;
  const trendKgPerDay = reliableWeightWindow ? weightTrendPerWeek / 7 : 0;
  const currentBf = num(profile.current_body_fat_est);
  const fatMassNow = currentBf != null ? weightForCalc * (currentBf / 100) : null;
  const leanMassNow = fatMassNow != null ? weightForCalc - fatMassNow : null;

  const forecastAt = (days: number) => { const pw = +(weightForCalc + trendKgPerDay * days).toFixed(1); let pbf: number | null = null; if (fatMassNow != null && leanMassNow != null) { const pfm = fatMassNow + trendKgPerDay * FAT_LOSS_FRACTION * days; pbf = pw > 0 ? +((pfm / pw) * 100).toFixed(1) : null; } return { weight: pw, bf: pbf }; };
  const forecast30 = forecastAt(30), forecast60 = forecastAt(60), forecast90 = forecastAt(90);

  let daysToGoalEst: number | null = null;
  const goalBf = num(profile.goal_body_fat);
  if (currentBf != null && goalBf != null && fatMassNow != null && trendKgPerDay < 0 && currentBf > goalBf) { for (let d = 1; d <= 3650; d++) { const f = forecastAt(d); if (f.bf != null && f.bf <= goalBf) { daysToGoalEst = d; break; } } }

  const tdeeArr = clean(oura, "total_calories"), activeArr = clean(oura, "active_calories");
  const avgTdeeOura = Math.round(mean(tdeeArr) ?? 0), avgActive = Math.round(mean(activeArr) ?? 0);
  const avgSteps = Math.round(mean(clean(oura, "steps")) ?? 0);
  const avgSleepRaw = mean(clean(oura, "total_sleep_hours")), avgSleep = avgSleepRaw != null ? +avgSleepRaw.toFixed(2) : null;
  const avgReadiness = Math.round(mean(clean(oura, "readiness_score")) ?? 0);
  const avgHrv = Math.round(mean(clean(oura, "hrv_avg")) ?? 0), avgRhr = Math.round(mean(clean(oura, "rhr_avg")) ?? 0);

  const intakeArr = clean(nutr, "calories"), avgIntake = Math.round(mean(intakeArr) ?? 0), daysLogged = intakeArr.length;
  const avgProtein = Math.round(mean(clean(nutr, "protein")) ?? 0), avgCarbs = Math.round(mean(clean(nutr, "carbs")) ?? 0), avgFat = Math.round(mean(clean(nutr, "fat")) ?? 0);
  const avgFiberRaw = mean(clean(nutr, "fiber")), avgFiber = avgFiberRaw != null ? +avgFiberRaw.toFixed(1) : null;
  const intakeStd = intakeArr.length ? Math.sqrt(mean(intakeArr.map((x) => (x - (avgIntake || 0)) ** 2)) ?? 0) : 0;
  const intakeCv = avgIntake ? +(intakeStd / avgIntake).toFixed(2) : 0;

  const runKm = +(runs.reduce((s: number, r: any) => s + (num(r.distance) || 0), 0) / 1000).toFixed(1);
  const gymCount = gym.length;

  const ouraAdj = Math.round(avgTdeeOura * OURA_CORRECTION);
  const dailyWeightSurplusDeficit = reliableWeightWindow ? (weightChangeKg * KCAL_PER_KG / weightDaysSpan) : 0;
  const maintFromLog = avgIntake ? Math.round(avgIntake - dailyWeightSurplusDeficit) : ouraAdj;
  const flat = reliableWeightWindow ? Math.abs(weightTrendPerWeek) < 0.15 : true;
  const underlogGap = Math.max(0, ouraAdj - avgIntake);
  let estMaintenance: number;
  if (flat && ouraAdj - maintFromLog > 200) estMaintenance = ouraAdj; else estMaintenance = Math.round((ouraAdj + maintFromLog) / 2);

  const daysToEvent = profile.event_date ? Math.round((new Date(profile.event_date).getTime() - new Date(today).getTime()) / 86400000) : null;
  const inTaper = daysToEvent != null && daysToEvent >= 0 && daysToEvent <= 21;
  const targetWeeklyLossKg = profile.weekly_loss_kg || 0.35;
  const deficitPerDay = inTaper ? 0 : Math.round(targetWeeklyLossKg * KCAL_PER_KG / 7);

  let adaptiveCorrectionKcal = 0;
  if (reliableWeightWindow && !inTaper && daysLogged >= 10) {
    const observedWeeklyLossKg = -weightTrendPerWeek;
    const lossGapKgPerWeek = targetWeeklyLossKg - observedWeeklyLossKg;
    adaptiveCorrectionKcal = Math.max(-150, Math.min(150, Math.round(lossGapKgPerWeek * KCAL_PER_KG / 7 * 0.5)));
  }

  const todayActive = todayOura ? num(todayOura.active_calories) : null;
  const addBack = (todayActive != null && avgActive) ? Math.min(500, Math.round(Math.max(0, todayActive - avgActive) * 0.5)) : 0;
  const targetKcal = estMaintenance - deficitPerDay - adaptiveCorrectionKcal + addBack;
  const proteinFloor = Math.round(weightForCalc * (profile.protein_g_per_kg || 2.0));
  const age = profile.birth_date ? Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / (365.25 * 86400000)) : null;

  const intakeSoFar = todayNutr ? num(todayNutr.calories) : null;
  const proteinSoFar = todayNutr ? num(todayNutr.protein) : null;
  const remainingKcal = intakeSoFar != null ? targetKcal - Math.round(intakeSoFar) : targetKcal;
  const remainingProtein = Math.max(0, proteinFloor - Math.round(proteinSoFar ?? 0));

  return {
    signals: {
      profile: { height_cm: num(profile.height_cm), age, sex: profile.sex, goal_body_fat: num(profile.goal_body_fat), current_body_fat_est: num(profile.current_body_fat_est), event_name: profile.event_name, event_date: profile.event_date, days_to_event: daysToEvent, in_taper: inTaper, weekly_loss_kg: num(profile.weekly_loss_kg) },
      body: { weight: latestWeight, waist: latestWaist, belly: latestBelly, weight_trend_kg_per_week: weightTrendPerWeek, weight_window_days: Math.round(weightDaysSpan) },
      forecast: { target_weekly_loss_kg: targetWeeklyLossKg, observed_weekly_loss_kg: reliableWeightWindow ? +(-weightTrendPerWeek).toFixed(2) : null, adaptive_correction_kcal: adaptiveCorrectionKcal, forecast_30d: forecast30, forecast_60d: forecast60, forecast_90d: forecast90, days_to_goal_est: daysToGoalEst },
      energy: { avg_tdee_oura: avgTdeeOura, oura_adjusted: ouraAdj, avg_active: avgActive, avg_intake_logged: avgIntake, maintenance_from_log: maintFromLog, est_maintenance: estMaintenance, underlog_gap_kcal: underlogGap, days_logged_30: daysLogged },
      macros: { avg_protein: avgProtein, protein_per_kg: +(avgProtein / weightForCalc).toFixed(2), avg_carbs: avgCarbs, avg_fat: avgFat, avg_fiber: avgFiber, intake_cv: intakeCv },
      activity: { avg_steps: avgSteps, run_km_30d: runKm, runs_30d: runs.length, gym_30d: gymCount },
      recovery: { avg_sleep_h: avgSleep, avg_readiness: avgReadiness, avg_hrv: avgHrv, avg_rhr: avgRhr },
      medical_context: medicalContext,
      today: { date: today, target_kcal: targetKcal, protein_floor_g: proteinFloor, deficit_kcal: deficitPerDay, add_back_kcal: addBack, intake_so_far: intakeSoFar, protein_so_far: proteinSoFar, remaining_kcal: remainingKcal, remaining_protein: remainingProtein, active_so_far: todayActive, steps_so_far: todayOura ? num(todayOura.steps) : null },
    },
    forecast30, forecast60, forecast90, daysToGoalEst, estMaintenance, targetKcal, proteinFloor, deficitPerDay, adaptiveCorrectionKcal, weightTrendPerWeek, underlogGap: underlogGap, avgTdeeOura, avgIntake,
  };
}
