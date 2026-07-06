import { getEmbedding } from "../../_shared/openai.ts";
import { deepseekChat } from "../../_shared/deepseek.ts";
import {
  fetchOracleStreamSlices,
  formatOracleStreamBlock,
} from "../../_shared/streamContext.ts";
import { getStreamCutoffs, getWarsawDateString } from "../../_shared/time.ts";
import { logAuditEvent } from "../../_shared/audit.ts";
import { getPlanQualitySignal } from "../../_shared/planQuality.ts";
import { logCriticalError } from "../../_shared/errorLogging.ts";
import { getRecentStrongBehavioralPatterns } from "../../_shared/vanguardPatterns.ts";
import { fetchMedicalContext, formatMedicalContextBlock } from "../../_shared/medicalContext.ts";

function avg(items: any[] = [], key: string) {
  const values = items.map((item) => Number(item?.[key])).filter(Number.isFinite);
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
}

function stripJsonFence(text = '') {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function buildGraphSeeds(query = '', intent = 'open_reflection', mentionedEntities: string[] = []) {
  const q = query.toLowerCase();
  const seeds = new Set<string>((mentionedEntities || []).filter(Boolean));
  const selfReference = /\b(ja|mnie|mi|moje|moja|moj|u mnie|o mnie|mój)\b/.test(q);
  const broadSelfIntent = ['identity', 'person', 'recent_pattern', 'biometric', 'open_reflection'].includes(intent);

  if (selfReference || broadSelfIntent) {
    seeds.add('Jakub');
  }

  return Array.from(seeds);
}

function classifyIntentSafe(query = '') {
  const q = query.toLowerCase();
  if (/wiek|urodzin|studi|kim jestem|fundament|identity|tozsamosc|tożsamość/.test(q)) return 'identity';
  if (/jul|toman|tomań|ekiert|klaud|pawel|paweł|osob|relac|dziewczyn|babci|rodzin/.test(q)) return 'person';
  // Biometric before recent_pattern — "dlaczego znowu źle śpię" must not lose sleep context.
  if (/sen|hrv|oura|execution|biometr|tetno|tętno|recovery|krok|kalor|jedz|jem|białk|bialk|śpi|spi|zmęcz|zmecz/.test(q)) return 'biometric';
  if (/ostatnio|7 dni|trend|history|wzorzec|schemat|powtarza|powtarzaln|dlaczego znowu|co się dzieje z/.test(q)) return 'recent_pattern';
  return 'open_reflection';
}

export async function retrieveRagContext(
  supabase: any,
  user_id: string,
  current_query: string | null | undefined,
  todayDate: string,
  fourteenDaysAgoDate: string,
  mode: string,
  cutoff72h: string,
  t0: number,
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
        target_date: (recentPlan.planning_summary as any).target_date || null,
      };
    }

    // P2 adoption: last evening's user reflection (biggest_cost, best_move, blockers)
    if (recentPlan?.p2_parsed) {
      const p2 = recentPlan.p2_parsed as any;
      if (p2.parse_confidence >= 0.4 && (p2.biggest_cost || p2.best_move || p2.blocker_candidates?.length)) {
        lastEveningReflection = {
          date: recentPlan.date,
          biggest_cost: p2.biggest_cost,
          best_move: p2.best_move,
          blocker_candidates: p2.blocker_candidates?.slice(0, 3) || [],
          day_score: p2.day_score,
          needs_manual_review: !!p2.needs_manual_review,
        };
      }
    }
  }

  // STATIC CONTEXT
  const [fundamentRes, preferencesRes, oura14dRes, nutrition14dRes, foodEntries14dRes, strainRes, dailyWinsRes] = await Promise.all([
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
  ]);

  if (fundamentRes.error) console.error('[oracle] user_fundament query error:', fundamentRes.error);
  if (preferencesRes.error) console.error('[oracle] vanguard_preferences query error:', preferencesRes.error);
  if (oura14dRes.error) console.error('[oracle] oura_daily_summary query error:', oura14dRes.error);
  if (nutrition14dRes.error) console.error('[oracle] daily_nutrition query error:', nutrition14dRes.error);
  if (dailyWinsRes.error) console.error('[oracle] daily_wins query error:', dailyWinsRes.error);

  const w = dailyWinsRes.data;
  const powerListText = w ? `
1. [${w.category_1 || '?'}] ${w.task_1 || 'Brak'} (${w.done_1 ? 'ZROBIONE' : 'NIEWYKONANE'})
2. [${w.category_2 || '?'}] ${w.task_2 || 'Brak'} (${w.done_2 ? 'ZROBIONE' : 'NIEWYKONANE'})
3. [${w.category_3 || '?'}] ${w.task_3 || 'Brak'} (${w.done_3 ? 'ZROBIONE' : 'NIEWYKONANE'})
4. [${w.category_4 || '?'}] ${w.task_4 || 'Brak'} (${w.done_4 ? 'ZROBIONE' : 'NIEWYKONANE'})
5. [${w.category_5 || '?'}] ${w.task_5 || 'Brak'} (${w.done_5 ? 'ZROBIONE' : 'NIEWYKONANE'})` : '\nBrak ustalonej PowerListy na dziś.';

  const staticProfile = `
[DZISIEJSZE CELE (PowerList) - AKTUALNY STAN DLA DATY ${todayDate}]:${powerListText}

[TŁO TOŻSAMOŚCI - KONTEKST]:
${fundamentRes.data?.identity || 'Brak danych'}
${fundamentRes.data?.philosophy || 'Brak danych'}
${fundamentRes.data?.vision || 'Brak danych'}
  `;

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

  // DYNAMIC CONTEXT (RAG)
  let semanticContext = "";
  let graphContext = "";
  let wikiContext = "";
  let retrievedSources: any[] = [];
  let matchesRes: any = { data: [] };
  let graphRes: any = { data: [] };
  let intent = classifyIntentSafe(current_query || '');

  if (current_query) {
    try {
      const intentForGraph = classifyIntentSafe(current_query);
      const { data: mentioned, error: mentionedErr } = await supabase.rpc('find_mentioned_entities', {
        query_text: current_query.substring(0, 1000),
        user_id_param: user_id
      });
      if (mentionedErr) console.warn('[oracle] find_mentioned_entities failed (non-fatal):', mentionedErr);
      const entitiesInQuery = (mentioned as any[])?.map(m => m.entity_name) || [];
      const graphSeeds = buildGraphSeeds(current_query, intentForGraph, entitiesInQuery);
      const graphLayer = intentForGraph === 'biometric' ? null : 'intelligence';

      // BM25 fulltext on original query
      const fulltextOriginalPromise = supabase.rpc('search_entity_links_fulltext', {
        query_text: current_query.substring(0, 500),
        match_user_id: user_id,
        match_count: 10
      });

      // QUERY EXPANSION
      const queryExpansionPromise = deepseekChat({
        apiKey: Deno.env.get('DEEPSEEK_API_KEY') ?? '',
        model: 'deepseek-v4-flash',
        maxTokens: 150,
        temperature: 0.1,
        timeoutMs: 5000,
        responseFormat: { type: 'json_object' },
        messages: [{
          role: 'system',
          content: `Jesteś asystentem retrieval dla bazy wiedzy o Jakubie (23l, Rzeszów, cyberbezpieczeństwo, sprzedaż, sport).
Zwróć JSON z polami:
- "hyde": JEDEN krótki fakt (1 zdanie) który bezpośrednio odpowiada na pytanie
- "stepback": szersze pytanie-tło (ogólniejsza wersja pytania, max 8 słów)
- "sub": tablica 2 konkretnych pod-pytań które razem pokrywają temat
Tylko JSON, bez komentarzy.`,
        }, {
          role: 'user',
          content: current_query.substring(0, 300),
        }],
      }).then(r => {
        try { return JSON.parse(r.content); } catch { return null; }
      }).catch(() => null);

      const expansion = await queryExpansionPromise;
      const hydeFact: string = expansion?.hyde || '';
      const stepbackQuery: string = expansion?.stepback || '';
      const subQueries: string[] = Array.isArray(expansion?.sub) ? expansion.sub.slice(0, 2) : [];

      const queryForEmbedding = hydeFact ? `${current_query}\n${hydeFact}` : current_query;
      if (expansion) console.log(`[oracle] QExp hyde="${hydeFact.substring(0,60)}" stepback="${stepbackQuery}" subs=${subQueries.length}`);
      const embedding = await getEmbedding(queryForEmbedding.substring(0, 3000), Deno.env.get('OPENAI_API_KEY') ?? '');

      // HIPPOGRAPH PHASE 1
      const [matchesResRaw, semanticGraphRes, entitySeedsRes, fulltextGraphRes, stepbackRes, ...subQueryResults] = await Promise.all([
        embedding ? supabase.rpc('match_vanguard_content', {
          query_embedding: embedding,
          match_threshold: 0.35,
          match_count: 5,
          user_id_param: user_id
        }) : Promise.resolve({ data: [], error: null } as any),
        embedding ? supabase.rpc('search_entity_links', {
          query_embedding: embedding,
          match_user_id: user_id,
          match_count: 15
        }) : Promise.resolve({ data: [], error: null } as any),
        embedding ? supabase.rpc('find_entity_seeds_by_embedding', {
          query_embedding: embedding,
          match_user_id: user_id,
          match_count: 6
        }) : Promise.resolve({ data: [], error: null } as any),
        fulltextOriginalPromise,
        stepbackQuery ? supabase.rpc('search_entity_links_fulltext', {
          query_text: stepbackQuery,
          match_user_id: user_id,
          match_count: 6
        }) : Promise.resolve({ data: [], error: null } as any),
        subQueries[0] ? supabase.rpc('search_entity_links_fulltext', {
          query_text: subQueries[0],
          match_user_id: user_id,
          match_count: 6
        }) : Promise.resolve({ data: [], error: null } as any),
        subQueries[1] ? supabase.rpc('search_entity_links_fulltext', {
          query_text: subQueries[1],
          match_user_id: user_id,
          match_count: 6
        }) : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (matchesResRaw.error) throw matchesResRaw.error;
      if (semanticGraphRes.error) throw semanticGraphRes.error;
      if (entitySeedsRes.error) throw entitySeedsRes.error;
      if (fulltextGraphRes.error) console.warn('[oracle] fulltext error (non-fatal):', fulltextGraphRes.error);
      if (stepbackRes.error) console.warn('[oracle] stepback error (non-fatal):', stepbackRes.error);

      matchesRes = matchesResRaw;

      // HIPPOGRAPH PHASE 2
      const semanticEntitySeeds = (entitySeedsRes.data || [])
        .filter((s: any) => s.best_similarity > 0.5 && s.entity_name !== 'Jakub')
        .map((s: any) => s.entity_name);
      const allSeeds = [...new Set([...graphSeeds, ...semanticEntitySeeds])];
      console.log(`[oracle] HippoRAG seeds: [${allSeeds.join(', ')}] (string:${graphSeeds.length} + semantic:${semanticEntitySeeds.length})`);

      // HIPPOGRAPH PHASE 3
      const graphResRaw = allSeeds.length > 0
        ? await supabase.rpc('get_vanguard_graph_context', {
            start_entities: allSeeds,
            max_depth: 2,
            user_id_param: user_id,
            p_layer: graphLayer,
            p_include_historical: intentForGraph === 'identity',
            p_min_confidence: 0.0
          })
        : { data: [] };

      if ((graphResRaw as any).error) throw (graphResRaw as any).error;

      const entityGraphData = graphResRaw.data || [];
      const tripleKey = (r: any) => `${r.source_entity}|${r.relation}|${r.target_entity}`;
      const rrfScores: Record<string, number> = {};
      const rrfMap: Record<string, any> = {};

      const queryLower = current_query.toLowerCase();
      const entityBoost = (r: any): number => {
        const srcMatch = queryLower.includes((r.source_entity || '').toLowerCase());
        const tgtMatch = queryLower.includes((r.target_entity || '').toLowerCase());
        const evidence = r.evidence_count || 1;
        if (srcMatch || tgtMatch) return 0.4 / Math.sqrt(evidence);
        return 0;
      };

      const addToRRF = (results: any[], k: number, weight = 1.0) => {
        (results || []).forEach((r: any, i: number) => {
          const key = tripleKey(r);
          const boost = entityBoost(r);
          rrfScores[key] = (rrfScores[key] || 0) + weight * (1 / (i + k)) + boost;
          if (!rrfMap[key]) rrfMap[key] = r;
        });
      };

      addToRRF(semanticGraphRes.data, 1, 1.0);
      addToRRF(fulltextGraphRes.data, 2, 0.8);
      addToRRF(stepbackRes.data, 2, 0.5);
      subQueryResults.forEach(r => addToRRF(r?.data, 2, 0.4));

      const rrfRanked = Object.entries(rrfScores)
        .sort(([, a], [, b]) => b - a)
        .map(([k]) => rrfMap[k]);

      console.log(`[oracle] RRF pool: vector=${semanticGraphRes.data?.length||0} ft=${fulltextGraphRes.data?.length||0} stepback=${stepbackRes.data?.length||0} subs=${subQueryResults.reduce((a,r)=>a+(r?.data?.length||0),0)} → merged=${rrfRanked.length}`);

      const semanticGraphData = rrfRanked.filter((sg: any) =>
        !entityGraphData.some((eg: any) =>
          eg.source_entity === sg.source_entity &&
          eg.relation === sg.relation &&
          eg.target_entity === sg.target_entity
        )
      );
      const allGraphData = [...entityGraphData, ...semanticGraphData];

      // RE-RANKING
      const now2 = Date.now();
      const rankedSemanticMatches = (matchesResRaw.data || []).map((m: any) => {
        const sim = m.similarity || m.hybrid_score || 0;
        const sourceWeight = m.table_name === 'vanguard_stream' ? 1.0
          : m.table_name === 'vanguard_knowledge' ? 0.85 : 0.75;
        const ageMs = m.source_date ? now2 - new Date(m.source_date).getTime() : 999999999999;
        const ageDays = ageMs / (24 * 3600 * 1000);
        const recencyAdjust = ageDays < 3 ? 0.15
          : ageDays < 21 ? 0
          : ageDays < 60 ? -0.15
          : -0.3;
        return { ...m, _score: sim * sourceWeight + recencyAdjust, _age_days: Math.round(ageDays) };
      }).sort((a: any, b: any) => b._score - a._score).slice(0, 6);

      const rankedGraphData = allGraphData.map((g: any) => {
        const sim = g.similarity || 0;
        const evidenceBonus = Math.min(Math.log1p(g.evidence_count || 1) * 0.05, 0.2);
        const confidenceBonus = (g.confidence_score || 0.5) * 0.1;
        return { ...g, _score: sim * 0.7 + evidenceBonus + confidenceBonus };
      }).sort((a: any, b: any) => b._score - a._score).slice(0, 20);

      matchesRes = { data: rankedSemanticMatches };
      graphRes = { data: rankedGraphData };

      if (rankedSemanticMatches.length === 0 && rankedGraphData.length === 0) {
        logAuditEvent({
          eventType: 'oracle_rag_empty',
          severity: 'warning',
          message: 'Oracle otrzymał zapytanie bez żadnego kontekstu z RAG/grafu',
          userId: user_id,
          metadata: {
            query_preview: current_query?.substring(0, 180) || null,
            intent: intentForGraph,
          },
        }).catch((e: unknown) => console.warn('[oracle] audit log failed:', e));
      }

      retrievedSources = rankedSemanticMatches.map((m: any) => ({
        table: m.table_name,
        id: m.id,
        date: m.source_date,
        similarity: m.similarity,
        hybrid_score: m._score,
        snippet: (m.content || '').slice(0, 240)
      }));

      if (rankedSemanticMatches.length > 0) {
        const currentMatches = rankedSemanticMatches.filter((m: any) => m._age_days < 21);
        const archiveMatches = rankedSemanticMatches.filter((m: any) => m._age_days >= 21);
        let memCtx = "";
        if (currentMatches.length > 0) {
          memCtx += "[PAMIĘĆ SEMANTYCZNA — AKTUALNA (<21 dni)]:\n" +
            currentMatches.map((m: any) => `- [${m.table_name}, ${m._age_days}d temu, score:${m._score.toFixed(2)}] ${m.content}`).join('\n');
        }
        if (archiveMatches.length > 0) {
          memCtx += "\n[ARCHIWUM — NIŻSZY PRIORYTET, wymaga świeżego potwierdzenia]:\n" +
            archiveMatches.map((m: any) => `- [ARCHIWUM, ${m._age_days}d temu] ${m.content}`).join('\n');
        }
        semanticContext = memCtx;
      }

      const isPatternQuery = !!current_query.toLowerCase().match(/ostatnio|7 dni|trend|wzorc|wzorzec/);
      const streamSlices = await fetchOracleStreamSlices(supabase, user_id, {
        includePatternWindow: true,
        patternLimit: isPatternQuery ? 15 : 5,
      });
      console.log(`[oracle] stream: ${streamSlices.current.length} current + ${streamSlices.recent.length} recent`, Date.now() - t0);
      semanticContext += formatOracleStreamBlock(streamSlices.current, streamSlices.recent);

      // FRICTION EVENTS
      try {
        const { data: frictionRecent, error: feErr } = await supabase
          .from('friction_events')
          .select('friction_type, deviation, immediate_cost, declared_intention, occurred_at, confidence_source, confidence')
          .eq('user_id', user_id)
          .gte('occurred_at', cutoff72h)
          .order('occurred_at', { ascending: false });

        if (feErr) {
          console.warn('[oracle] friction fetch failed (non-fatal):', feErr.message);
        } else if (frictionRecent && frictionRecent.length > 0) {
          semanticContext += "\n\n[FRICTION EVENTS (ostatnie 72h) — atomy tarcia]:\n" +
            frictionRecent.map((f: any) =>
              `[${f.occurred_at}] ${f.friction_type} | odchylenie: ${f.deviation || '—'} | intencja: ${f.declared_intention || '—'} | koszt: ${f.immediate_cost || '—'} [${f.confidence_source}, conf=${f.confidence}]`
            ).join('\n');
        }
      } catch (fe: any) {
        console.warn('[oracle] friction fetch error (non-fatal):', fe?.message ?? fe);
      }

      if (rankedGraphData.length > 0) {
        graphContext = "\n[GRAF POWIĄZAŃ (Re-ranked, top 20)]:\n" + rankedGraphData.map((g: any) => {
          if (g.fact_text) return `- ${g.fact_text}`;
          const conf = g.confidence_score ? ` [conf:${g.confidence_score.toFixed(2)}]` : '';
          const evid = g.evidence_count && g.evidence_count > 1 ? ` N=${g.evidence_count}` : '';
          return `- ${g.source_entity} ${g.relation} ${g.target_entity}${conf}${evid}`;
        }).join('\n');
      }

      if (graphRes.data && graphRes.data.length > 0) {
        retrievedSources.push(...graphRes.data.slice(0, 12).map((g: any) => ({
          table: 'vanguard_entity_links',
          id: g.id || null,
          date: null,
          similarity: null,
          hybrid_score: null,
          type: 'graph_edge',
          snippet: `${g.source_entity} --${g.relation}--> ${g.target_entity}`,
          evidence_count: g.evidence_count,
          confidence_score: g.confidence_score,
          status: g.status
        })));
      }

    } catch (err) {
      await logCriticalError({
        area: 'oracle',
        error: err,
        message: 'RAG retrieval failed – continuing with degraded context',
        metadata: { nonFatal: true },
      });
      semanticContext += "\n\n[SYSTEM: RAG niedostępny — odpowiedź bez pamięci semantycznej/grafu. Nie twierdź o faktach ze strumienia bez świeżego potwierdzenia.]";
    }
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
    staticProfile,
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
