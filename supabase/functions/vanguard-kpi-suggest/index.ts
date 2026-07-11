/**
 * @function vanguard-kpi-suggest
 * @trigger HTTP POST / Frontend weekly ritual (Direction tab)
 * @role Sugeruje kluczowe wskaźniki efektywności (KPI) dla celów i projektów użytkownika przy użyciu LLM.
 * @reads life_goals, projects, goal_kpis
 * @writes —
 * @calls deepseek-chat
 * @consumer Kreator celów w zakładce Direction w aplikacji
 * @status active
 */
import { serveJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";

// Auth note: serveJson implicitly enforces resolveUserScope
Deno.serve(serveJson(async (req, ctx) => {
  const body = await req.json().catch(() => ({}));
  const userId = ctx.userId ?? body.userId;
  if (!userId) throw new Error("userId required");

  const db = ctx.supabase;
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [lifeGoalsRes, projectsRes, existingKpisRes, stravaCheckRes, nutritionCheckRes] = await Promise.all([
    db.from("life_goals").select("goal_cialo, goal_duch, goal_konto, bhag_pillar").eq("user_id", userId).maybeSingle(),
    db.from("projects").select("name, goal").eq("user_id", userId).eq("status", "active"),
    db.from("goal_kpis").select("name, pillar").eq("user_id", userId),
    db.from("strava_activities").select("id").eq("user_id", userId).gte("start_date", thirtyDaysAgo).limit(1),
    db.from("daily_nutrition").select("date").eq("user_id", userId).limit(1),
  ]);
  if (lifeGoalsRes.error) console.warn("[kpi-suggest] life_goals query failed:", lifeGoalsRes.error.message);
  if (projectsRes.error) console.warn("[kpi-suggest] projects query failed:", projectsRes.error.message);
  if (existingKpisRes.error) console.warn("[kpi-suggest] goal_kpis query failed:", existingKpisRes.error.message);
  const lifeGoals = lifeGoalsRes.data;
  const projects = projectsRes.data;
  const existingKpis = existingKpisRes.data;
  const stravaCheck = stravaCheckRes.data;
  const nutritionCheck = nutritionCheckRes.data;

  const g = lifeGoals as any;
  const hasStrava = (stravaCheck ?? []).length > 0;
  const hasNutrition = (nutritionCheck ?? []).length > 0;

  const existingNames = (existingKpis ?? []).map((k: any) => k.name);
  const activeProjects = (projects ?? [])
    .map((p: any) => p.name + (p.goal ? ": " + p.goal : ""))
    .join("; ");

  const tracking: string[] = ["Oura (sen, HRV, odzysk — auto)"];
  if (hasStrava) tracking.push("Strava (biegi, km, tempo — auto)");
  if (hasNutrition) tracking.push("Dziennik posilkow (kcal, bialko — logowane)");

  const systemPrompt = "Jestes Antigravity - AI Jakuba. Zaproponuj PRAKTYCZNE tygodniowe KPI.\n\nZASADY:\n- Tylko metryki mierzalne co tydzien bez specjalnego sprzetu\n- Proxy zamiast idealow: obwod talii zamiast % tluszczu, serie treningowe zamiast sily max\n- Jesli dane sa auto-trackowane (Strava, Oura, log posilkow) - to preferuj, oznacz w reason\n- Unikaj metryk ktore juz istnieja w systemie\n- Max 3 propozycje na sfere\n- reason: 1 krotkie zdanie jak mierzyc i dlaczego ta metryka\n\nZwroc TYLKO JSON:\n{\"suggestions\": [{\"pillar\": \"cialo|duch|konto\", \"name\": \"...\", \"unit\": \"...\", \"higher_is_better\": true, \"reason\": \"...\"}]}";

  const userPrompt = "CELE:\n- Cialo: " + (g?.goal_cialo ?? "nie ustawione") +
    "\n- Duch: " + (g?.goal_duch ?? "nie ustawione") +
    "\n- Konto: " + (g?.goal_konto ?? "nie ustawione") +
    (g?.bhag_pillar ? "\nBHAG: " + g.bhag_pillar : "") +
    "\n\nAKTYWNE PROJEKTY: " + (activeProjects || "brak") +
    "\n\nDOSTEPNE ZRODLA DANYCH: " + tracking.join(", ") +
    "\n\nJUZ ISTNIEJA KPI (nie duplikuj): " + (existingNames.join(", ") || "brak");

  const { content } = await deepseekChat({
    apiKey,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    model: "deepseek-v4-flash",
    maxTokens: 600,
    temperature: 0.3,
    responseFormat: { type: "json_object" },
  });

  const parsed = parseJsonFromContent(content);
  if (!parsed) throw new Error("Invalid AI JSON: " + content.slice(0, 200));

  return parsed;
}));
