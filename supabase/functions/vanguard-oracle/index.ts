import { getEmbedding } from "../_shared/openai.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders } from "../_shared/supabase.ts"
import {
  fetchOracleStreamSlices,
  formatOracleStreamBlock,
  fetchDeclaredIntentions,
  formatDeclaredIntentionsBlock,
} from "../_shared/streamContext.ts"
import { getStreamCutoffs } from "../_shared/time.ts"
import { logAuditEvent } from "../_shared/audit.ts"
import { getPlanQualitySignal } from "../_shared/planQuality.ts"
import { logCriticalError } from "../_shared/errorLogging.ts"
import { getRecentStrongBehavioralPatterns } from "../_shared/vanguardPatterns.ts"

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
  if (/ostatnio|7 dni|trend|history|wzorzec|schemat|powtarza|powtarzaln|dlaczego znowu|co się dzieje z/.test(q)) return 'recent_pattern';
  if (/sen|hrv|oura|execution|biometr|tetno|tętno|recovery|krok|kalor|jedz|jem|yazio|białk|bialk/.test(q)) return 'biometric';
  return 'open_reflection';
}

serve(async (req) => {
  const t0 = Date.now();
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { state_vector, history, current_query, user_id, mode = 'chat', thinking = false } = await req.json();
    console.log(`[oracle] start | user: ${user_id} | query: "${current_query?.substring(0, 50)}..."`);
    const supabase = createServiceClient();

    const now = new Date();
    const localTimeString = now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
    const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000)).toISOString();
    const fourteenDaysAgoDate = new Date(now.getTime() - (13 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const todayDate = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

    // === PLAN QUALITY AWARENESS (added for weak plan visibility) ===
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
    // Fix #003: Usunięto ładowanie martwych/pustych tabel z kontekstu Oracla
    // (iron_rules, repeated_patterns, known_persons).
    // Re-wpięto `vanguard_intentions` (2026-05-29): tabela jest ponownie używana
    // jako warstwa DEKLARACJI (declared-vs-actual). Wchodzi tylko gdy są aktywne
    // intencje — fetchDeclaredIntentions zwraca [] dla pustej, więc blok znika.
    // Zostawiono `vanguard_preferences` (ma dane z poprawek użytkownika).
    const [fundamentRes, preferencesRes, oura14dRes, nutrition14dRes, foodEntries14dRes, strainRes, declaredIntentions] = await Promise.all([
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
      fetchDeclaredIntentions(supabase, user_id),
    ]);

    const declaredIntentionsBlock = formatDeclaredIntentionsBlock(declaredIntentions);

    if (fundamentRes.error) console.error('[oracle] user_fundament query error:', fundamentRes.error);
    if (preferencesRes.error) console.error('[oracle] vanguard_preferences query error:', preferencesRes.error);
    if (oura14dRes.error) console.error('[oracle] oura_daily_summary query error:', oura14dRes.error);
    if (nutrition14dRes.error) console.error('[oracle] daily_nutrition query error:', nutrition14dRes.error);

    const staticProfile = `
[TŁO TOŻSAMOŚCI - KONTEKST]:
${fundamentRes.data?.identity || 'Brak danych'}
${fundamentRes.data?.philosophy || 'Brak danych'}
${fundamentRes.data?.vision || 'Brak danych'}
    `;

    const responsePrefs = preferencesRes.data?.map(p => `- ${p.value}`).join('\n') || '';
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
Dni Oura: ${healthSummary14d.oura_days_logged}; srednie kroki: ${healthSummary14d.avg_steps ?? 'brak danych'}; srednie active kcal: ${healthSummary14d.avg_active_calories ?? 'brak danych'}; srednie total burned kcal: ${healthSummary14d.avg_total_calories_burned ?? 'brak danych'}
Sen (Oura sensor): srednie godziny snu: ${healthSummary14d.avg_sleep_hours ?? 'brak danych'}h; srednie HRV: ${healthSummary14d.avg_hrv ?? 'brak danych'}; sredni readiness: ${healthSummary14d.avg_readiness ?? 'brak danych'}
Dni Yazio/daily_nutrition: ${healthSummary14d.nutrition_days_logged}; srednio zjedzone kcal: ${healthSummary14d.avg_food_calories ?? 'brak danych'}; srednie bialko: ${healthSummary14d.avg_protein ?? 'brak danych'}; srednie wegle: ${healthSummary14d.avg_carbs ?? 'brak danych'}; sredni tluszcz: ${healthSummary14d.avg_fat ?? 'brak danych'}; sredni blonnik: ${healthSummary14d.avg_fiber ?? 'brak danych'}; sredni cukier: ${healthSummary14d.avg_sugar ?? 'brak danych'}
Jakosc jedzenia: avg_food_quality to srednia wazona kalorycznie (0-100, real-food dietitian scale) — jesli null, analiza nie zostala jeszcze uruchomiona dla tego dnia. Pole q przy produkcie = jego food_quality_score.
Oura dzien po dniu (SUROWE DANE — zawiera bedtime_timestamp, total_sleep_hours, hrv_avg, rhr_avg, readiness_score, deep_sleep_hours, rem_sleep_hours, sleep_efficiency, latency_minutes): ${JSON.stringify(healthSummary14d.oura_daily)}
Jedzenie dzien po dniu (agregat, zawiera avg_food_quality i food_quality_analysis jesli analiza byla wykonana): ${JSON.stringify(healthSummary14d.nutrition_daily)}
Jedzenie dzien po dniu (produkty, pole q = food_quality_score jesli analiza byla wykonana): ${JSON.stringify(foodByDate)}`;

    // DAILY STRAIN — zintegrowany wskaźnik obciążenia/regeneracji (system decyzyjny)
    const strain14d = strainRes.data || [];
    const strainToday = strain14d[0] || null;
    const strainText = strain14d.length > 0 ? `[TRENING/OBCIĄŻENIE — DAILY STRAIN, DANE DETERMINISTYCZNE]:
To jest zintegrowany wskaźnik łączący bieg (Strava HR), siłownię, kroki, odżywianie (Yazio) i regenerację (Oura).
- strain_score: 0–21 (koszt fizjologiczny dnia). recovery_score: 0–100. fueling_score: 0–100. daily_status: green/yellow/red.
- main_limiter: co dziś najbardziej ogranicza (sleep/calories/carbs/cardio_load/strength_load/mental_load/recovery_ok).
- fueling_provisional: gdy true, fueling/kcal dla TEGO dnia są TYMCZASOWE — dzień jeszcze trwa, Yazio niedomknięte (cron liczy ~11:15). NIE twierdź o deficycie kalorycznym ani o "za mało jedzenia" na podstawie tymczasowego fuelingu; potraktuj go jako niepełny i powiedz, że doszacuje się po domknięciu dnia.
DZIŚ (${strainToday?.date}): Strain ${strainToday?.strain_score ?? '—'}/21, Recovery ${strainToday?.recovery_score ?? '—'}/100, Fueling ${strainToday?.fueling_score ?? '—'}/100${strainToday?.fueling_provisional ? ' (TYMCZASOWY — dzień niezamknięty, nie wnioskuj o deficycie)' : ''}, Status ${strainToday?.daily_status ?? '—'}, Limiter: ${strainToday?.main_limiter ?? '—'}. ${strainToday?.explanation ?? ''}
Gdy pytanie brzmi "czy mogę dziś cisnąć / jak forma / co mnie ogranicza" — odpowiadaj NA TYCH LICZBACH: green=można obciążać, yellow=ostrożnie/easy, red=regeneracja. Wskaż konkretny limiter. Jeśli fueling_provisional=true, fueling dziś nie jest finalnym limiterem.
Strain dzień po dniu (14d): ${JSON.stringify(strain14d)}` : '[DAILY STRAIN]: brak danych (jeszcze nie policzono).';

    // DYNAMIC CONTEXT (RAG)
    let semanticContext = "";
    let graphContext = "";
    let retrievedSources: any[] = [];
    let matchesRes: any = { data: [] };
    let graphRes: any = { data: [] };

    if (current_query) {
      try {
        const intentForGraph = classifyIntentSafe(current_query);
        const { data: mentioned } = await supabase.rpc('find_mentioned_entities', {
          query_text: current_query.substring(0, 1000),
          user_id_param: user_id
        });
        const entitiesInQuery = (mentioned as any[])?.map(m => m.entity_name) || [];
        const graphSeeds = buildGraphSeeds(current_query, intentForGraph, entitiesInQuery);
        const graphLayer = intentForGraph === 'biometric' ? null : 'intelligence';

        // Generate embedding for RAG
        const embedding = await getEmbedding(current_query.substring(0, 3000), Deno.env.get('OPENAI_API_KEY') ?? '');

        // HIPPOGRAPH PHASE 1: równolegle — content, semantic triples, entity seeds
        const [matchesResRaw, semanticGraphRes, entitySeedsRes] = await Promise.all([
          embedding ? supabase.rpc('match_vanguard_content', {
            query_embedding: embedding,
            match_threshold: 0.35,
            match_count: 5,
            user_id_param: user_id
          }) : Promise.resolve({ data: [] }),
          // Semantyczne szukanie trójek po embeddingach
          embedding ? supabase.rpc('search_entity_links', {
            query_embedding: embedding,
            match_user_id: user_id,
            match_count: 15
          }) : Promise.resolve({ data: [] }),
          // HippoRAG: znajdź encje semantycznie bliskie pytaniu → użyj jako seeds
          embedding ? supabase.rpc('find_entity_seeds_by_embedding', {
            query_embedding: embedding,
            match_user_id: user_id,
            match_count: 6
          }) : Promise.resolve({ data: [] })
        ]);

        if (matchesResRaw.error) throw matchesResRaw.error;
        if (semanticGraphRes.error) throw semanticGraphRes.error;
        if (entitySeedsRes.error) throw entitySeedsRes.error;

        matchesRes = matchesResRaw;

        // HIPPOGRAPH PHASE 2: rozszerz seeds o encje znalezione semantycznie
        const semanticEntitySeeds = (entitySeedsRes.data || [])
          .filter((s: any) => s.best_similarity > 0.5 && s.entity_name !== 'Jakub')
          .map((s: any) => s.entity_name);
        const allSeeds = [...new Set([...graphSeeds, ...semanticEntitySeeds])];
        console.log(`[oracle] HippoRAG seeds: [${allSeeds.join(', ')}] (string:${graphSeeds.length} + semantic:${semanticEntitySeeds.length})`);

        // HIPPOGRAPH PHASE 3: graph traversal z PEŁNYMI seeds
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

        // Merge graph results: entity-traversal + semantic, deduplikacja
        const entityGraphData = graphResRaw.data || [];
        const semanticGraphData = (semanticGraphRes.data || []).filter((sg: any) =>
          !entityGraphData.some((eg: any) =>
            eg.source_entity === sg.source_entity &&
            eg.relation === sg.relation &&
            eg.target_entity === sg.target_entity
          )
        );
        const allGraphData = [...entityGraphData, ...semanticGraphData];

        // --- RE-RANKING: hybrid score dla każdego wyniku ---
        const now2 = Date.now();

        // CURRENT-FIRST re-ranking: stare dane dostają penalty
        const rankedSemanticMatches = (matchesResRaw.data || []).map((m: any) => {
          const sim = m.similarity || m.hybrid_score || 0;
          const sourceWeight = m.table_name === 'vanguard_stream' ? 1.0
            : m.table_name === 'vanguard_knowledge' ? 0.85 : 0.75;
          const ageMs = m.source_date ? now2 - new Date(m.source_date).getTime() : 999999999999;
          const ageDays = ageMs / (24 * 3600 * 1000);
          // < 3 dni: bonus +0.15 | 3-21 dni: neutralne | > 21 dni: penalty -0.15 | > 60 dni: -0.3
          const recencyAdjust = ageDays < 3 ? 0.15
            : ageDays < 21 ? 0
            : ageDays < 60 ? -0.15
            : -0.3;
          return { ...m, _score: sim * sourceWeight + recencyAdjust, _age_days: Math.round(ageDays) };
        }).sort((a: any, b: any) => b._score - a._score).slice(0, 6);

        // Skoruj trójki grafu
        const rankedGraphData = allGraphData.map((g: any) => {
          const sim = g.similarity || 0;
          const evidenceBonus = Math.min(Math.log1p(g.evidence_count || 1) * 0.05, 0.2);
          const confidenceBonus = (g.confidence_score || 0.5) * 0.1;
          return { ...g, _score: sim * 0.7 + evidenceBonus + confidenceBonus };
        }).sort((a: any, b: any) => b._score - a._score).slice(0, 20);

        matchesRes = { data: rankedSemanticMatches };
        graphRes = { data: rankedGraphData };

        // Fix #004 – logujemy gdy RAG nie zwrócił nic (częsty przypadek degradacji)
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
          });
        }

        // --- DETERMINISTIC SOURCES ---
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
        const { cut72h: cutoff72h } = getStreamCutoffs();

        const streamSlices = await fetchOracleStreamSlices(supabase, user_id, {
          includePatternWindow: true,
          patternLimit: isPatternQuery ? 15 : 5,
        });
        console.log(`[oracle] stream: ${streamSlices.current.length} current + ${streamSlices.recent.length} recent`, Date.now() - t0);
        semanticContext += formatOracleStreamBlock(streamSlices.current, streamSlices.recent);

        // FRICTION EVENTS — ostatnie 72h
        try {
          const { data: frictionRecent, error: feErr } = await supabase
            .from('friction_events')
            .select('friction_type, deviation, immediate_cost, declared_intention, occurred_at, confidence_source, confidence')
            .eq('user_id', user_id)
            .gte('occurred_at', cutoff72h)
            .order('occurred_at', { ascending: false });

          if (feErr) throw feErr;

          if (frictionRecent && frictionRecent.length > 0) {
            semanticContext += "\n\n[FRICTION EVENTS (ostatnie 72h) — atomy tarcia]:\n" +
              frictionRecent.map((f: any) =>
                `[${f.occurred_at}] ${f.friction_type} | odchylenie: ${f.deviation || '—'} | intencja: ${f.declared_intention || '—'} | koszt: ${f.immediate_cost || '—'} [${f.confidence_source}, conf=${f.confidence}]`
              ).join('\n');
          }
        } catch (fe) {
          console.error('[oracle] friction fetch error:', fe);
          throw fe;
        }

        if (rankedGraphData.length > 0) {
          graphContext = "\n[GRAF POWIĄZAŃ (Re-ranked, top 20)]:\n" + rankedGraphData.map((g: any) => `- ${g.source_entity} ${g.relation} ${g.target_entity}`).join('\n');
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

    // --- INTENT CLASSIFICATION (Fast-Path) ---
    let intent = classifyIntentSafe(current_query);
    console.log(`[oracle] intent classified: ${intent}`, Date.now() - t0);

    // === Etap 1: Behavioral Patterns context (z detektorów S1/S4 zapisanych w reconciliation) ===
    let behavioralPatternsContext = '';
    const wantsPatterns = intent === 'recent_pattern' ||
      /\b(wzorzec|schemat|powtarza|powtarzaln|trend|dlaczego znowu|co się dzieje z|ostatnio mam problem)\b/.test((current_query || '').toLowerCase());

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

    const systemPrompt = `Jesteś Vanguard OS — systemem current-first do logowania mikrotarć i wykrywania wzorców behawioralnych.
MÓWISZ TYLKO PO POLSKU.

TON ABSOLUTNY:
Dozwolone: zimne fakty, krótkie challenge, "To jest analiza", "Jaki artefakt powstanie?", "Nie nadrabiamy dnia", "Ratujemy pierwszy artefakt".
Zakazane: motywacyjne gadki, psychoanaliza, moralizowanie, diagnozy, długie eseje, wzmacnianie self-analysis, rozbudowywanie nowych frameworków w odpowiedzi na drift. Max 1 pytanie na odpowiedź, skupione na konkretnym artefakcie (production_artifact) lub ruchu napięciowym (tension_action). Odpowiedzi muszą być krótkie, surowe i konkretne. Zawsze dąż do konfrontacji analizy z fizycznym działaniem.
${mode === 'mirror' ? `\nTRYB OBSERWACJI: Opisujesz co widzisz w danych. Nie pytasz. Kończysz obserwacją lub wnioskiem.\n` : ''}${mode === 'planning' ? `\nTRYB PLANOWANIA WIECZORNEGO:\nJesteś facylitatorem planowania — pomagasz Jakubowi zaplanować jutrzejszy dzień.\n\nZASADY:\n- Odwołaj się do reconciliation (co dziś poszło źle/dobrze) — krótko, bez oceniania\n- Jeśli wczorajszy plan był niskiej jakości (plan_quality=minimum/rescue lub ma failure_reason) — wyraźnie to odnotuj i pomóż skorygować zamiast budować na słabym planie\n- Przejrzyj jego aktywne intencje i listę zadań z [KONTEKST SYSTEMOWY]\n- Zadaj konkretne pytania: co MUSI jutro zostać zrobione? co może nie wyjść? jest coś pilnego?\n- Pomóż ustalić TOP 3 priorytety na jutro\n- Zidentyfikuj potencjalne przeszkody i dlaczego może się nie udać\n- Jeśli masz dane z Todoist — wymień nieukończone zadania i zapytaj o priorytety\n- Możesz zaproponować konkretne godziny w harmonogramie\n\nFORMAT: Bezpośredni, konkretny, po polsku. Max 220 słów na jedną odpowiedź. Kończ pytaniem lub konkretną propozycją do potwierdzenia.\nZAKAZ: Moralizowania, psychoanalizy, ogólnych rad bez zakorzenienia w danych.\n` : ''}
ZWRACAJ ODPOWIEDŹ W FORMACIE JSON:
{
  "answer": "Twoja odpowiedź",
  "confidence": "high | medium | low",
  "intent_confirmed": "${intent}",
  "claims": [
    {
      "type": "fact | hypothesis | recommendation",
      "text": "krótkie stwierdzenie",
      "source_hint": "data i źródło (np. Stream 2026-05-16)",
      "temporal_status": "current | historical | declared | hypothesis | stale | unknown"
    }
  ]
}

[TŁO TOŻSAMOŚCI — kontekst wewnętrzny, nie cytować]:
${fundamentRes.data?.identity || 'Brak danych'}
${fundamentRes.data?.philosophy || 'Brak danych'}
${fundamentRes.data?.vision || 'Brak danych'}
${declaredIntentionsBlock}

[LOGIKA CZASU]:
Dziś: ${localTimeString} (Warsaw). Zakaz meta-komentarzy.
${state_vector?.today_plan?.top3 ? `
[PLAN NA DZIŚ — wczorajsze planowanie wieczorne]:
First move: ${state_vector.today_plan.first_move_morning || state_vector.today_plan.pierwszy_ruch || '—'}
Top 3: ${(state_vector.today_plan.top3 as string[]).map((t: string, i: number) => `${i + 1}. ${t}`).join(' | ')}
Minimum viable day: ${state_vector.today_plan.minimum_viable_day || '—'}
Ryzyko: ${state_vector.today_plan.biggest_risk || state_vector.today_plan.ryzyko || '—'}
Kontrplan: ${state_vector.today_plan.counterplan || state_vector.today_plan.kontrplan || '—'}${(state_vector.today_plan.open_loops as string[] || []).filter(Boolean).length > 0 ? `\nOtwarte petle: ${(state_vector.today_plan.open_loops as string[]).join(', ')}` : ''}
ZASADA: Gdy Jakub opisuje działania wyraźnie niezgodne z Top 3 — odnotuj, bez moralizowania.
` : ''}

${recentPlanQuality ? `
[JAKOŚĆ OSTATNIEGO PLANU — WAŻNE]:
plan_quality: ${recentPlanQuality.plan_quality || 'unknown'}
mode: ${recentPlanQuality.mode || 'unknown'}
failure_reason: ${recentPlanQuality.plan_failure_reason || 'none'}
was_fallback: ${recentPlanQuality.plan_fallback}
parse_error: ${recentPlanQuality.parse_error}
Jeśli plan_quality jest 'minimum' lub 'rescue' albo jest failure_reason — traktuj ten plan jako słaby sygnał. Nie buduj na nim silnych założeń. Pytaj o korektę.
` : ''}

${lastEveningReflection ? `
[WCZORAJSZA REFLEKSJA UŻYTKOWNIKA (z wieczornej reconciliation — surowe dane)]:
Data: ${lastEveningReflection.date}
${lastEveningReflection.biggest_cost ? `Największy koszt (użytkownik): ${lastEveningReflection.biggest_cost}\n` : ''}${lastEveningReflection.best_move ? `Najlepszy ruch (użytkownik): ${lastEveningReflection.best_move}\n` : ''}${lastEveningReflection.blocker_candidates?.length ? `Blokery, które użytkownik sam nazwał: ${lastEveningReflection.blocker_candidates.join('; ')}\n` : ''}${lastEveningReflection.day_score ? `Ocena dnia (użytkownik): ${lastEveningReflection.day_score}/5\n` : ''}To są słowa użytkownika, nie interpretacja systemu. Używaj tylko jako kontekst tego, co sam zauważył wieczorem. Jeśli needs_manual_review — traktuj z rezerwą.
` : ''}

${behavioralPatternsContext ? `
[POWTARZALNE WZORCE BEHAWIORALNE — TYLKO DOWODY Z TWOICH DANYCH (Etap 1)]:
${behavioralPatternsContext}
Zasada: To są powtarzalne obserwacje wykryte przez system na podstawie Twoich wieczornych odpowiedzi (p2) + tarć + planów. Zawsze cytuj N i poziom pewności. Używaj wyłącznie jako faktograficzny kontekst. Zero interpretacji, zero diagnoz, zero rad bez wyraźnego pytania użytkownika.
` : ''}

[STATUS WIEDZY — używaj przy każdej tezie]:
- current: potwierdzone danymi <14 dni
- historical: kiedyś prawda, może nieaktualne
- declared: Jakub kiedyś powiedział, nie potwierdzone świeżo
- hypothesis: interpretacja AI, brak twardego potwierdzenia
- stale: stare dane wymagające odświeżenia
- unknown: brak proweniencji

[KONTEKST SYSTEMOWY]:
${JSON.stringify(state_vector || {}, null, 2)}

${healthSummaryText}

${strainText}

PAMIĘĆ SEMANTYCZNA I GRAF:
${semanticContext}
${graphContext}

[PRIORYTETY WIEDZY — CURRENT-FIRST]:
1. TERAŹNIEJSZOŚĆ (ostatnie 72h) — źródło prawdy. Zawsze ma pierwszeństwo.
2. KONTEKST 3–21 DNI — trend i wzorzec.
3. ARCHIWUM (>21 dni) — tylko tło. NIGDY jako aktualna prawda.

[EVIDENCE-FIRST — BEZWZGLĘDNA]:
- Każda mocna teza = konkretny wpis ze Strumienia lub biometrii + jego data.
- Dane z [ARCHIWUM] → "Wcześniej X, ale nie wiem czy to nadal aktualne."
- Brak danych z 7 dni → "Nie mam świeżych danych o X."
- Pytania o kroki/kalorie odpowiadaj z sekcji [ZDROWIE/JEDZENIE - OSTATNIE 14 DNI]. Jeśli średnia nie jest null, nie wolno twierdzić, że nie masz danych.
- Nie mieszaj historii z teraźniejszością.
- Bez evidence → tylko: "Hipoteza: ..."

[GRAPH IS EVIDENCE MEMORY, NOT TRUTH]:
Graf to pamięć dowodów. Krawędź w grafie to nie fakt — to zapamiętana obserwacja z datą i statusem.

${responsePrefs ? `[PREFERENCJE ODPOWIEDZI]:\n${responsePrefs}` : ''}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(-10)
    ];

    if (current_query) {
      messages.push({ role: "user", content: current_query });
    }

    console.log(`[oracle] deepseek start`, Date.now() - t0);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // keep the whole Edge call below platform limits

    let structuredResponse;
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
        },
        body: JSON.stringify({
          model: thinking ? 'deepseek-reasoner' : 'deepseek-v4-flash',
          messages: messages,
          temperature: 0.7,
          ...(!thinking ? { response_format: { type: "json_object" } } : {})
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errBody = await response.text().catch(() => "Unknown error");
        throw new Error(`DeepSeek API Error (${response.status}): ${errBody.substring(0, 200)}`);
      }

      const result = await response.json();
      console.log(`[oracle] deepseek done`, Date.now() - t0);
      const rawOutput = result.choices?.[0]?.message?.content || "{}";
      try {
        structuredResponse = JSON.parse(stripJsonFence(rawOutput));
      } catch (_parseError) {
        // deepseek-v4-flash (reasoning model) sometimes returns ONLY a <think> block
        // with no text after it. Strip think tags first; if nothing remains, extract
        // the think content so Telegram doesn't receive an empty string.
        const thinkStripped = rawOutput.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        const thinkContent = rawOutput.match(/<think>([\s\S]*?)<\/think>/i)?.[1]?.trim() || '';
        if (!thinkStripped && thinkContent) {
          console.warn('[oracle] model returned only <think> block — extracting think content as answer');
        } else {
          console.log('[oracle] JSON parse failed, using text as answer');
        }
        structuredResponse = {
          answer: thinkStripped || thinkContent || rawOutput,
          confidence: thinkStripped ? "medium" : "low",
          intent_confirmed: intent,
          claims: []
        };
      }
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("DeepSeek response failed:", e);
      throw e;
    }
    const text = structuredResponse.answer || structuredResponse.text || structuredResponse.odpowiedz || structuredResponse.response || "Błąd generowania odpowiedzi.";

    try {
      await supabase.from('vanguard_oracle_runs').insert({
        user_id,
        query: current_query || "",
        intent: structuredResponse.intent_confirmed || intent,
        answer: text,
        confidence: structuredResponse.confidence || "medium",
        claims: structuredResponse.claims || [],
        sources: retrievedSources,
        retrieved_context: {
          semantic: matchesRes.data || [],
          graph: graphRes.data || [],
          health_14d: healthSummary14d,
        },
        state_vector: state_vector || {},
      });
    } catch (e) {
      await logCriticalError({
        area: 'oracle',
        error: e,
        message: 'Failed to insert oracle run audit log',
      });
    }

    console.log(`[oracle] response returned`, Date.now() - t0);
    return new Response(JSON.stringify({
      ...structuredResponse,
      text,
      sources: retrievedSources,
      intent_confirmed: structuredResponse.intent_confirmed || intent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await logCriticalError({
      area: 'oracle',
      error,
      message: 'Oracle function fatal error',
    });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
