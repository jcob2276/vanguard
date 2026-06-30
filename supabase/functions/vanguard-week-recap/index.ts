/**
 * vanguard-week-recap v5
 *
 * phase "before": AI czyta wszystko → narracja tygodnia (nie pattern-detection)
 *   Zwraca {narrative, longterm_motif, question}
 *
 * phase "after": po refleksji usera → sprawdza narrację vs fakty,
 *   generuje 3 deepening questions + materiał na Block 5 (sugestie per filar)
 *   Zwraca {narrative_check, deepening_questions, block5_material}
 */
import { createServiceClient, corsHeaders, resolveUserScope } from "../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

const PILLAR_LABEL: Record<string, string> = { cialo: "Ciało", duch: "Duch", konto: "Konto" };

function avgBedtimeLabel(timestamps: string[]): string | null {
  const minutes = timestamps.map((ts) => {
    const d = new Date(ts);
    const h = parseInt(d.toLocaleString("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", hour12: false }), 10);
    const m = parseInt(d.toLocaleString("en-GB", { timeZone: "Europe/Warsaw", minute: "2-digit" }), 10);
    const total = h * 60 + m;
    return h < 12 ? total + 24 * 60 : total;
  });
  const avg = mean(minutes);
  if (avg === null) return null;
  const wrapped = Math.round(avg) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function isVoiceEntry(source: string | null, content: string | null): boolean {
  if (source === "identity_vault") return true;
  if (source === "telegram" && content && content.length > 150) return true;
  return false;
}

