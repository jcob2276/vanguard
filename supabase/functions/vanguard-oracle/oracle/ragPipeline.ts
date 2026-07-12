import { getEmbedding } from "../../_shared/openai.ts";
import { fetchOracleStreamSlices, formatOracleStreamBlock } from "../../_shared/streamContext.ts";
import { logCriticalError } from "../../_shared/errorLogging.ts";
import { truncateToBudget, buildGraphSeeds } from "./ragHelpers.ts";

export async function runRagPipeline(
  supabase: any,
  user_id: string,
  current_query: string,
  intent: string,
  cutoff72h: string,
  proposalsRes: any,
) {
  let semanticContext = "";
  let graphContext = "";
  let retrievedSources: any[] = [];
  let matchesRes: any = { data: [] };
  let graphRes: any = { data: [] };

  try {
    console.log(`[oracle] Starting 3-step retrieval pipeline for query: "${current_query.substring(0, 60)}..."`);

    // Step 1: Facts Layer
    const { data: mentioned } = await supabase.rpc('find_mentioned_entities', {
      query_text: current_query.substring(0, 1000),
      user_id_param: user_id
    });
    const entitiesInQuery = (mentioned as any[])?.map(m => m.entity_name) || [];
    const graphSeeds = buildGraphSeeds(current_query, intent, entitiesInQuery);
    const graphLayer = intent === 'biometric' ? null : 'intelligence';

    const entityGraphData = graphSeeds.length > 0
      ? (await supabase.rpc('get_vanguard_graph_context', {
          start_entities: graphSeeds, max_depth: 2, user_id_param: user_id,
          p_layer: graphLayer, p_include_historical: intent === 'identity', p_min_confidence: 0.7
        })).data || []
      : [];

    const embedding = await getEmbedding(current_query.substring(0, 1000), Deno.env.get('OPENAI_API_KEY') ?? '').catch(() => null);
    const semanticGraphRes = embedding
      ? (await supabase.rpc('search_entity_links', { query_embedding: embedding, match_user_id: user_id, match_count: 15 })).data || []
      : [];

    const fulltextGraphRes = (await supabase.rpc('search_entity_links_fulltext', {
      query_text: current_query.substring(0, 500), match_user_id: user_id, match_count: 15
    })).data || [];

    const factsPool = [...entityGraphData, ...semanticGraphRes, ...fulltextGraphRes];
    const factsMap = new Map<string, any>();
    for (const f of factsPool) {
      if (f.epistemic_status === 'hypothesis') continue;
      const key = f.fact_text || `${f.source_entity}|${f.relation}|${f.target_entity}`;
      if (!factsMap.has(key)) factsMap.set(key, f);
    }

    const uniqueFacts = Array.from(factsMap.values());
    console.log(`[RAG LOG] Step 1 (Facts): Retrieved ${uniqueFacts.length} unique facts.`);

    if (uniqueFacts.length > 0) {
      graphContext = truncateToBudget("[WARSTWA FAKTÓW (Zweryfikowana wiedza)]:\n" + uniqueFacts.map((f: any) => f.fact_text ? `- ${f.fact_text}` : `- ${f.source_entity} ${f.relation} ${f.target_entity}`).join('\n'), 4000);
    } else {
      graphContext = "[WARSTWA FAKTÓW]: Brak pasujących zweryfikowanych faktów.";
    }

    matchesRes = { data: semanticGraphRes };
    graphRes = { data: entityGraphData };

    // Step 2: Hypotheses Layer
    const { data: hypothesisRes } = await supabase.from('claims')
      .select('fact_text, weight, evidence_count, learned_at')
      .eq('user_id', user_id).eq('epistemic_status', 'hypothesis').eq('status', 'active')
      .order('learned_at', { ascending: false }).limit(10);

    console.log(`[RAG LOG] Step 2 (Hypotheses): Retrieved ${hypothesisRes?.length || 0}.`);

    if (hypothesisRes && hypothesisRes.length > 0) {
      graphContext += "\n\n" + truncateToBudget(
        "[WARSTWA HIPOTEZ (Niepotwierdzone przypuszczenia)]:\nUWAGA: To NIE SĄ fakty.\n" +
        hypothesisRes.map((h: any) => `- ${h.fact_text} (obserwacji: ${h.evidence_count || 1})`).join('\n'), 2500);
    }

    const proposalsList = proposalsRes?.data || [];
    if (proposalsList.length > 0) {
      graphContext += "\n\n" + "[AKTYWNE PROPOZYCJE SYSTEMOWE]:\n" + proposalsList.map((p: any) => `- [${p.category}] ${p.title}: ${p.description}`).join('\n');
    }

    // Step 3: Narrative & Stream Layer
    const isPatternQuery = !!current_query.toLowerCase().match(/ostatnio|7 dni|trend|wzorc|wzorzec/);
    const streamSlices = await fetchOracleStreamSlices(supabase, user_id, {
      includePatternWindow: true, patternLimit: isPatternQuery ? 15 : 5,
    });

    let narrativeText = "[WARSTWA NARRACJI]:\n" + formatOracleStreamBlock(streamSlices.current, streamSlices.recent);

    try {
      const { data: frictionRecent } = await supabase.from('friction_events')
        .select('friction_type, deviation, immediate_cost, declared_intention, occurred_at, confidence_source, confidence')
        .eq('user_id', user_id).gte('occurred_at', cutoff72h).order('occurred_at', { ascending: false });
      if (frictionRecent && frictionRecent.length > 0) {
        narrativeText += "\n\n[FRICTION EVENTS (72h)]:\n" + frictionRecent.map((f: any) =>
          `[${f.occurred_at}] ${f.friction_type} | odchylenie: ${f.deviation || '—'} | intencja: ${f.declared_intention || '—'} | koszt: ${f.immediate_cost || '—'} [${f.confidence_source}]`
        ).join('\n');
      }
    } catch (fe) { console.warn('[oracle] friction fetch error:', fe); }

    semanticContext = truncateToBudget(narrativeText, 4000);
    console.log(`[RAG LOG] Step 3 (Narrative): Done.`);

    retrievedSources = uniqueFacts.slice(0, 10).map((f: any) => ({
      table: 'claims', type: 'fact',
      snippet: f.fact_text || `${f.source_entity} --${f.relation}--> ${f.target_entity}`
    }));
    if (hypothesisRes) {
      retrievedSources.push(...hypothesisRes.map((h: any) => ({ table: 'claims', type: 'hypothesis', snippet: h.fact_text })));
    }

  } catch (err) {
    await logCriticalError({ area: 'oracle', error: err, message: 'RAG retrieval failed', metadata: { nonFatal: true } });
    semanticContext += "\n\n[SYSTEM: RAG niedostępny]";
  }

  return { semanticContext, graphContext, retrievedSources, matchesRes, graphRes };
}
