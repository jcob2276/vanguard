import { getPlanQualitySignal } from "../../_shared/planQuality.ts";
import { getRecentStrongBehavioralPatterns } from "../../_shared/vanguardPatterns.ts";
import { fetchMedicalContext, formatMedicalContextBlock } from "../../_shared/medicalContext.ts";
import { avg, classifyIntentSafe } from "./ragHelpers.ts";
import { runRagPipeline } from "./ragPipeline.ts";

export async function retrieveRagContext(
  supabase: any,
  user_id: string,
  current_query: string | null | undefined,
  todayDate: string,
  fourteenDaysAgoDate: string,
  mode: string,
  cutoff72h: string,
) {
  let recentPlanQuality: any = null;
  let lastEveningReflection: any = null;

  if (mode === 'planning' || classifyIntentSafe(current_query || '').includes('recent')) {
    const { data: recentPlan } = await supabase
      .from('daily_reconciliations')
      .select('planning_summary, p2_parsed, date')
      .eq('user_id', user_id)
      .not('planning_summary', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentPlan?.planning_summary) {
      const signal = getPlanQualitySignal(recentPlan.planning_summary);
      recentPlanQuality = {
        ...signal,
        target_date: (recentPlan.planning_summary as Record<string, unknown>)?.target_date || null,
      };
    }

    // P2 adoption: last evening's user reflection (biggest_cost, best_move, blockers)
    if (recentPlan?.p2_parsed) {
      const p2 = recentPlan.p2_parsed as Record<string, unknown>;
      if (Number(p2.parse_confidence) >= 0.4 && (p2.biggest_cost || p2.best_move || (p2.blocker_candidates as unknown[] | undefined)?.length)) {
        lastEveningReflection = {
          date: recentPlan.date,
          biggest_cost: p2.biggest_cost,
          best_move: p2.best_move,
          blocker_candidates: (p2.blocker_candidates as unknown[] | undefined)?.slice(0, 3) || [],
          day_score: p2.day_score,
          needs_manual_review: !!p2.needs_manual_review,
        };
      }
    }
  }

  // STATIC CONTEXT
  const [fundamentRes, preferencesRes, oura14dRes, nutrition14dRes, foodEntries14dRes, strainRes, dailyWinsRes, proposalsRes] = await Promise.all([
    supabase.from('user_fundament')
      .select('identity, philosophy, vision')
      .eq('user_id', user_id)
      .maybeSingle(),
    supabase.from('vanguard_preferences')
      .select('value')
      .eq('user_id', user_id)
      .eq('is_active', true),
    supabase.from('oura_daily_summary')
      .select('date, steps, active_calories, total_calories, total_sleep_hours, bedtime_timestamp, readiness_score, hrv_avg, rhr_avg, deep_sleep_hours, rem_sleep_hours, sleep_efficiency, latency_minutes')
      .eq('user_id', user_id)
      .gte('date', fourteenDaysAgoDate)
      .order('date', { ascending: false }),
    supabase.from('daily_nutrition')
      .select('date, calories, protein, carbs, fat, fiber, sugar, avg_food_quality, food_quality_analysis')
      .eq('user_id', user_id)
      .gte('date', fourteenDaysAgoDate)
      .order('date', { ascending: false }),
    supabase.from('daily_food_entries')
      .select('date, meal_type, name, brand, calories, protein, carbs, fat, fiber, sugar, saturated_fat, insulin_load, food_quality_score, quality_reason')
      .eq('user_id', user_id)
      .gte('date', fourteenDaysAgoDate)
      .order('date', { ascending: false }),
    supabase.from('daily_strain')
      .select('date, strain_score, recovery_score, fueling_score, fueling_provisional, mental_load_score, daily_status, main_limiter, explanation, cardio_load, strength_load, leg_load, cns_load')
      .eq('user_id', user_id)
      .gte('date', fourteenDaysAgoDate)
      .order('date', { ascending: false }),
    supabase.from('daily_wins')
      .select('task_1, done_1, category_1, task_2, done_2, category_2, task_3, done_3, category_3, task_4, done_4, category_4, task_5, done_5, category_5, importance_score, daily_rpe, day_note, gratitude_entry, mood_score')
      .eq('user_id', user_id)
      .eq('date', todayDate)
      .maybeSingle(),
    supabase.from('system_proposals')
      .select('title, description, category')
      .eq('user_id', user_id)
      .eq('status', 'pending')
      .limit(5)
  ]);

  if (fundamentRes.error) console.error('[oracle] user_fundament query error:', fundamentRes.error);
  if (preferencesRes.error) console.error('[oracle] vanguard_preferences query error:', preferencesRes.error);
  if (oura14dRes.error) console.error('[oracle] oura_daily_summary query error:', oura14dRes.error);
  if (nutrition14dRes.error) console.error('[oracle] daily_nutrition query error:', nutrition14dRes.error);
  if (foodEntries14dRes.error) console.error('[oracle] daily_food_entries query error:', foodEntries14dRes.error);
  if (strainRes.error) console.error('[oracle] daily_strain query error:', strainRes.error);
  if (dailyWinsRes.error) console.error('[oracle] daily_wins query error:', dailyWinsRes.error);
  if (proposalsRes.error) console.error('[oracle] system_proposals query error:', proposalsRes.error);

  const responsePrefs = preferencesRes.data?.map((p: any) => `- ${p.value}`).join('\n') || '';
  const oura14d = oura14dRes.data || [];
  const nutrition14d = nutrition14dRes.data || [];
  const foodEntries14d = foodEntries14dRes.data || [];
  const foodByDate: Record<string, any[]> = {};
  for (const e of foodEntries14d) {
    if (!foodByDate[e.date]) foodByDate[e.date] = [];
    foodByDate[e.date].push({ meal: e.meal_type, name: e.name, kcal: e.calories, B: e.protein, W: e.carbs, T: e.fat, Bl: e.fiber ?? undefined, Cuk: e.sugar ?? undefined, q: e.food_quality_score ?? undefined });
  }

  const healthSummary14d = {
    date_from: fourteenDaysAgoDate,
    date_to: todayDate,
    oura_days_logged: oura14d.length,
    nutrition_days_logged: nutrition14d.length,
    avg_steps: avg(oura14d, 'steps'),
    avg_active_calories: avg(oura14d, 'active_calories'),
    avg_total_calories_burned: avg(oura14d, 'total_calories'),
    avg_food_calories: avg(nutrition14d, 'calories'),
    avg_protein: avg(nutrition14d, 'protein'),
    avg_carbs: avg(nutrition14d, 'carbs'),
    avg_fat: avg(nutrition14d, 'fat'),
    avg_fiber: avg(nutrition14d, 'fiber'),
    avg_sugar: avg(nutrition14d, 'sugar'),
    avg_sleep_hours: avg(oura14d, 'total_sleep_hours'),
    avg_hrv: avg(oura14d, 'hrv_avg'),
    avg_readiness: avg(oura14d, 'readiness_score'),
    oura_daily: oura14d,
    nutrition_daily: nutrition14d
  };

  const healthSummaryText = `[ZDROWIE/JEDZENIE - OSTATNIE 14 DNI, DANE DETERMINISTYCZNE]:
Zakres: ${healthSummary14d.date_from} - ${healthSummary14d.date_to}
Dni Oura: ${healthSummary14d.oura_days_logged}/14; srednie kroki: ${healthSummary14d.avg_steps ?? 'brak danych'}; srednie active kcal: ${healthSummary14d.avg_active_calories ?? 'brak danych'}; srednie total burned kcal: ${healthSummary14d.avg_total_calories_burned ?? 'brak danych'}
Sen (Oura sensor): srednie godziny snu: ${healthSummary14d.avg_sleep_hours ?? 'brak danych'}h; srednie HRV: ${healthSummary14d.avg_hrv ?? 'brak danych'}; sredni readiness: ${healthSummary14d.avg_readiness ?? 'brak danych'}
Dni logu posilkow/daily_nutrition: ${healthSummary14d.nutrition_days_logged}/14; srednio zjedzone kcal: ${healthSummary14d.avg_food_calories ?? 'brak danych'}; srednie bialko: ${healthSummary14d.avg_protein ?? 'brak danych'}; srednie wegle: ${healthSummary14d.avg_carbs ?? 'brak danych'}; sredni tluszcz: ${healthSummary14d.avg_fat ?? 'brak danych'}; sredni blonnik: ${healthSummary14d.avg_fiber ?? 'brak danych'}; sredni cukier: ${healthSummary14d.avg_sugar ?? 'brak danych'}
Jakosc jedzenia: avg_food_quality to srednia wazona kalorycznie (0-100, real-food dietitian scale) — jesli null, analiza nie zostala jeszcze uruchomiona dla tego dnia. Pole q przy produkcie = jego food_quality_score.
Oura dzien po dniu (SUROWE DANE — zawiera bedtime_timestamp, total_sleep_hours, hrv_avg, rhr_avg, readiness_score, deep_sleep_hours, rem_sleep_hours, sleep_efficiency, latency_minutes): ${JSON.stringify(healthSummary14d.oura_daily)}
Jedzenie dzien po dniu (agregat, zawiera avg_food_quality i food_quality_analysis jesli analiza byla wykonana): ${JSON.stringify(healthSummary14d.nutrition_daily)}
Jedzenie dzien po dniu (produkty, pole q = food_quality_score jesli analiza byla wykonana): ${JSON.stringify(foodByDate)}`;

  // DAILY STRAIN
  const strain14d = strainRes.data || [];
  const strainToday = strain14d[0] || null;
  const strainText = strain14d.length > 0 ? `[TRENING/OBCIĄŻENIE — DAILY STRAIN, DANE DETERMINISTYCZNE]:
To jest zintegrowany wskaźnik łączący bieg (Strava HR), siłownię, kroki, odżywianie (log posiłków) i regenerację (Oura).
- strain_score: 0–21 (koszt fizjologiczny dnia). recovery_score: 0–100. fueling_score: 0–100. daily_status: green/yellow/red.
- main_limiter: co dziś najbardziej ogranicza (sleep/calories/carbs/cardio_load/strength_load/mental_load/recovery_ok).
- fueling_provisional: gdy true, fueling/kcal dla TEGO dnia są TYMCZASOWE — dzień jeszcze trwa, log posiłków niedomknięty (cron liczy ~11:15). NIE twierdź o deficycie kalorycznym ani o "za mało jedzenia" na podstawie tymczasowego fuelingu; potraktuj go jako niepełny i powiedz, że doszacuje się po domknięciu dnia.
DZIŚ (${strainToday?.date}): Strain ${strainToday?.strain_score ?? '—'}/21, Recovery ${strainToday?.recovery_score ?? '—'}/100, Fueling ${strainToday?.fueling_score ?? '—'}/100${strainToday?.fueling_provisional ? ' (TYMCZASOWY — dzień niezamknięty, nie wnioskuj o deficycie)' : ''}, Status ${strainToday?.daily_status ?? '—'}, Limiter: ${strainToday?.main_limiter ?? '—'}. ${strainToday?.explanation ?? ''}
Gdy pytanie brzmi "czy mogę dziś cisnąć / jak forma / co mnie ogranicza" — odpowiadaj NA TYCH LICZBACH: green=można obciążać, yellow=ostrożnie/easy, red=regeneracja. Wskaż konkretny limiter. Jeśli fueling_provisional=true, fueling dziś nie jest finalnym limiterem.
Strain dzień po dniu (14d): ${JSON.stringify(strain14d)}` : '[DAILY STRAIN]: brak danych (jeszcze nie policzono).';

  const medicalContext = await fetchMedicalContext(supabase, user_id, todayDate);
  const medicalContextText = formatMedicalContextBlock(medicalContext);
  // DYNAMIC CONTEXT (RAG) - DETERMINISTIC 3-STEP PIPELINE
  let semanticContext = "";
  let graphContext = "";
  let wikiContext = "";
  let retrievedSources: any[] = [];
  let matchesRes: any = { data: [] };
  let graphRes: any = { data: [] };
  const intent = classifyIntentSafe(current_query || '');

  if (current_query) {
    const ragResult = await runRagPipeline(supabase, user_id, current_query, intent, cutoff72h, proposalsRes);
    semanticContext = ragResult.semanticContext;
    graphContext = ragResult.graphContext;
    retrievedSources = ragResult.retrievedSources;
    matchesRes = ragResult.matchesRes;
    graphRes = ragResult.graphRes;
  }

  // WIKI CONTEXT
  try {
    const wikiTypes = intent === 'biometric'
      ? ['health', 'training', 'operating_model']
      : intent === 'person'
        ? ['person', 'identity', 'operating_model']
        : intent === 'recent_pattern'
          ? ['behavior_pattern', 'friction_loop', 'operating_model']
          : ['operating_model', 'behavior_pattern', 'identity', 'project', 'decision'];

    const { data: wikiPages, error: wikiErr } = await supabase
      .from('vanguard_wiki_pages')
      .select('id, slug, title, page_type, status, confidence, summary, content_md, source_refs, last_compiled_at')
      .eq('user_id', user_id)
      .in('page_type', wikiTypes)
      .in('status', ['active', 'user_confirmed', 'hypothesis', 'needs_review'])
      .order('confidence', { ascending: false })
      .order('last_compiled_at', { ascending: false })
      .limit(6);

    if (wikiErr) throw wikiErr;
    if (wikiPages?.length) {
      wikiContext = "\n[VANGUARD WIKI - SKOMPILOWANA PAMIEC, WARSTWA POCHODNA]:\n" +
        wikiPages.map((p: any) => {
          const refs = Array.isArray(p.source_refs)
            ? p.source_refs.slice(0, 3).map((r: any) => `${r.table}:${r.id}`).join(', ')
            : '';
          const detail = p.status === 'needs_review' && p.content_md
            ? ` | evidence: ${String(p.content_md).replace(/\s+/g, ' ').slice(0, 520)}`
            : '';
          return `- ${p.title} (${p.page_type}, ${p.status}, conf=${Math.round(Number(p.confidence || 0) * 100)}%): ${p.summary}${detail}${refs ? ` | refs: ${refs}` : ''}`;
        }).join('\n') +
        "\nZasada: wiki jest synteza pochodna. Status needs_review = indeks/nawigacja, nie mocna teza. Gdy swiezy stream 72h przeczy wiki, priorytet ma swiezy stream albo oznacz konflikt.";

      retrievedSources.push(...wikiPages.slice(0, 6).map((p: any) => ({
        table: 'vanguard_wiki_pages',
        id: p.id,
        date: p.last_compiled_at,
        type: 'compiled_wiki',
        snippet: `${p.title}: ${p.summary}`,
        confidence_score: p.confidence,
        status: p.status,
      })));
    }
  } catch (e) {
    console.warn('[oracle] wiki context fetch failed (non-fatal):', e);
  }

  // BEHAVIORAL PATTERNS CONTEXT
  let behavioralPatternsContext = '';
  const wantsPatterns = intent === 'recent_pattern' ||
    /\b(wzorzec|schemat|powtarza|powtarzaln|trend|dlaczego znowu|co się dzieje z|ostatnio mam problem|często|zawsze|kiedy|historia|historycznie)\b/.test((current_query || '').toLowerCase());

  if (wantsPatterns) {
    try {
      const strongPatterns = await getRecentStrongBehavioralPatterns(supabase, user_id, 3);
      if (strongPatterns.length > 0) {
        behavioralPatternsContext = strongPatterns
          .map((p, i) => `${i + 1}. ${p.evidence_text} (N=${p.occurrence_count}, pewność=${Math.round(p.confidence * 100)}%)`)
          .join('\n');
      }
    } catch (e) {
      console.warn('[oracle] getRecentStrongBehavioralPatterns failed (non-fatal):', e);
    }
  }

  // IRON RULES CONTEXT
  let ironRulesContext = '';
  try {
    const { data: ironRules } = await supabase
      .from('vanguard_iron_rules')
      .select('rule_text')
      .eq('user_id', user_id)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .limit(10);
    if (ironRules && ironRules.length > 0) {
      ironRulesContext = ironRules.map((r: { rule_text: string }) => `- ${r.rule_text}`).join('\n');
    }
  } catch (e) {
    console.warn('[oracle] iron_rules fetch failed (non-fatal):', e);
  }

  // CLARIFICATIONS CONTEXT
  let clarificationsContext = '';
  try {
    const { data: answeredClarifications } = await supabase
      .from('oracle_clarification_requests')
      .select('question, answer, proposed_memory, answered_at')
      .eq('user_id', user_id)
      .eq('status', 'answered')
      .order('answered_at', { ascending: false })
      .limit(8);
    if (answeredClarifications?.length) {
      clarificationsContext = answeredClarifications.map((c: { question: string; answer: unknown; proposed_memory?: string }) =>
        `P: ${c.question}\nO: ${JSON.stringify(c.answer)}${c.proposed_memory ? `\nPamięć: ${c.proposed_memory}` : ''}`
      ).join('\n\n');
    }
  } catch (e) {
    console.warn('[oracle] clarifications fetch failed (non-fatal):', e);
  }

  return {
    responsePrefs,
    healthSummary14d,
    healthSummaryText,
    strainText,
    medicalContextText,
    semanticContext,
    graphContext,
    wikiContext,
    behavioralPatternsContext,
    ironRulesContext,
    clarificationsContext,
    retrievedSources,
    matchesRes,
    graphRes,
    intent,
    recentPlanQuality,
    lastEveningReflection,
    fundament: fundamentRes.data || { identity: '', philosophy: '', vision: '' }
  };
}
