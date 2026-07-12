import { createServiceClient, resolveUserScope } from "../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";
import { addDaysStr } from "./helpers.ts";
import { gatherWeekFacts } from "./gatherWeekFacts.ts";
import { factsToPrompt } from "./prompts.ts";

export async function runWeeklyRecap(req: Request): Promise<unknown> {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId: scopedUserId } = await resolveUserScope(req, body.userId ?? null);
    const userId = scopedUserId;
    if (!userId) throw new Error("userId required");
    const phase: string = body.phase;
    if (phase !== "before" && phase !== "after" && phase !== "month") throw new Error("phase must be 'before', 'after', or 'month'");

    const db = createServiceClient();
    const apiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");

    // ── PHASE MONTH ─────────────────────────────────────────────────────────
    if (phase === "month") {
      const monthStart: string = body.monthStart;
      if (!monthStart) throw new Error("monthStart required for phase month");
      const monthEndDate = new Date(monthStart + "T12:00:00Z");
      monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1);
      monthEndDate.setUTCDate(0);
      const monthEndStr = monthEndDate.toISOString().split("T")[0];

      const [reviewsRes, winsRes, kpiRes] = await Promise.all([
        db.from("weekly_reviews").select("week_start, review_completed_at, pillar_scores, week_intention, proud_of, week_regret").eq("user_id", userId).gte("week_start", addDaysStr(monthStart, -6)).lte("week_start", monthEndStr),
        db.from("daily_wins").select("date, result, task_1, done_1, task_2, done_2, task_3, done_3, task_4, done_4, task_5, done_5").eq("user_id", userId).gte("date", monthStart).lte("date", monthEndStr),
        db.from("kpi_entries").select("week_start, value").eq("user_id", userId).gte("week_start", addDaysStr(monthStart, -6)).lte("week_start", monthEndStr),
      ]);

      const reviews = reviewsRes.data ?? [];
      const wins = winsRes.data ?? [];
      const kpis = kpiRes.data ?? [];
      const weeksReviewed = reviews.filter((r: any) => r.review_completed_at).length;
      const zDays = wins.filter((w: any) => w.result === "Z").length;
      const pDays = wins.filter((w: any) => w.result === "P").length;

      const factsBlock = `MIESIĄC ${monthStart} – ${monthEndStr}\nTygodnie z refleksją: ${weeksReviewed}\nDni Z/P: ${zDays}/${pDays}\nWpisy KPI (tygodnie): ${new Set(kpis.map((k: any) => k.week_start)).size}\n\nTygodniowe refleksje (skrót): ${reviews.slice(-4).map((r: any) => `${r.week_start}: ${r.week_intention || r.proud_of || "(brak)"}`).join(" | ") || "(brak)"}`;

      const systemPrompt = `Jesteś Antigravity — prywatny coach Jakuba. Piszesz PO POLSKU, bezpośrednio, na "Ty".
Napisz narrację MIESIĄCA — wzorce, sprzeczności, energia. Nie listę statystyk.
6-8 zdań. "longterm_motif" tylko jeśli motyw wracał wielokrotnie. "question" — jedno ostre pytanie z konkretu.
Zwróć TYLKO JSON: {"narrative": "...", "longterm_motif": "..." | null, "question": "..."}`;

      const { content } = await deepseekChat({ apiKey, model: "deepseek-v4-flash", maxTokens: 2000, temperature: 0.3, responseFormat: { type: "json_object" }, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: factsBlock }] });

      const parsed = parseJsonFromContent(content);
      if (!parsed || typeof parsed.narrative !== "string" || typeof parsed.question !== "string") throw new Error(`Invalid AI JSON month: ${content.slice(0, 300)}`);

      const phase1 = { narrative: parsed.narrative, longterm_motif: typeof parsed.longterm_motif === "string" ? parsed.longterm_motif : null, question: parsed.question };

      const { data: existing } = await db.from("monthly_reviews").select("ai_recap").eq("user_id", userId).eq("month_start", monthStart).maybeSingle();
      const mergedRecap = { ...(existing?.ai_recap ?? {}), phase1 };
      await db.from("monthly_reviews").upsert({ user_id: userId, month_start: monthStart, ai_recap: mergedRecap }, { onConflict: "user_id,month_start" });

      return { phase1 };
    }

    const weekStart: string = body.weekStart;
    if (!weekStart) throw new Error("weekStart required");

    const facts = await gatherWeekFacts(db, userId, weekStart);
    const factsBlock = factsToPrompt(facts);

    // ── PHASE BEFORE ────────────────────────────────────────────────────────
    if (phase === "before") {
      const eightWeeksBack = addDaysStr(weekStart, -56);
      const prevWeekStart = addDaysStr(weekStart, -7);

      const [prevReviewsRes, historicalStreamRes] = await Promise.all([
        db.from("weekly_reviews").select("week_start, proud_of, do_differently, sabotage, obligation, week_highlight, week_regret, new_belief, pillar_scores, week_intention, week_goal_cialo, week_goal_duch, week_goal_konto, ai_recap").eq("user_id", userId).gte("week_start", eightWeeksBack).lt("week_start", weekStart).order("week_start"),
        db.from("vanguard_stream").select("timestamp, source, classification, content, importance_score").eq("user_id", userId).gte("timestamp", eightWeeksBack).lt("timestamp", weekStart + "T00:00:00").or("importance_score.gte.5,source.eq.identity_vault").order("importance_score", { ascending: false }).limit(40),
      ]);

      const prevReviews = (prevReviewsRes.data ?? []) as Record<string, unknown>[];
      const lastWeekReview = prevReviews.find((r) => r.week_start === prevWeekStart);

      const lastWeekPlan = lastWeekReview ? [
        lastWeekReview.week_intention && `Intencja: ${lastWeekReview.week_intention}`,
        lastWeekReview.week_goal_cialo && `Cel Ciało: ${lastWeekReview.week_goal_cialo}`,
        lastWeekReview.week_goal_duch && `Cel Duch: ${lastWeekReview.week_goal_duch}`,
        lastWeekReview.week_goal_konto && `Cel Konto: ${lastWeekReview.week_goal_konto}`,
      ].filter(Boolean).join(" · ") : null;

      const reviewHistory = prevReviews.slice(-4).map((r) => {
        const scores = (r.pillar_scores ?? {}) as Record<string, unknown>;
        const parts = [scores.cialo && `Ciało ${scores.cialo}`, scores.duch && `Duch ${scores.duch}`, scores.konto && `Konto ${scores.konto}`, r.obligation && `musi zejść: ${r.obligation}`, r.week_regret && `żałuję: ${r.week_regret}`];
        return parts.length ? `${r.week_start}: ${parts.filter(Boolean).join(" · ")}` : null;
      }).filter(Boolean);

      const historicalVoice = ((historicalStreamRes.data ?? []) as Record<string, unknown>[]).filter((s) => s.source === "identity_vault" || (s.source === "telegram" && String(s.content ?? "").length > 150)).slice(0, 20).map((s) => {
        const d = new Date(s.timestamp as string).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "short", year: "numeric" });
        return `${d}: ${String(s.content).slice(0, 250)}`;
      });

      const systemPrompt = `Jesteś Antigravity — prywatny coach Jakuba, znasz go od środka. Piszesz PO POLSKU, bezpośrednio, na "Ty".
TWOJE ZADANIE: Napisz narrację tygodnia Jakuba — nie listę faktów, nie statystyki. Historię.
ZASADY:
1. GŁOSÓWKI to twój główny materiał. Cytuj konkretne frazy, podaj daty. Skonfrontuj z danymi.
2. Szukaj SPRZECZNOŚCI: co mówił że chce vs co zrobił.
3. Pomiń oczywiste — skup się na wzorcach, unikaniu, energii.
4. "longterm_motif": tylko jeśli WIDZISZ TEN SAM MOTYW w historii. Null jeśli nie ma.
5. "question": JEDNO konkretne pytanie zakorzenione w konkretnej głosówce.
Długość: 6-10 zdań.
Zwróć TYLKO JSON: {"narrative": "...", "longterm_motif": "..." | null, "question": "..."}`;

      const userPrompt = `${factsBlock}\n\nPLAN Z ZESZŁEGO TYGODNIA (${prevWeekStart}): ${lastWeekPlan ?? "(brak planu)"}\n\nHISTORIA OSTATNICH TYGODNI:\n${reviewHistory.join("\n") || "(brak historii)"}\n\nGŁOSÓWKI Z POPRZEDNICH TYGODNI:\n${historicalVoice.join("\n\n") || "(brak)"}`;

      const { content } = await deepseekChat({ apiKey, model: "deepseek-v4-flash", maxTokens: 2000, temperature: 0.3, responseFormat: { type: "json_object" }, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] });

      const parsed = parseJsonFromContent(content);
      if (!parsed || typeof parsed.narrative !== "string" || typeof parsed.question !== "string") throw new Error(`Invalid AI JSON phase1: ${content.slice(0, 300)}`);

      const phase1 = { narrative: parsed.narrative, longterm_motif: typeof parsed.longterm_motif === "string" ? parsed.longterm_motif : null, question: parsed.question };

      const { data: existing } = await db.from("weekly_reviews").select("ai_recap").eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
      const mergedRecap = { ...(existing?.ai_recap ?? {}), phase1 };
      await db.from("weekly_reviews").upsert({ user_id: userId, week_start: weekStart, ai_recap: mergedRecap }, { onConflict: "user_id,week_start" });

      return { phase1 };
    }

    // ── PHASE AFTER ─────────────────────────────────────────────────────────
    const { data: review } = await db.from("weekly_reviews")
      .select("proud_of, do_differently, sabotage, obligation, week_highlight, week_regret, new_belief, pillar_scores, ai_recap, week_intention, week_goal_cialo, week_goal_duch, week_goal_konto")
      .eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
    if (!review) throw new Error("Brak zapisanej refleksji — zapisz ją najpierw.");

    const scores = review.pillar_scores ?? {};
    const weekPlanLines = [
      review.week_intention && `Intencja: ${review.week_intention}`,
      review.week_goal_cialo && `Cel Ciało: ${review.week_goal_cialo}`,
      review.week_goal_duch && `Cel Duch: ${review.week_goal_duch}`,
      review.week_goal_konto && `Cel Konto: ${review.week_goal_konto}`,
    ].filter(Boolean).join(" · ") || "(brak planu na ten tydzień)";

    const systemPrompt = `Jesteś Antigravity — prywatny coach Jakuba. Piszesz PO POLSKU, bezpośrednio, na "Ty".
ZADANIA:
1. "narrative_check": Skonfrontuj to co Jakub napisał z danymi i głosówkami. Gdzie narracja zgadza się, gdzie się rozjeżdża? Cytuj jego własne słowa. Max 3-4 zdania.
2. "deepening_questions": dokładnie 3 pytania. Każde musi nawiązywać do KONKRETU z jego odpowiedzi — coś czego NIE POWIEDZIAŁ WPROST. Pytania które wywołują dyskomfort bo trafiają w coś prawdziwego.
3. "block5_material": dla każdego filaru (cialo, duch, konto) — JEDNA konkretna obserwacja do planowania NASTĘPNEGO tygodnia. OPARTA na KPI, PowerList, plan vs wykonanie, TEMAT MIESIĄCA i CEL SPRINTU. Max 2 zdania per filar.
Zwróć TYLKO JSON: {"narrative_check": "...", "deepening_questions": ["...", "...", "..."], "block5_material": {"cialo": "...", "duch": "...", "konto": "..."}}`;

    const weekStep = review.week_intention?.trim() || null;
    const sprintBridge = facts.sprintGoal ? `Sprint: ${facts.sprintGoal} — ten tydzień jeden krok: ${weekStep || "—"}` : null;

    const userPrompt = `${factsBlock}\n\n${facts.monthTheme ? `TEMAT MIESIĄCA: ${facts.monthTheme}\n` : ""}${sprintBridge ? `MOST SPRINT→TYDZIEŃ: ${sprintBridge}\n` : ""}PLAN TEGO TYGODNIA: ${weekPlanLines}\n\nOCENY WŁASNE JAKUBA (1-10): Ciało ${scores.cialo ?? "?"}, Duch ${scores.duch ?? "?"}, Konto ${scores.konto ?? "?"}\n\nQ1 — Co musi zejść: ${review.obligation || "(nie wypełnił)"}\nQ2 — Gdzie zawiodłem: ${review.do_differently || "(nie wypełnił)"}\nQ3 — Czego brakowało: ${review.proud_of || "(nie wypełnił)"}\nQ4 — Co unikałem: ${review.sabotage || "(nie wypełnił)"}\nQ5 — Co dało/zabrało: ${review.week_highlight || "(nie wypełnił)"}\nQ6 — Czego żałuję: ${review.week_regret || "(nie wypełnił)"}\nQ7 — Co myślę inaczej: ${review.new_belief || "(nie wypełnił)"}\n\nNARRACJA (Blok 1): ${review.ai_recap?.phase1?.narrative ?? "(brak)"}`;

    const { content } = await deepseekChat({ apiKey, model: "deepseek-v4-flash", maxTokens: 2500, temperature: 0.3, responseFormat: { type: "json_object" }, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] });

    const parsed = parseJsonFromContent(content);
    if (!parsed || typeof parsed.narrative_check !== "string" || !Array.isArray(parsed.deepening_questions) || !parsed.block5_material) {
      throw new Error(`Invalid AI JSON phase2: ${content.slice(0, 300)}`);
    }

    const phase2 = {
      narrative_check: parsed.narrative_check,
      deepening_questions: parsed.deepening_questions.slice(0, 3).map(String),
      block5_material: { cialo: String((parsed.block5_material as Record<string, unknown>)?.cialo ?? ""), duch: String((parsed.block5_material as Record<string, unknown>)?.duch ?? ""), konto: String((parsed.block5_material as Record<string, unknown>)?.konto ?? "") },
    };

    const { data: existingForMerge } = await db.from("weekly_reviews").select("ai_recap").eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
    const mergedRecap = { ...(existingForMerge?.ai_recap ?? {}), phase2 };
    await db.from("weekly_reviews").upsert({ user_id: userId, week_start: weekStart, ai_recap: mergedRecap }, { onConflict: "user_id,week_start" });

    return { phase2 };
  } catch (err: any) {
    console.error("[vanguard-week-recap] error:", err);
    throw err;
  }
}