async function gatherWeekFacts(db: any, userId: string, weekStart: string) {
  const weekEnd = addDaysStr(weekStart, 6);

  const [
    winsRes, ouraRes, nutrRes, targetRes, runsRes, habitLogsRes,
    staleHighRes, linksRes, thisWeekStreamRes, sectionsRes, doneTasksRes, projectsRes,
    kpisRes, kpiEntriesRes, reconciliationsRes,
  ] = await Promise.all([
    db.from("daily_wins")
      .select("date, task_1, task_2, task_3, task_4, task_5, category_1, category_2, category_3, category_4, category_5, done_1, done_2, done_3, done_4, done_5, day_note")
      .eq("user_id", userId).gte("date", weekStart).lte("date", weekEnd).order("date"),
    db.from("oura_daily_summary").select("date, total_sleep_hours, bedtime_timestamp, readiness_score")
      .eq("user_id", userId).gte("date", weekStart).lte("date", weekEnd),
    db.from("daily_nutrition").select("date, calories, protein")
      .eq("user_id", userId).gte("date", weekStart).lte("date", weekEnd),
    db.from("nutrition_targets").select("target_kcal").eq("user_id", userId)
      .order("date", { ascending: false }).limit(1).maybeSingle(),
    db.from("strava_activities").select("start_date, name, distance, sport_type")
      .eq("user_id", userId).gte("start_date", weekStart).lte("start_date", weekEnd + "T23:59:59"),
    db.from("habit_logs").select("date, logged_at, final_stimulus, context_note")
      .eq("user_id", userId).gte("date", weekStart).lte("date", weekEnd),
    db.from("todo_items").select("title, priority, created_at").eq("user_id", userId)
      .eq("status", "open").eq("priority", "high").order("created_at", { ascending: true }),
    db.from("vanguard_links").select("status").eq("user_id", userId).eq("status", "unread"),
    db.from("vanguard_stream")
      .select("source, content, timestamp, importance_score, classification")
      .eq("user_id", userId)
      .gte("timestamp", weekStart + "T00:00:00")
      .lte("timestamp", weekEnd + "T23:59:59")
      .or("source.eq.identity_vault,source.eq.telegram,source.eq.eval_interview")
      .order("timestamp"),
    db.from("todo_sections").select("id, name, project_id").eq("user_id", userId).eq("is_archived", false),
    db.from("todo_items")
      .select("title, status, section_id, updated_at")
      .eq("user_id", userId)
      .in("status", ["done", "dropped"])
      .gte("updated_at", weekStart + "T00:00:00")
      .lte("updated_at", weekEnd + "T23:59:59"),
    db.from("projects").select("id, name, goal, status").eq("user_id", userId).eq("status", "active"),
    db.from("goal_kpis").select("id, name, unit, target, project_id, higher_is_better").eq("user_id", userId),
    db.from("kpi_entries").select("kpi_id, value").eq("user_id", userId).eq("week_start", weekStart),
    db.from("daily_reconciliations")
      .select("date, day_score, mode, morning_action, midday_status, midday_blocker, planning_summary, user_response")
      .eq("user_id", userId).gte("date", weekStart).lte("date", weekEnd).order("date"),
  ]);

  // PowerList
  const wins = winsRes.data ?? [];
  const pillarTally: Record<string, { done: number; total: number }> = {
    cialo: { done: 0, total: 0 }, duch: { done: 0, total: 0 }, konto: { done: 0, total: 0 },
  };
  const dayLines: string[] = [];
  for (const w of wins as any[]) {
    const parts: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const cat = w[`category_${i}`];
      const task = w[`task_${i}`];
      if (!task) continue;
      const done = !!w[`done_${i}`];
      parts.push(`${task}${cat && PILLAR_LABEL[cat] ? ` [${PILLAR_LABEL[cat]}]` : ""}: ${done ? "✓" : "✗"}`);
      if (cat && pillarTally[cat]) {
        pillarTally[cat].total++;
        if (done) pillarTally[cat].done++;
      }
    }
    if (parts.length) {
      const note = w.day_note ? ` [nota: ${String(w.day_note).slice(0, 120)}]` : "";
      dayLines.push(`${w.date}: ${parts.join(" · ")}${note}`);
    }
  }

  const oura = ouraRes.data ?? [];
  const sleepHrs = mean(oura.map((o: any) => o.total_sleep_hours).filter(Boolean));
  const bedtime = avgBedtimeLabel(oura.map((o: any) => o.bedtime_timestamp).filter(Boolean));
  const readiness = oura.map((o: any) => ({ date: o.date, score: o.readiness_score })).filter((r: any) => r.score != null);

  const avgKcal = mean((nutrRes.data ?? []).map((n: any) => n.calories).filter(Boolean));
  const avgProtein = mean((nutrRes.data ?? []).map((n: any) => n.protein).filter(Boolean));
  const targetKcal = targetRes.data?.target_kcal ?? null;

  const runs = (runsRes.data ?? []) as any[];
  const totalKm = runs.reduce((s, r) => s + (r.distance || 0), 0) / 1000;

  const habitLines = ((habitLogsRes.data ?? []) as any[]).map((l) => {
    const t = l.logged_at
      ? new Date(l.logged_at).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      : l.date;
    return `${t}${l.final_stimulus ? ` — ${l.final_stimulus}` : ""}${l.context_note ? ` (${l.context_note})` : ""}`;
  });

  const staleHighLines = ((staleHighRes.data ?? []) as any[]).slice(0, 8).map((t) => {
    const ageDays = Math.round((new Date(weekEnd + "T12:00:00Z").getTime() - new Date(t.created_at).getTime()) / 86400000);
    return `"${t.title}" — ${ageDays}d bez ruchu`;
  });

  const allStream = (thisWeekStreamRes.data ?? []) as any[];
  const thisWeekVoice = allStream.filter((s) => isVoiceEntry(s.source, s.content));
  const thisWeekShortMsgs = allStream.filter((s) => s.source === "telegram" && s.content?.length <= 150);

  const sections = (sectionsRes.data ?? []) as any[];
  const sectionMap: Record<string, string> = {};
  for (const s of sections) sectionMap[s.id] = s.name;

  const doneTasks = ((doneTasksRes.data ?? []) as any[]).map((t) => ({
    title: t.title, status: t.status,
    section: t.section_id ? (sectionMap[t.section_id] ?? null) : null,
  }));

  const activeProjects = (projectsRes.data ?? []) as any[];

  // Map KPIs
  const projectMap: Record<string, string> = {};
  for (const p of activeProjects) projectMap[p.id] = p.name;

  const kpis = kpisRes.data ?? [];
  const kpiEntries = kpiEntriesRes.data ?? [];
  const valueByKpi = new Map(kpiEntries.map((e: any) => [e.kpi_id, e.value]));
  const kpiValuesList = kpis.map((k: any) => ({
    name: k.name,
    unit: k.unit,
    value: valueByKpi.get(k.id) ?? null,
    target: k.target,
    projectName: k.project_id ? (projectMap[k.project_id] ?? null) : null,
    higherIsBetter: k.higher_is_better,
  }));

  // Map Reconciliations
  const reconciliations = reconciliationsRes.data ?? [];
  const reconciliationList = reconciliations.map((r: any) => ({
    date: r.date,
    score: r.day_score,
    mode: r.mode,
    morningAction: r.morning_action,
    middayStatus: r.midday_status,
    middayBlocker: r.midday_blocker,
    summary: r.planning_summary,
    userResponse: r.user_response,
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
  };
}

function factsToPrompt(f: Awaited<ReturnType<typeof gatherWeekFacts>>): string {
  const pillarLines = Object.entries(f.pillarTally)
    .map(([k, v]) => `- ${PILLAR_LABEL[k]}: ${v.done}/${v.total} dni zrobione`)
    .join("\n") || "(brak)";

  const readinessLine = f.readiness.length
    ? f.readiness.map((r: any) => `${r.date}=${r.score}`).join(", ")
    : "brak danych";

  const doneBlock = f.doneTasks.length
    ? f.doneTasks.map((t) => `${t.status === "done" ? "✓" : "↯"} ${t.title}${t.section ? ` [${t.section}]` : ""}`).join("\n")
    : "(brak)";

  const voiceBlock = f.thisWeekVoice.length
    ? f.thisWeekVoice.map((v) => {
        const d = new Date(v.timestamp).toLocaleDateString("pl-PL", {
          timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "short",
        });
        const src = v.source === "identity_vault" ? "głosówka" : v.source === "eval_interview" ? "wywiad AI" : "telegram-voice";
        return `--- ${d} [${src}${v.classification ? `·${v.classification}` : ""}] ---\n${String(v.content).slice(0, 600)}`;
      }).join("\n\n")
    : "(brak głosówek w tym tygodniu)";

  const shortMsgs = f.thisWeekShortMsgs.length
    ? "\n\nKRÓTKIE WIADOMOŚCI TELEGRAM:\n" + f.thisWeekShortMsgs.map((s) => {
        const d = new Date(s.timestamp).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric" });
        return `${d}: ${s.content}`;
      }).join("\n")
    : "";

  const projectsBlock = f.activeProjects.length
    ? f.activeProjects.map((p) => `- ${p.name}${p.goal ? ` (cel: ${p.goal})` : ""}`).join("\n")
    : "(brak)";

  const kpisBlock = f.kpiValuesList.length
    ? f.kpiValuesList.map((k: any) => {
        const valStr = k.value !== null ? String(k.value) : "niezalogowane";
        const tgtStr = k.target !== null ? ` / cel: ${k.target}` : "";
        const unitStr = k.unit ? ` ${k.unit}` : "";
        const projStr = k.projectName ? ` [Projekt: ${k.projectName}]` : "";
        return `- ${k.name}: ${valStr}${tgtStr}${unitStr}${projStr}`;
      }).join("\n")
    : "(brak)";

  const reconBlock = f.reconciliationList.length
    ? f.reconciliationList.map((r: any) => {
        const parts = [
          `- Samopoczucie/Ocena: ${r.score != null ? `${r.score}/10` : "brak oceny"} [Tryb: ${r.mode ?? "brak"}]`,
        ];
        if (r.morningAction) parts.push(`  Intencja poranna: ${r.morningAction}`);
        if (r.middayStatus || r.middayBlocker) {
          parts.push(`  Midday Check-in: Status=${r.middayStatus ?? "brak"}${r.middayBlocker ? `, Blocker=${r.middayBlocker}` : ""}`);
        }
        if (r.summary) {
          const textSummary = typeof r.summary === "object" ? JSON.stringify(r.summary) : String(r.summary);
          parts.push(`  Podsumowanie wieczorne AI: ${textSummary}`);
        }
        if (r.userResponse) parts.push(`  Tekst wieczorny Jakuba (raw): ${r.userResponse}`);
        return `--- ${r.date} ---\n${parts.join("\n")}`;
      }).join("\n\n")
    : "(brak)";

  return `Tydzień: ${f.weekStart} – ${f.weekEnd}

POWERLIST per dzień:
${f.dayLines.join("\n") || "(brak)"}

POWERLIST per filar:
${pillarLines}

SEN: śr. ${f.sleepHrs != null ? f.sleepHrs.toFixed(1) + "h" : "brak"}, śr. zaśnięcie ${f.bedtime ?? "brak"}
READINESS (Oura): ${readinessLine}

JEDZENIE: śr. ${f.avgKcal != null ? Math.round(f.avgKcal) + " kcal" : "brak"}${f.targetKcal ? ` (cel ${f.targetKcal})` : ""}, białko śr. ${f.avgProtein != null ? Math.round(f.avgProtein) + "g" : "brak"}, dni z logiem: ${f.nutritionDays}

TRENING (Strava): ${f.runCount} aktywności, ${f.totalKm.toFixed(1)}km${f.runs.length ? " — " + f.runs.map((r) => `${r.name || r.type}: ${r.km}km`).join(", ") : ""}

NAWYK(I) — wystąpienia:
${f.habitLines.join("\n") || "(brak)"}

TASKI ZAMKNIĘTE / ODRZUCONE W TYM TYGODNIU:
${doneBlock}

ZALEGŁE HIGH PRIORITY (bez ruchu):
${f.staleHighLines.join("\n") || "(brak)"}

AKTYWNE PROJEKTY:
${projectsBlock}

KPI PROJEKTÓW / CELÓW (zalogowane wartości tygodniowe):
${kpisBlock}

PODSUMOWANIA DZIENNE (Tryb dnia + Refleksja wieczorna):
${reconBlock}

POCKET: ${f.unreadLinksCount} niezaczytanych linków

GŁOSÓWKI I NOTATKI JAKUBA (jego autentyczny głos — to jest główne źródło):
${voiceBlock}${shortMsgs}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { userId: scopedUserId } = await resolveUserScope(req, body.userId ?? null);
    const userId = scopedUserId;
    if (!userId) throw new Error("userId required");
    const weekStart: string = body.weekStart;
    if (!weekStart) throw new Error("weekStart required");
    const phase: string = body.phase;
    if (phase !== "before" && phase !== "after") throw new Error("phase must be 'before' or 'after'");

    const db = createServiceClient();
    const apiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");

    const facts = await gatherWeekFacts(db, userId, weekStart);
    const factsBlock = factsToPrompt(facts);

    // ── PHASE BEFORE ────────────────────────────────────────────────────────
    if (phase === "before") {
      const eightWeeksBack = addDaysStr(weekStart, -56);
      const prevWeekStart = addDaysStr(weekStart, -7);

      const [prevReviewsRes, historicalStreamRes] = await Promise.all([
        db.from("weekly_reviews")
          .select("week_start, proud_of, do_differently, sabotage, obligation, week_highlight, week_regret, new_belief, pillar_scores, week_intention, week_goal_cialo, week_goal_duch, week_goal_konto, ai_recap")
          .eq("user_id", userId).gte("week_start", eightWeeksBack).lt("week_start", weekStart)
          .order("week_start"),
        db.from("vanguard_stream")
          .select("timestamp, source, classification, content, importance_score")
          .eq("user_id", userId)
          .gte("timestamp", eightWeeksBack)
          .lt("timestamp", weekStart + "T00:00:00")
          .or("importance_score.gte.5,source.eq.identity_vault")
          .order("importance_score", { ascending: false })
          .limit(40),
      ]);

      const prevReviews = (prevReviewsRes.data ?? []) as any[];
      const lastWeekReview = prevReviews.find((r) => r.week_start === prevWeekStart);

      // Build context for AI
      const lastWeekPlan = lastWeekReview ? [
        lastWeekReview.week_intention && `Intencja: ${lastWeekReview.week_intention}`,
        lastWeekReview.week_goal_cialo && `Cel Ciało: ${lastWeekReview.week_goal_cialo}`,
        lastWeekReview.week_goal_duch && `Cel Duch: ${lastWeekReview.week_goal_duch}`,
        lastWeekReview.week_goal_konto && `Cel Konto: ${lastWeekReview.week_goal_konto}`,
      ].filter(Boolean).join(" · ") : null;

      const reviewHistory = prevReviews.slice(-4).map((r) => {
        const scores = r.pillar_scores ?? {};
        const parts = [
          scores.cialo && `Ciało ${scores.cialo}`,
          scores.duch && `Duch ${scores.duch}`,
          scores.konto && `Konto ${scores.konto}`,
          r.obligation && `musi zejść: ${r.obligation}`,
          r.week_regret && `żałuję: ${r.week_regret}`,
        ].filter(Boolean);
        return parts.length ? `${r.week_start}: ${parts.join(" · ")}` : null;
      }).filter(Boolean);

      const historicalVoice = ((historicalStreamRes.data ?? []) as any[])
        .filter((s) => isVoiceEntry(s.source, s.content))
        .slice(0, 20)
        .map((s) => {
          const d = new Date(s.timestamp).toLocaleDateString("pl-PL", {
            timeZone: "Europe/Warsaw", day: "numeric", month: "short", year: "numeric",
          });
          return `${d}: ${String(s.content).slice(0, 250)}`;
        });

      const systemPrompt = `Jesteś Antigravity — prywatny coach Jakuba, znasz go od środka. Piszesz PO POLSKU, bezpośrednio, na "Ty".

TWOJE ZADANIE: Napisz narrację tygodnia Jakuba — nie listę faktów, nie statystyki. Historię. Jakby ktoś kto obserwował jego tydzień z zewnątrz opowiadał mu co widział.

ZASADY:
1. GŁOSÓWKI to twój główny materiał — to najbardziej autentyczny głos Jakuba. Cytuj konkretne frazy, podaj daty. Skonfrontuj to z tym co pokazują dane.
2. Szukaj SPRZECZNOŚCI: co mówił że chce robić vs co faktycznie zrobił. Co dane pokazują vs co głosówki mówią.
3. Pomiń oczywiste ("miałeś 3 treningi") — skup się na tym czego Oczy nie widzą: wzorce, unikanie, energia, strach ukryty w zachowaniu.
4. Nawyki: jeśli wystąpiły — kiedy, co je poprzedziło, co to mówi o stanie wewnętrznym.
5. Jeśli brak głosówek — opieraj się na danych i historii.
6. "longterm_motif": tylko jeśli WIDZISZ TEN SAM MOTYW powtarzający się w historii głosówek lub przeglądów (cytuj daty). Null jeśli nie ma wyraźnego powtórzenia.
7. "question": JEDNO konkretne pytanie — nie "jak się czujesz?" ale coś zakorzenionego w konkretnej głosówce lub sprzeczności którą widzisz.

Długość narracji: 6-10 zdań. Nie ogólnikuj. Bądź konkretny jak chirurg.

Zwróć TYLKO JSON: {"narrative": "...", "longterm_motif": "..." | null, "question": "..."}`;

      const userPrompt = `${factsBlock}

PLAN Z ZESZŁEGO TYGODNIA (${prevWeekStart}): ${lastWeekPlan ?? "(brak planu)"}

HISTORIA OSTATNICH TYGODNI:
${reviewHistory.join("\n") || "(brak historii)"}

GŁOSÓWKI Z POPRZEDNICH TYGODNI (dla kontekstu długoterminowego):
${historicalVoice.join("\n\n") || "(brak)"}`;

      const { content } = await deepseekChat({
        apiKey, model: "deepseek-v4-flash", maxTokens: 2000, temperature: 0.3,
        responseFormat: { type: "json_object" },
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      });

      const parsed = parseJsonFromContent(content);
      if (!parsed || typeof parsed.narrative !== "string" || typeof parsed.question !== "string") {
        throw new Error(`Invalid AI JSON phase1: ${content.slice(0, 300)}`);
      }

      const phase1 = {
        narrative: parsed.narrative,
        longterm_motif: typeof parsed.longterm_motif === "string" ? parsed.longterm_motif : null,
        question: parsed.question,
      };

      const { data: existing } = await db.from("weekly_reviews").select("ai_recap").eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
      const mergedRecap = { ...(existing?.ai_recap ?? {}), phase1 };
      await db.from("weekly_reviews").upsert(
        { user_id: userId, week_start: weekStart, ai_recap: mergedRecap },
        { onConflict: "user_id,week_start" },
      );

      return new Response(JSON.stringify({ phase1 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── PHASE AFTER ─────────────────────────────────────────────────────────
    const { data: review } = await db.from("weekly_reviews")
      .select("proud_of, do_differently, sabotage, obligation, week_highlight, week_regret, new_belief, pillar_scores, ai_recap")
      .eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
    if (!review) throw new Error("Brak zapisanej refleksji — zapisz ją najpierw.");

    const scores = review.pillar_scores ?? {};

    const systemPrompt = `Jesteś Antigravity — prywatny coach Jakuba. Piszesz PO POLSKU, bezpośrednio, na "Ty".

ZADANIA:
1. "narrative_check": Skonfrontuj to co Jakub napisał z tym co widzisz w danych i głosówkach. Gdzie jego narracja zgadza się z rzeczywistością, gdzie się rozjeżdża? Cytuj jego własne słowa. Max 3-4 zdania. Bądź bezpośredni — nie oszczędzaj.

2. "deepening_questions": dokładnie 3 pytania. ZAKAZ pytań ogólnych. Każde musi nawiązywać do KONKRETU z jego odpowiedzi lub głosówek — coś czego NIE POWIEDZIAŁ WPROST, co wynika z tego co napisał, co jest między wierszami. Pytania które wywołują dyskomfort bo trafiają w coś prawdziwego.

3. "block5_material": dla każdego filaru — JEDNA konkretna obserwacja z tego tygodnia która może pomóc Jakubowi zdecydować co zaplanować. Nie plan — surowy materiał. Fakty + kontekst z głosówek. Max 2 zdania per filar.

Zwróć TYLKO JSON:
{"narrative_check": "...", "deepening_questions": ["...", "...", "..."], "block5_material": {"cialo": "...", "duch": "...", "konto": "..."}}`;

    const userPrompt = `${factsBlock}

OCENY WŁASNE JAKUBA (1-10): Ciało ${scores.cialo ?? "?"}, Duch ${scores.duch ?? "?"}, Konto ${scores.konto ?? "?"}

Q1 — Co musi zejść z głowy: ${review.obligation || "(nie wypełnił)"}
Q2 — Gdzie zawiodłem siebie: ${review.do_differently || "(nie wypełnił)"}
Q3 — Czego mi brakowało: ${review.proud_of || "(nie wypełnił)"}
Q4 — Co unikałem i co za tym stoi: ${review.sabotage || "(nie wypełnił)"}
Q5 — Co dało mi energię / zabrało: ${review.week_highlight || "(nie wypełnił)"}
Q6 — Czego żałuję: ${review.week_regret || "(nie wypełnił)"}
Q7 — Co myślę inaczej niż tydzień temu: ${review.new_belief || "(nie wypełnił)"}

NARRACJA WYKRYTA WCZEŚNIEJ (Blok 1): ${review.ai_recap?.phase1?.narrative ?? "(brak)"}`;

    const { content } = await deepseekChat({
      apiKey, model: "deepseek-v4-flash", maxTokens: 2500, temperature: 0.3,
      responseFormat: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    });

    const parsed = parseJsonFromContent(content);
    if (
      !parsed ||
      typeof parsed.narrative_check !== "string" ||
      !Array.isArray(parsed.deepening_questions) ||
      !parsed.block5_material
    ) {
      throw new Error(`Invalid AI JSON phase2: ${content.slice(0, 300)}`);
    }

    const phase2 = {
      narrative_check: parsed.narrative_check,
      deepening_questions: parsed.deepening_questions.slice(0, 3).map(String),
      block5_material: {
        cialo: String((parsed.block5_material as any).cialo ?? ""),
        duch: String((parsed.block5_material as any).duch ?? ""),
        konto: String((parsed.block5_material as any).konto ?? ""),
      },
    };

    const { data: existingForMerge } = await db.from("weekly_reviews").select("ai_recap").eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
    const mergedRecap = { ...(existingForMerge?.ai_recap ?? {}), phase2 };
    await db.from("weekly_reviews").upsert(
      { user_id: userId, week_start: weekStart, ai_recap: mergedRecap },
      { onConflict: "user_id,week_start" },
    );

    return new Response(JSON.stringify({ phase2 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[vanguard-week-recap] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
