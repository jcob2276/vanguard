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

const KCAL_PER_KG = 7700;            // ~kcal per kg body mass
const OURA_CORRECTION = 0.88;        // wearables over-read active burn ~10-15%

const toWarsaw = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
const daysAgo = (n: number) => toWarsaw(new Date(Date.now() - n * 86400000));

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
    const d30 = daysAgo(30);
    const d45 = daysAgo(45);

    // ── Profile (the goal anchor) ──────────────────────────────────────────────
    const { data: profile } = await supabase
      .from("nutrition_profile").select("*").eq("user_id", userId).maybeSingle();
    if (!profile) throw new Error("Brak nutrition_profile dla usera — najpierw seed profilu.");

    // ── Pull everything in parallel ────────────────────────────────────────────
    const [bmRes, ouraRes, nutrRes, runsRes, gymRes, todayOuraRes, todayNutrRes] = await Promise.all([
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
        .gte("start_date", d30 + "T00:00:00").ilike("sport_type", "%run%"),
      supabase.from("workout_sessions")
        .select("date, workout_day")
        .eq("user_id", userId).gte("date", d30),
      supabase.from("oura_daily_summary")
        .select("total_calories, active_calories, steps")
        .eq("user_id", userId).eq("date", today).maybeSingle(),
      supabase.from("daily_nutrition")
        .select("calories, protein, carbs, fat, fiber")
        .eq("user_id", userId).eq("date", today).maybeSingle(),
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
    const maintFromLog = avgIntake
      ? Math.round(avgIntake - (weightChangeKg * KCAL_PER_KG / Math.max(weightDaysSpan, 1)))
      : ouraAdj;
    const flat = Math.abs(weightTrendPerWeek) < 0.15;
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
    const deficitPerDay = inTaper ? 0 : Math.round((profile.weekly_loss_kg || 0.35) * KCAL_PER_KG / 7);

    const todayOura = todayOuraRes.data;
    const todayActive = todayOura ? num(todayOura.active_calories) : null;
    const addBack = (todayActive != null && avgActive)
      ? Math.min(500, Math.round(Math.max(0, todayActive - avgActive) * 0.5)) : 0;
    const targetKcal = estMaintenance - deficitPerDay + addBack;
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
      energy: { avg_tdee_oura: avgTdeeOura, oura_adjusted: ouraAdj, avg_active: avgActive,
        avg_intake_logged: avgIntake, maintenance_from_log: maintFromLog,
        est_maintenance: estMaintenance, underlog_gap_kcal: underlogGap, days_logged_30: daysLogged },
      macros: { avg_protein: avgProtein, protein_per_kg: +(avgProtein / weightForCalc).toFixed(2),
        avg_carbs: avgCarbs, avg_fat: avgFat, avg_fiber: avgFiber, intake_cv: intakeCv },
      activity: { avg_steps: avgSteps, run_km_30d: runKm, runs_30d: runs.length, gym_30d: gymCount },
      recovery: { avg_sleep_h: avgSleep, avg_readiness: avgReadiness, avg_hrv: avgHrv, avg_rhr: avgRhr },
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
- Konkretne polskie produkty (Lidl/Biedronka/Żabka), realne, nie suplementy jako baza.
Mówisz po polsku, bezpośrednio, liczbami. Nie komplementujesz — diagnozujesz.`;

    const USER = `DANE (policzone deterministycznie, ufaj im):
${JSON.stringify(signals, null, 2)}

Zwróć WYŁĄCZNIE JSON:
{
  "summary": "2-3 zdania: gdzie jest, czy na kursie do celu BF na datę docelową",
  "trajectory": "on_track | behind | ahead",
  "trajectory_note": "1 zdanie — co napędza/hamuje",
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
      JSON.stringify({ success: true, date: today, signals, verdict, verdictError, notified }),
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
