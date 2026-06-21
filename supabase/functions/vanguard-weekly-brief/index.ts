import { createServiceClient, corsHeaders, resolveUserScope } from "../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";

const toWarsaw = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });

function getWeekStart(): string {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
  const today = new Date(todayStr + "T12:00:00");
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(today);
  mon.setDate(today.getDate() + diff);
  return mon.toLocaleDateString("en-CA");
}

function nWeeksBack(ws: string, n: number): string {
  const d = new Date(ws + "T00:00:00");
  d.setDate(d.getDate() - 7 * n);
  return d.toLocaleDateString("en-CA");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { userId: scopeId } = await resolveUserScope(req, body.userId ?? null);
    const userId = scopeId ?? body.userId;
    if (!userId) throw new Error("userId required");

    const db = createServiceClient();
    const weekStart: string = body.weekStart ?? getWeekStart();
    const apiKey = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");

    const fourWeeksBack = nWeeksBack(weekStart, 4);
    const thirtyDaysAgo = toWarsaw(new Date(Date.now() - 30 * 86400000));
    const thirtyDaysAgoISO = new Date(Date.now() - 30 * 86400000).toISOString();

    const [
      { data: lifeGoals },
      { data: kpis },
      { data: entries },
      { data: reviews },
      { data: activeProjects },
      { data: doneProjects },
      { data: wins },
    ] = await Promise.all([
      db.from("life_goals").select("goal_cialo, goal_duch, goal_konto, bhag_pillar").eq("user_id", userId).maybeSingle(),
      db.from("goal_kpis").select("id, pillar, name, unit, higher_is_better").eq("user_id", userId).order("sort_order"),
      db.from("kpi_entries").select("kpi_id, value, week_start").eq("user_id", userId).gte("week_start", fourWeeksBack),
      db.from("weekly_kpi_reviews").select("week_start, what_worked, what_didnt_work").eq("user_id", userId).gte("week_start", fourWeeksBack).order("week_start"),
      db.from("projects").select("name, goal, deadline").eq("user_id", userId).eq("status", "active"),
      db.from("projects").select("name, retrospective_good, retrospective_improve, retrospective_rating").eq("user_id", userId).eq("status", "done").gte("updated_at", thirtyDaysAgoISO),
      db.from("daily_wins").select("plan_date, task_1").eq("user_id", userId).gte("plan_date", thirtyDaysAgo).order("plan_date", { ascending: false }),
    ]);

    // Streak
    // Walk Warsaw calendar-date strings directly (anchor once via toWarsaw, then step in
    // pure UTC-date-string space) instead of stepping a real Date by -1 day and re-projecting
    // through toWarsaw each time — a fixed 24h step over Warsaw's 23h/25h DST-transition days
    // skips or double-counts one date for about an hour twice a year, verified by exhaustive
    // scan (e.g. "now" at 2026-03-29T22:00Z silently jumps straight from 03-30 to 03-28).
    const filled = new Set((wins ?? []).filter((w: any) => w.task_1).map((w: any) => w.plan_date as string));
    let streak = 0;
    let sdStr = toWarsaw(new Date());
    for (let i = 0; i < 31; i++) {
      if (!filled.has(sdStr)) break;
      streak++;
      const d = new Date(sdStr + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      sdStr = d.toISOString().split('T')[0];
    }

    // KPI trends
    const entryMap: Record<string, Record<string, number | null>> = {};
    for (const e of (entries ?? [])) {
      if (!entryMap[e.week_start]) entryMap[e.week_start] = {};
      entryMap[e.week_start][e.kpi_id] = e.value;
    }

    const PILLAR_LABELS: Record<string, string> = { cialo: "Ciało", duch: "Duch", konto: "Konto" };
    const kpiLines: string[] = [];
    for (const pillar of ["cialo", "duch", "konto"]) {
      const pk = (kpis ?? []).filter((k: any) => k.pillar === pillar);
      if (!pk.length) continue;
      kpiLines.push(`\n${PILLAR_LABELS[pillar]}:`);
      for (const kpi of pk) {
        const thisVal: number | null = entryMap[weekStart]?.[kpi.id] ?? null;
        const prevVal: number | null = entryMap[nWeeksBack(weekStart, 1)]?.[kpi.id] ?? null;
        let trendStr = "";
        if (thisVal !== null && prevVal !== null) {
          const delta = thisVal - prevVal;
          const good = kpi.higher_is_better ? delta > 0 : delta < 0;
          trendStr = ` (${delta > 0 ? "+" : ""}${delta.toFixed(1)}${kpi.unit} vs poprz. ${good ? "✓" : "✗"})`;
        }
        const valStr = thisVal !== null ? `${thisVal}${kpi.unit}` : "brak danych";
        kpiLines.push(`  - ${kpi.name}: ${valStr}${trendStr}`);
      }
    }

    // Projects
    const nowMs = Date.now();
    const activeLines = (activeProjects ?? []).map((p: any) => {
      const daysLeft = p.deadline
        ? Math.round((new Date(p.deadline + "T00:00:00").getTime() - nowMs) / 86400000)
        : null;
      const parts: string[] = [`"${p.name}"`];
      if (daysLeft !== null) parts.push(daysLeft < 0 ? `PRZETERMINOWANY ${Math.abs(daysLeft)}d` : `deadline za ${daysLeft}d`);
      if (p.goal) parts.push(p.goal);
      return "  - " + parts.join(" · ");
    });

    const doneLines = (doneProjects ?? []).map((p: any) => {
      const parts: string[] = [`"${p.name}"`];
      if (p.retrospective_good) parts.push(`zadziałało: ${p.retrospective_good}`);
      if (p.retrospective_improve) parts.push(`poprawić: ${p.retrospective_improve}`);
      if (p.retrospective_rating) parts.push(`ocena ${p.retrospective_rating}/5`);
      return "  - " + parts.join(" · ");
    });

    const thisReview = (reviews ?? []).find((r: any) => r.week_start === weekStart);
    const g = lifeGoals as any;

    const systemPrompt = `Jesteś Antigravity — strategiczny AI Jakuba. Piszesz PO POLSKU, bezpośrednio na "Ty". Styl: krótki, konkretny, bez bullshitu. Zero ogólników — tylko co wynika z danych.

Zwróć TYLKO poprawny JSON (bez markdown, bez żadnego tekstu przed ani po):
{
  "cialo": "1-2 zdania oceny sfery Ciało na podstawie KPI i celów",
  "duch": "1-2 zdania oceny sfery Duch",
  "konto": "1-2 zdania oceny sfery Konto",
  "blocker": "1 zdanie — największy konkretny bloker tego tygodnia",
  "recommendation": "1 konkretna akcja do zrobienia w przyszłym tygodniu",
  "week_rating": <integer 1-5>,
  "week_rating_reason": "1 zdanie uzasadnienia oceny"
}`;

    const userPrompt = `Dziś: ${toWarsaw(new Date())}
Tydzień: ${weekStart}
Passa PowerList: ${streak} dni z rzędu

TWOJE CELE:
- Ciało: ${g?.goal_cialo ?? "nie ustawione"}
- Duch: ${g?.goal_duch ?? "nie ustawione"}
- Konto: ${g?.goal_konto ?? "nie ustawione"}${g?.bhag_pillar ? `\n- BHAG (priorytet #1): ${g.bhag_pillar}` : ""}

KPI:${kpiLines.join("\n") || "\nBrak KPI"}

AKTYWNE PROJEKTY:
${activeLines.join("\n") || "  Brak aktywnych projektów"}

UKOŃCZONE W OSTATNICH 30 DNIACH:
${doneLines.join("\n") || "  Brak"}

CO ZADZIAŁAŁO W TYM TYGODNIU:
${thisReview?.what_worked || "(nie wypełniono)"}

CO NIE ZADZIAŁAŁO:
${thisReview?.what_didnt_work || "(nie wypełniono)"}`;

    const { content } = await deepseekChat({
      apiKey,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "deepseek-v4-flash",
      maxTokens: 700,
      temperature: 0.25,
      responseFormat: { type: "json_object" },
    });

    const brief = parseJsonFromContent(content);
    if (!brief) throw new Error(`Invalid AI JSON: ${content.slice(0, 300)}`);

    const { error: upsertErr } = await db.from("weekly_kpi_reviews").upsert({
      user_id: userId,
      week_start: weekStart,
      ai_brief: brief,
    }, { onConflict: "user_id,week_start" });
    if (upsertErr) {
      console.error("[weekly-brief] Failed to save brief:", upsertErr);
      throw new Error(`DB error (weekly_kpi_reviews): ${upsertErr.message}`);
    }

    return new Response(JSON.stringify({ brief, weekStart }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    console.error("[vanguard-weekly-brief] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
