/**
 * vanguard-nutrition-coach — the energy/target brain.
 *
 * Sees everything: body_metrics (weight/waist/belly trend), Yazio macros,
 * Oura (measured TDEE / steps / sleep / recovery), strength + runs.
 * Triangulates the REAL maintenance (catches Yazio under-logging by comparing
 * Oura-measured burn against logged intake + actual weight trend), then sets a
 * gentle, training-aware daily target + protein floor anchored to the profile
 * goal (e.g. ~14% BF by the marathon). DeepSeek writes the coaching verdict.
 *
 * On-demand: POST { userId?, date? }. Persists one row/day to nutrition_targets.
 */
import { createServiceClient, corsHeaders, resolveUserScope } from "../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";
import { getVanguardUserId } from "../_shared/constants.ts";
import { sendMessage } from "../_shared/telegram.ts";
import { fetchMedicalContext } from "../_shared/medicalContext.ts";
import { getWarsawDayBoundaries } from "../_shared/time.ts";

const KCAL_PER_KG = 7700;            // ~kcal per kg body mass
const OURA_CORRECTION = 0.88;        // wearables over-read active burn ~10-15%

const toWarsaw = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const num = (v: unknown): number | null => (v == null || isNaN(Number(v)) ? null : Number(v));
const clean = (rows: any[] | null, key: string) =>
  (rows || []).map((r) => num(r[key])).filter((v): v is number => v != null && v > 0);

