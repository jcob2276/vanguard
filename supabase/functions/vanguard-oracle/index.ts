import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function classifyIntent(query = '') {
  const q = query.toLowerCase();
  if (/wiek|urodzin|studi|kim jestem|fundament|identity|tożsamość/.test(q)) return 'identity';
  if (/jul|tomoń|ekiert|klaud|paweł|osob|relac|dziewczyn/.test(q)) return 'person';
  if (/ostatnio|7 dni|wzorc|powtarza|trend|history/.test(q)) return 'recent_pattern';
  if (/sen|hrv|oura|execution|biometr|tętno|recovery|krok|kalor|jedz|jem|yazio|białk|bialk/.test(q)) return 'biometric';
  return 'open_reflection';
}

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
  const selfReference = /\b(ja|mnie|mi|moje|moja|moj|u mnie|o mnie|mĂłj|mój)\b/.test(q);
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
  if (/ostatnio|7 dni|trend|history/.test(q)) return 'recent_pattern';
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const localTimeString = now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
    const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000)).toISOString();
    const fourteenDaysAgoDate = new Date(now.getTime() - (13 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const todayDate = now.toISOString().split('T')[0];

    // STATIC CONTEXT
    const [fundamentRes, ironRulesRes, patternsRes, personsRes, intentionsRes, preferencesRes, oura14dRes, nutrition14dRes] = await Promise.all([
      supabase.from('user_fundament')
        .select('identity, philosophy, vision')
        .eq('user_id', user_id)
        .maybeSingle(),
      supabase.from('vanguard_iron_rules')
        .select('content')
        .eq('user_id', user_id)
        .eq('is_active', true),
      supabase.from('vanguard_repeated_patterns')
        .select('pattern_name, description')
        .eq('user_id', user_id),
      supabase.from('vanguard_known_persons')
        .select('name, relation, context')
        .eq('user_id', user_id),
      supabase.from('vanguard_intentions')
        .select('content, category')
        .eq('user_id', user_id)
        .eq('is_active', true),
      supabase.from('vanguard_preferences')
        .select('value')
        .eq('user_id', user_id)
        .eq('is_active', true),
      supabase.from('oura_daily_summary')
        .select('date, steps, active_calories, total_calories')
        .eq('user_id', user_id)
        .gte('date', fourteenDaysAgoDate)
        .order('date', { ascending: false }),
      supabase.from('daily_nutrition')
        .select('date, calories, protein')
        .eq('user_id', user_id)
        .gte('date', fourteenDaysAgoDate)
        .order('date', { ascending: false })
    ]);

    const staticProfile = `
[TŁO TOŻSAMOŚCI - KONTEKST]:
${fundamentRes.data?.identity || 'Brak danych'}
${fundamentRes.data?.philosophy || 'Brak danych'}
${fundamentRes.data?.vision || 'Brak danych'}
    `;

    const ironRulesText = ironRulesRes.data?.map(r => `- ${r.content}`).join('\n');
    const repeatedPatterns = patternsRes.data?.map(p => `- ${p.pattern_name}: ${p.description}`).join('\n');
    const knownPersons = personsRes.data?.map(p => `- ${p.name} (${p.relation}): ${p.context}`).join('\n');
    const activeIntentions = intentionsRes.data?.map(i => `- [${i.category}] ${i.content}`).join('\n');
    const responsePrefs = preferencesRes.data?.map(p => `- ${p.value}`).join('\n') || '';
    const oura14d = oura14dRes.data || [];
    const nutrition14d = nutrition14dRes.data || [];
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
      oura_daily: oura14d,
      nutrition_daily: nutrition14d
    };
    const healthSummaryText = `[ZDROWIE/JEDZENIE - OSTATNIE 14 DNI, DANE DETERMINISTYCZNE]:
Zakres: ${healthSummary14d.date_from} - ${healthSummary14d.date_to}
Dni Oura: ${healthSummary14d.oura_days_logged}; srednie kroki: ${healthSummary14d.avg_steps ?? 'brak danych'}; srednie active kcal: ${healthSummary14d.avg_active_calories ?? 'brak danych'}; srednie total burned kcal: ${healthSummary14d.avg_total_calories_burned ?? 'brak danych'}
Dni Yazio/daily_nutrition: ${healthSummary14d.nutrition_days_logged}; srednio zjedzone kcal: ${healthSummary14d.avg_food_calories ?? 'brak danych'}; srednie bialko: ${healthSummary14d.avg_protein ?? 'brak danych'}
Oura dzien po dniu: ${JSON.stringify(healthSummary14d.oura_daily)}
Jedzenie dzien po dniu: ${JSON.stringify(healthSummary14d.nutrition_daily)}`;

    const knownPersonsLine = knownPersons ? `ZNASZ NASTĘPUJĄCE OSOBY:\n${knownPersons}` : '';

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
        const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: current_query.substring(0, 3000).replace(/\n/g, ' '),
          }),
        });

        if (!embedRes.ok) {
          console.warn(`OpenAI Embedding error: ${embedRes.status}`);
        }

        const embedData = await embedRes.json().catch(() => ({}));
        const embedding = embedData.data?.[0]?.embedding;

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

        // CURRENT-FIRST: 72h aktywne, potem 21 dni jako kontekst
        const now3 = new Date();
        const cutoff72h = new Date(now3.getTime() - 72 * 60 * 60 * 1000).toISOString();
        const cutoff21d = new Date(now3.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString();
        const isPatternQuery = current_query.toLowerCase().match(/ostatnio|7 dni|trend|wzorc|wzorzec/);

        const [streamCurrentRes, streamRecentRes] = await Promise.all([
          // Ostatnie 72h — zawsze, bez limitu kontekstu
          supabase.from('vanguard_stream')
            .select('content, created_at')
            .eq('user_id', user_id)
            .gte('created_at', cutoff72h)
            .order('created_at', { ascending: false })
            .limit(15),
          // 3–21 dni — tylko jeśli pattern query lub brak danych 72h
          supabase.from('vanguard_stream')
            .select('content, created_at')
            .eq('user_id', user_id)
            .lt('created_at', cutoff72h)
            .gte('created_at', cutoff21d)
            .order('created_at', { ascending: false })
            .limit(isPatternQuery ? 15 : 5)
        ]);

        console.log(`[oracle] stream: ${streamCurrentRes.data?.length || 0} current + ${streamRecentRes.data?.length || 0} recent`, Date.now() - t0);

        if (streamCurrentRes.data && streamCurrentRes.data.length > 0) {
          const current = [...streamCurrentRes.data].reverse();
          semanticContext += "\n\n[TERAŹNIEJSZOŚĆ (ostatnie 72h) — PRIORYTET ABSOLUTNY]:\n" +
            current.map(s => `[${s.created_at}] ${s.content}`).join('\n');
        }

        if (streamRecentRes.data && streamRecentRes.data.length > 0) {
          const recent = [...streamRecentRes.data].reverse();
          semanticContext += "\n\n[KONTEKST OSTATNICH 3–21 DNI]:\n" +
            recent.map(s => `[${s.created_at}] ${s.content}`).join('\n');
        }

        // FRICTION EVENTS — ostatnie 72h
        try {
          const { data: frictionRecent } = await supabase
            .from('friction_events')
            .select('friction_type, deviation, immediate_cost, declared_intention, occurred_at, confidence_source, confidence')
            .eq('user_id', user_id)
            .gte('occurred_at', cutoff72h)
            .order('occurred_at', { ascending: false });

          if (frictionRecent && frictionRecent.length > 0) {
            semanticContext += "\n\n[FRICTION EVENTS (ostatnie 72h) — atomy tarcia]:\n" +
              frictionRecent.map((f: any) =>
                `[${f.occurred_at}] ${f.friction_type} | odchylenie: ${f.deviation || '—'} | intencja: ${f.declared_intention || '—'} | koszt: ${f.immediate_cost || '—'} [${f.confidence_source}, conf=${f.confidence}]`
              ).join('\n');
          }
        } catch (fe) {
          console.warn('[oracle] friction fetch error:', fe);
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
        console.error("RAG Error:", err);
      }
    }

    // --- INTENT CLASSIFICATION (Fast-Path) ---
    let intent = classifyIntentSafe(current_query);
    console.log(`[oracle] intent classified: ${intent}`, Date.now() - t0);

    const systemPrompt = `Jesteś Vanguard OS — systemem current-first do logowania mikrotarć i wykrywania wzorców behawioralnych.
MÓWISZ TYLKO PO POLSKU.
${mode === 'mirror' ? `\nTRYB OBSERWACJI: Opisujesz co widzisz w danych. Nie pytasz. Kończysz obserwacją lub wnioskiem.\n` : ''}${mode === 'planning' ? `\nTRYB PLANOWANIA WIECZORNEGO:\nJesteś facylitatorem planowania — pomagasz Jakubowi zaplanować jutrzejszy dzień.\n\nZASADY:\n- Odwołaj się do reconciliation (co dziś poszło źle/dobrze) — krótko, bez oceniania\n- Przejrzyj jego aktywne intencje i listę zadań z [KONTEKST SYSTEMOWY]\n- Zadaj konkretne pytania: co MUSI jutro zostać zrobione? co może nie wyjść? jest coś pilnego?\n- Pomóż ustalić TOP 3 priorytety na jutro\n- Zidentyfikuj potencjalne przeszkody i dlaczego może się nie udać\n- Jeśli masz dane z Todoist — wymień nieukończone zadania i zapytaj o priorytety\n- Możesz zaproponować konkretne godziny w harmonogramie\n\nFORMAT: Bezpośredni, konkretny, po polsku. Max 220 słów na jedną odpowiedź. Kończ pytaniem lub konkretną propozycją do potwierdzenia.\nZAKAZ: Moralizowania, psychoanalizy, ogólnych rad bez zakorzenienia w danych.\n` : ''}
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

${ironRulesText ? `[ŻELAZNE ZASADY]:\n${ironRulesText}` : ''}
${repeatedPatterns ? `[WZORCE (z danych — nie interpretować jako aktualne bez świeżego potwierdzenia)]:\n${repeatedPatterns}` : ''}
${responsePrefs ? `[PREFERENCJE ODPOWIEDZI]:\n${responsePrefs}` : ''}
${mode !== 'mirror' && knownPersonsLine ? `\n${knownPersonsLine}` : ''}
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
        console.log("Parsing failed, assuming raw text from reasoner");
        structuredResponse = {
          answer: rawOutput,
          confidence: "medium",
          intent_confirmed: intent,
          claims: []
        };
      }
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("DeepSeek response failed:", e);
      structuredResponse = {
        answer: thinking
          ? "Deep analysis przekroczyl limit czasu. Sprobuj zwyklego pytania bez !! albo zawez temat."
          : "Wyrocznia przekroczyla limit czasu. Mam zapisany kontekst, ale model nie zdazyl odpowiedziec.",
        confidence: "low",
        intent_confirmed: intent,
        claims: []
      };
    }
    const text = structuredResponse.answer || structuredResponse.text || structuredResponse.odpowiedz || structuredResponse.response || "Błąd generowania odpowiedzi.";

    // @ts-ignore
    EdgeRuntime.waitUntil((async () => {
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
            health_14d: healthSummary14d
          },
          state_vector: state_vector || {}
        });
      } catch (e) {
        console.error("Oracle audit log error:", e);
      }

      // DISABLED — Sprint 0.7 (2026-05-17)
      // Oracle memory loop wrote to vanguard_knowledge and vanguard_entity_links on every
      // conversation turn — unaudited mutations outside the source-of-truth pipeline.
      // Only vanguard_stream → vanguard-auto-classify is the allowed ingestion path
      // during Observation Mode. Re-enable in Sprint 1 with explicit temporal guards.
    })());

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
    console.error("Oracle Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