// Plain-text Telegram push (no Markdown — avoids parse errors on PL chars/parens).
function buildPushMessage(date: string, s: any, verdict: any): string {
  const t = s.today, e = s.energy, b = s.body;
  const L: string[] = [];
  L.push(`🍽️ Cel na dziś — ${date}`);
  L.push("");
  if (t.intake_so_far != null && t.intake_so_far > 0) {
    const rem = t.remaining_kcal;
    const remLabel = rem >= 0 ? `zostało ${rem}` : `przekroczone o ${Math.abs(rem)}`;
    L.push(`🎯 Cel dnia ${t.target_kcal} kcal · zjedzone ${Math.round(t.intake_so_far)} · ${remLabel}`);
    L.push(`🥩 Białko: zostało ${t.remaining_protein} g (floor ${t.protein_floor_g})`);
  } else {
    L.push(`🎯 Target: ${t.target_kcal} kcal (deficyt ${t.deficit_kcal})`);
    L.push(`🥩 Białko: min ${t.protein_floor_g} g`);
  }
  L.push(`⚖️ Maintenance ~${e.est_maintenance} kcal · trend ${b.weight_trend_kg_per_week} kg/tydz`);
  if (e.underlog_gap_kcal > 150) L.push(`📉 Niedolog ~${e.underlog_gap_kcal} kcal/dzień — loguj dokładniej`);
  const f = s.forecast;
  if (f?.days_to_goal_est != null) L.push(`📅 Przy tym tempie: cel BF za ~${f.days_to_goal_est}d`);
  if (f?.adaptive_correction_kcal) L.push(`🔧 Adaptive correction: ${f.adaptive_correction_kcal > 0 ? '-' : '+'}${Math.abs(f.adaptive_correction_kcal)} kcal (tempo vs plan)`);
  if (verdict?.today_focus) { L.push(""); L.push(`👉 ${verdict.today_focus}`); }
  if (Array.isArray(verdict?.flags) && verdict.flags.length) {
    L.push(""); for (const f of verdict.flags) L.push(`⚠️ ${f}`);
  }
  if (Array.isArray(verdict?.food_suggestions) && verdict.food_suggestions.length) {
    L.push(""); L.push("🍴 Propozycje:"); for (const f of verdict.food_suggestions) L.push(`• ${f}`);
  }
  return L.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { userId: scopedUserId } = await resolveUserScope(req, body.userId ?? null);
    const userId = scopedUserId || getVanguardUserId();
    const notify = body.notify === true;
    const supabase = createServiceClient();
    const apiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";
    const today = body.date || toWarsaw(new Date());
    const targetDate = new Date(today + "T12:00:00Z");
    const daysAgo = (n: number) => {
      const d = new Date(targetDate);
      d.setUTCDate(d.getUTCDate() - n);
      return d.toISOString().split("T")[0];
    };
    const d30 = daysAgo(30);
    const d45 = daysAgo(45);

    // ── Profile (the goal anchor) ──────────────────────────────────────────────
    const { data: profile } = await supabase
      .from("nutrition_profile").select("*").eq("user_id", userId).maybeSingle();
    if (!profile) throw new Error("Brak nutrition_profile dla usera — najpierw seed profilu.");

    // ── Pull everything in parallel ────────────────────────────────────────────
    const [bmRes, ouraRes, nutrRes, runsRes, gymRes, todayOuraRes, todayNutrRes, medicalContext] = await Promise.all([
      supabase.from("body_metrics")
        .select("date, weight, waist, belly, body_fat")
        .eq("user_id", userId).gte("date", d45).order("date", { ascending: true }),
      supabase.from("oura_daily_summary")
        .select("date, total_calories, active_calories, steps, total_sleep_hours, readiness_score, hrv_avg, rhr_avg, deep_sleep_hours")
        .eq("user_id", userId).gte("date", d30).order("date", { ascending: false }),
      supabase.from("daily_nutrition")
        .select("date, calories, protein, carbs, fat, fiber")
        .eq("user_id", userId).gte("date", d30).order("date", { ascending: false }),
      supabase.from("strava_activities_clean")
        .select("start_date, sport_type, distance")
        .eq("user_id", userId).eq("is_oura", false)
        // d30 + "T00:00:00" has no offset, so Postgres reads it as UTC midnight, not Warsaw
        // midnight — 1-2h later than intended, which excluded a run from the literal first
        // hour(s) of the 30-days-ago Warsaw date from this lookback.
        .gte("start_date", getWarsawDayBoundaries(d30).start).ilike("sport_type", "%run%"),
      supabase.from("workout_sessions")
        .select("date, workout_day")
        .eq("user_id", userId).gte("date", d30),
      supabase.from("oura_daily_summary")
        .select("total_calories, active_calories, steps")
        .eq("user_id", userId).eq("date", today).maybeSingle(),
      supabase.from("daily_nutrition")
        .select("calories, protein, carbs, fat, fiber")
        .eq("user_id", userId).eq("date", today).maybeSingle(),
      fetchMedicalContext(supabase, userId, today),
    ]);

    const bm = bmRes.data || [];
    const oura = ouraRes.data || [];
    const nutr = nutrRes.data || [];

    // ── Body weight + trend ────────────────────────────────────────────────────
    const weights = bm.filter((r) => num(r.weight) != null);
    const latestWeight = weights.length ? num(weights[weights.length - 1].weight)! : null;
    let weightTrendPerWeek = 0;
    let weightChangeKg = 0;
    let weightDaysSpan = 0;
    if (weights.length >= 2) {
      const first = weights[0], last = weights[weights.length - 1];
      weightChangeKg = num(last.weight)! - num(first.weight)!;
      weightDaysSpan = Math.max(1,
        (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000);
      weightTrendPerWeek = +(weightChangeKg / (weightDaysSpan / 7)).toFixed(2);
    }
    const weightForCalc = latestWeight ?? 74.5;
    const latestWaist = weights.length ? num(bm[bm.length - 1].waist) : null;
    const latestBelly = bm.length ? num(bm[bm.length - 1].belly) : null;

    // ── Thermodynamic forecast (30/60/90d) ─────────────────────────────────────
    // Weight projects linearly off the observed trend. BF% has no direct daily
    // signal (body_metrics.body_fat is sparse/manual), so it's derived from a
    // fat-mass/lean-mass split: assume FAT_LOSS_FRACTION of any weight change is
    // fat mass (the rest is water/glycogen/measurement noise), hold lean mass
    // constant, recompute BF% from the resulting fat-mass/total-weight ratio.
    const FAT_LOSS_FRACTION = 0.85;
    const reliableWeightWindow = weightDaysSpan >= 14;
    const trendKgPerDay = reliableWeightWindow ? weightTrendPerWeek / 7 : 0;
    const currentBf = num(profile.current_body_fat_est);
    const fatMassNow = currentBf != null ? weightForCalc * (currentBf / 100) : null;
    const leanMassNow = fatMassNow != null ? weightForCalc - fatMassNow : null;

    const forecastAt = (days: number) => {
      const projectedWeight = +(weightForCalc + trendKgPerDay * days).toFixed(1);
      let projectedBf: number | null = null;
      if (fatMassNow != null && leanMassNow != null) {
        const projectedFatMass = fatMassNow + trendKgPerDay * FAT_LOSS_FRACTION * days;
        projectedBf = projectedWeight > 0 ? +((projectedFatMass / projectedWeight) * 100).toFixed(1) : null;
      }
      return { weight: projectedWeight, bf: projectedBf };
    };
    const forecast30 = forecastAt(30);
    const forecast60 = forecastAt(60);
    const forecast90 = forecastAt(90);

    // Days to reach goal_body_fat at the CURRENT (not target) trend — null if flat/wrong direction.
    let daysToGoalEst: number | null = null;
    const goalBf = num(profile.goal_body_fat);
    if (currentBf != null && goalBf != null && fatMassNow != null && trendKgPerDay < 0 && currentBf > goalBf) {
      // Binary-search-free closed form would need solving bf(t)=goal; step search is simpler and cheap (≤3650 iters).
      for (let d = 1; d <= 3650; d++) {
        const f = forecastAt(d);
        if (f.bf != null && f.bf <= goalBf) { daysToGoalEst = d; break; }
      }
    }

    // ── 30d averages ───────────────────────────────────────────────────────────
    const tdeeArr = clean(oura, "total_calories");
    const activeArr = clean(oura, "active_calories");
    const avgTdeeOura = Math.round(mean(tdeeArr));
    const avgActive = Math.round(mean(activeArr));
    const avgSteps = Math.round(mean(clean(oura, "steps")));
    const avgSleep = +mean(clean(oura, "total_sleep_hours")).toFixed(2);
    const avgReadiness = Math.round(mean(clean(oura, "readiness_score")));
    const avgHrv = Math.round(mean(clean(oura, "hrv_avg")));
    const avgRhr = Math.round(mean(clean(oura, "rhr_avg")));

    const intakeArr = clean(nutr, "calories");
    const avgIntake = Math.round(mean(intakeArr));
    const daysLogged = intakeArr.length;
    const avgProtein = Math.round(mean(clean(nutr, "protein")));
    const avgCarbs = Math.round(mean(clean(nutr, "carbs")));
    const avgFat = Math.round(mean(clean(nutr, "fat")));
    const avgFiber = +mean(clean(nutr, "fiber")).toFixed(1);
    // intake variability (coefficient of variation) — the "swing" signal
    const intakeStd = intakeArr.length
      ? Math.sqrt(mean(intakeArr.map((x) => (x - avgIntake) ** 2))) : 0;
    const intakeCv = avgIntake ? +(intakeStd / avgIntake).toFixed(2) : 0;

    const runs = (runsRes.data || []);
    const runKm = +(runs.reduce((s, r) => s + (num(r.distance) || 0), 0) / 1000).toFixed(1);
    const gymCount = (gymRes.data || []).length;

    // ── Maintenance triangulation ──────────────────────────────────────────────
    const ouraAdj = Math.round(avgTdeeOura * OURA_CORRECTION);

    // reliableWeightWindow computed above (forecast section) — at least 14 days
    // to filter out daily water weight fluctuations which would otherwise scale up to crazy numbers.
    const dailyWeightSurplusDeficit = reliableWeightWindow
      ? (weightChangeKg * KCAL_PER_KG / weightDaysSpan)
      : 0;

    const maintFromLog = avgIntake
      ? Math.round(avgIntake - dailyWeightSurplusDeficit)
      : ouraAdj;
    const flat = reliableWeightWindow ? Math.abs(weightTrendPerWeek) < 0.15 : true;
    const underlogGap = Math.max(0, ouraAdj - avgIntake);
    // When weight is flat but Oura burn >> logged intake, the log is under-counting:
    // real maintenance ≈ Oura-adjusted burn (weight proves intake≈expenditure).
    let estMaintenance: number;
    if (flat && ouraAdj - maintFromLog > 200) estMaintenance = ouraAdj;
    else estMaintenance = Math.round((ouraAdj + maintFromLog) / 2);

    // ── Target (gentle deficit, floats up with today's training) ───────────────
    // Taper guard: inside 21 days of the event, no deficit (fuel + race fresh).
    const daysToEvent = profile.event_date
      ? Math.round((new Date(profile.event_date).getTime() - new Date(today).getTime()) / 86400000)
      : null;
    const inTaper = daysToEvent != null && daysToEvent >= 0 && daysToEvent <= 21;
    const targetWeeklyLossKg = profile.weekly_loss_kg || 0.35;
    const deficitPerDay = inTaper ? 0 : Math.round(targetWeeklyLossKg * KCAL_PER_KG / 7);

    // ── Adaptive correction ─────────────────────────────────────────────────────
    // deficitPerDay above is the PLANNED deficit from the static goal. If the
    // observed trend is consistently missing that rate (under-logging, NEAT
    // drop, etc. already explain part of it via estMaintenance, but not all of
    // it), nudge the target further — damped 50% and capped at ±150 kcal/day so
    // one noisy week can't swing the target hard. Needs ≥14d of weight data and
    // ≥10 logged days/30 to trust the gap; never applies in taper.
    let adaptiveCorrectionKcal = 0;
    if (reliableWeightWindow && !inTaper && daysLogged >= 10) {
      const observedWeeklyLossKg = -weightTrendPerWeek; // positive = actually losing
      const lossGapKgPerWeek = targetWeeklyLossKg - observedWeeklyLossKg; // positive = behind plan
      adaptiveCorrectionKcal = Math.max(-150, Math.min(150,
        Math.round(lossGapKgPerWeek * KCAL_PER_KG / 7 * 0.5)));
    }

    const todayOura = todayOuraRes.data;
    const todayActive = todayOura ? num(todayOura.active_calories) : null;
    const addBack = (todayActive != null && avgActive)
      ? Math.min(500, Math.round(Math.max(0, todayActive - avgActive) * 0.5)) : 0;
    const targetKcal = estMaintenance - deficitPerDay - adaptiveCorrectionKcal + addBack;
    const proteinFloor = Math.round(weightForCalc * (profile.protein_g_per_kg || 2.0));

    const age = profile.birth_date
      ? Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / (365.25 * 86400000)) : null;

    const todayNutr = todayNutrRes.data;
    const intakeSoFar = todayNutr ? num(todayNutr.calories) : null;
    const proteinSoFar = todayNutr ? num(todayNutr.protein) : null;
    const remainingKcal = intakeSoFar != null ? targetKcal - Math.round(intakeSoFar) : targetKcal;
    const remainingProtein = Math.max(0, proteinFloor - Math.round(proteinSoFar ?? 0));

    const signals = {
      profile: {
        height_cm: num(profile.height_cm), age, sex: profile.sex,
        goal_body_fat: num(profile.goal_body_fat), current_body_fat_est: num(profile.current_body_fat_est),
        event_name: profile.event_name, event_date: profile.event_date, days_to_event: daysToEvent,
        in_taper: inTaper, weekly_loss_kg: num(profile.weekly_loss_kg),
      },
      body: { weight: latestWeight, waist: latestWaist, belly: latestBelly,
        weight_trend_kg_per_week: weightTrendPerWeek, weight_window_days: Math.round(weightDaysSpan) },
      forecast: {
        target_weekly_loss_kg: targetWeeklyLossKg,
        observed_weekly_loss_kg: reliableWeightWindow ? +(-weightTrendPerWeek).toFixed(2) : null,
        adaptive_correction_kcal: adaptiveCorrectionKcal,
        forecast_30d: forecast30, forecast_60d: forecast60, forecast_90d: forecast90,
        days_to_goal_est: daysToGoalEst,
      },
      energy: { avg_tdee_oura: avgTdeeOura, oura_adjusted: ouraAdj, avg_active: avgActive,
        avg_intake_logged: avgIntake, maintenance_from_log: maintFromLog,
        est_maintenance: estMaintenance, underlog_gap_kcal: underlogGap, days_logged_30: daysLogged },
      macros: { avg_protein: avgProtein, protein_per_kg: +(avgProtein / weightForCalc).toFixed(2),
        avg_carbs: avgCarbs, avg_fat: avgFat, avg_fiber: avgFiber, intake_cv: intakeCv },
      activity: { avg_steps: avgSteps, run_km_30d: runKm, runs_30d: runs.length, gym_30d: gymCount },
      recovery: { avg_sleep_h: avgSleep, avg_readiness: avgReadiness, avg_hrv: avgHrv, avg_rhr: avgRhr },
      medical_context: medicalContext,
      today: { date: today, target_kcal: targetKcal, protein_floor_g: proteinFloor,
        deficit_kcal: deficitPerDay, add_back_kcal: addBack,
        intake_so_far: intakeSoFar, protein_so_far: proteinSoFar,
        remaining_kcal: remainingKcal, remaining_protein: remainingProtein,
        active_so_far: todayActive, steps_so_far: todayOura ? num(todayOura.steps) : null },
    };

    // ── DeepSeek verdict ───────────────────────────────────────────────────────
    const SYSTEM = `Jesteś trenerem żywieniowym maratończyka, który równolegle tnie tłuszcz do celu BF. Masz NAJDOKŁADNIEJSZE dane o tym człowieku: zmierzone spalanie z Oura, zalogowane makra z Yazio, trend wagi/talii, sen i trening. Twoja przewaga nad zwykłym dietetykiem: widzisz rozbieżność między spalaniem a logiem i trend wagi — więc łapiesz NIEDOLOG (gdy waga stoi mimo "deficytu" w logu, user je więcej niż wpisuje).

Zasady oceny:
- Prawdziwe maintenance ważniejsze niż wzór. Jeśli underlog_gap duży a waga płaska → user je ~tyle co spala, nie tyle co loguje.
- Deficyt ma być ŁAGODNY (ochrona biegania). Nie każ ciąć ostro. W taperze (in_taper=true) deficyt = 0.
- Białko to floor, nie cel — pilnuj spójności (CV) bardziej niż średniej.
- Sen < 7h i niski błonnik to realne hamulce redukcji — flaguj.
- Cel mierz trendem talia/brzuch/waga, nie samym %BF (bez DEXA % jest niepewny).
- forecast.* to projekcja CURRENT trendu (nie planu) na 30/60/90 dni i adaptive_correction_kcal — gdy obserwowane tempo (observed_weekly_loss_kg) jest poniżej planu (target_weekly_loss_kg), target_kcal już został dociśnięty o ten correction; nazwij to userowi prosto ("tempo wolniejsze niż plan, target dziś trochę niższy żeby to skorygować"), nie traktuj jako odrębny problem do flagowania jeśli korekta już w target_kcal.
- Konkretne polskie produkty (Lidl/Biedronka/Żabka), realne, nie suplementy jako baza.
- Masz medical_context z badaniami. Używaj go jako kontekstu z datą: zawsze patrz na age_days/freshness. Stare/stale wyniki (np. >180 dni) nie opisują automatycznie dzisiejszego stanu. Nie diagnozuj; możesz flagować "warto odświeżyć badania" lub "historycznie X nie wyglądało jak oczywisty limiter".
Mówisz po polsku, bezpośrednio, liczbami. Nie komplementujesz — diagnozujesz.`;

    const USER = `DANE (policzone deterministycznie, ufaj im):
${JSON.stringify(signals, null, 2)}

Zwróć WYŁĄCZNIE JSON:
{
  "summary": "2-3 zdania: gdzie jest, czy na kursie do celu BF na datę docelową",
  "trajectory": "on_track | behind | ahead",
  "trajectory_note": "1 zdanie — co napędza/hamuje",
  "forecast_note": "1 zdanie o prognozie 30/60/90d i czy days_to_goal_est realistycznie domyka się przed event_date",
  "today_focus": "1 zdanie — co konkretnie zrobić DZIŚ (target/białko/trening)",
  "flags": ["max 4 krótkie flagi z konkretem — niedolog, sen, rozrzut, błonnik, białko"],
  "protein_note": "1 zdanie o spójności białka",
  "food_suggestions": ["3 konkretne polskie produkty/posiłki pod dzisiejszy target i białko"]
}`;

    let verdict: Record<string, unknown> | null = null;
    let verdictError: string | null = apiKey ? null : "no_deepseek_key";
    if (apiKey) {
      try {
        const res = await deepseekChat({
          apiKey, model: "deepseek-v4-flash", temperature: 0.3, maxTokens: 2500,
          timeoutMs: 40000, responseFormat: { type: "json_object" },
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: USER }],
        });
        verdict = parseJsonFromContent(res.content);
        if (!verdict) {
          verdictError = `parse_failed len=${res.content.length} tail=${res.content.slice(-80)}`;
        }
      } catch (e) {
        verdictError = (e as Error).message;
        console.error("[nutrition-coach] deepseek verdict failed:", verdictError);
      }
    }

    // ── Persist ────────────────────────────────────────────────────────────────
    const { error: upErr } = await supabase.from("nutrition_targets").upsert({
      user_id: userId, date: today,
      est_maintenance_kcal: estMaintenance, target_kcal: targetKcal,
      protein_floor_g: proteinFloor, deficit_kcal: deficitPerDay,
      weight_trend_kg_per_week: weightTrendPerWeek, underlog_gap_kcal: underlogGap,
      avg_tdee_oura: avgTdeeOura, avg_intake_logged: avgIntake,
      forecast_30d_weight_kg: forecast30.weight, forecast_60d_weight_kg: forecast60.weight,
      forecast_90d_weight_kg: forecast90.weight, forecast_30d_bf_pct: forecast30.bf,
      forecast_60d_bf_pct: forecast60.bf, forecast_90d_bf_pct: forecast90.bf,
      days_to_goal_est: daysToGoalEst, adaptive_correction_kcal: adaptiveCorrectionKcal,
      inputs: signals, verdict,
    }, { onConflict: "user_id,date" });
    if (upErr) console.error("[nutrition-coach] upsert error:", upErr.message);

    // ── Telegram push (cron / explicit notify) ─────────────────────────────────
    let notified = false;
    if (notify) {
      const tgToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
      const tgChat = parseInt(Deno.env.get("TELEGRAM_CHAT_ID") ?? "0");
      if (tgToken && tgChat) {
        try {
          const res = await sendMessage(tgToken, tgChat, buildPushMessage(today, signals, verdict));
          notified = res.ok;
          if (!res.ok) console.error("[nutrition-coach] telegram push HTTP", res.status);
        } catch (e) {
          console.error("[nutrition-coach] telegram push failed:", (e as Error).message);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: !upErr, date: today, signals, verdict, verdictError, notified, persistError: upErr?.message ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[nutrition-coach] fatal:", e.message);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
