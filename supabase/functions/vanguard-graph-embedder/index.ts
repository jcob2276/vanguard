import { getEmbedding } from "../_shared/openai.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders } from "../_shared/supabase.ts"
import { getVanguardUserId } from "../_shared/constants.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

async function embedBatch(texts: string[]): Promise<number[][]> {
  const embeddings = await getEmbedding(texts, OPENAI_API_KEY);
  if (!embeddings) throw new Error("Failed to generate embeddings batch");
  return embeddings as number[][];
}

/**
 * Graphiti-inspired: embed the full fact sentence, not just "source relation target".
 * Richer text = better semantic coverage across diverse question formulations.
 *
 * Before: "Jakub studiuje Cyberbezpieczeństwo"
 * After:  "Jakub (osoba) studiuje Cyberbezpieczeństwo (kierunek). Fakt potwierdzony 5 razy. Pewność: wysoka."
 */
function buildFactText(link: {
  source_entity: string;
  source_type: string | null;
  relation: string;
  target_entity: string;
  target_type: string | null;
  memory_type: string | null;
  confidence_score: number | null;
  evidence_count: number | null;
}): string {
  const relationHuman = link.relation.replace(/_/g, ' ');
  const sourceLabel = link.source_type ? `${link.source_entity} (${link.source_type})` : link.source_entity;
  const targetLabel = link.target_type ? `${link.target_entity} (${link.target_type})` : link.target_entity;

  const conf = link.confidence_score ?? 0.8;
  const confLabel = conf >= 0.9 ? 'wysoka' : conf >= 0.7 ? 'średnia' : 'niska';
  const evidenceNote = link.evidence_count && link.evidence_count > 1
    ? `Potwierdzony ${link.evidence_count} razy.`
    : '';
  const typeNote = link.memory_type && link.memory_type !== 'fact'
    ? ` Typ: ${link.memory_type}.`
    : '';

  return `${sourceLabel} ${relationHuman} ${targetLabel}.${typeNote} Pewność: ${confLabel}. ${evidenceNote}`.trim();
}

/** One batch per invocation — caller re-invokes until remaining is 0. */
async function runBackfillBatch(
  user_id: string,
  batch_size: number,
  force_reembed: boolean,
): Promise<{ processed: number; updated: number; remaining: number | null }> {
  const supabase = createServiceClient();

  const query = supabase
    .from('vanguard_entity_links')
    .select('id, source_entity, source_type, relation, target_entity, target_type, memory_type, confidence_score, evidence_count')
    .eq('user_id', user_id)
    .limit(batch_size);

  // force_reembed=true: re-embed all (fact_text changed); otherwise only missing embeddings
  if (!force_reembed) {
    query.is('embedding', null);
  } else {
    query.is('fact_text', null);
  }

  const { data: links, error } = await query;

  if (error) {
    console.error('[embedder] Fetch error:', error);
    throw error;
  }
  if (!links || links.length === 0) {
    console.log('[embedder] All done');
    return { processed: 0, updated: 0, remaining: 0 };
  }

  const factTexts = links.map(buildFactText);
  const embeddings = await embedBatch(factTexts);

  for (let i = 0; i < links.length; i++) {
    const { error: updateErr } = await supabase
      .from('vanguard_entity_links')
      .update({ embedding: embeddings[i], fact_text: factTexts[i] })
      .eq('id', links[i].id);
    if (updateErr) console.error(`[embedder] Update error id=${links[i].id}:`, updateErr);
  }

  const countQuery = supabase
    .from('vanguard_entity_links')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user_id);

  if (!force_reembed) countQuery.is('embedding', null);
  else countQuery.is('fact_text', null);

  const { count: remaining } = await countQuery;

  console.log(`[embedder] Batch done: ${links.length} updated, ~${remaining ?? '?'} remaining`);
  return { processed: links.length, updated: links.length, remaining: remaining ?? null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const user_id = body.user_id || getVanguardUserId();
    const batch_size = body.batch_size ? Number(body.batch_size) : 50;
    const force_reembed = body.force_reembed === true; // re-embed all with new fact_text

    const result = await runBackfillBatch(user_id, batch_size, force_reembed);

    return new Response(JSON.stringify({
      success: true,
      ...result,
      message: result.remaining === 0
        ? 'Backfill complete'
        : `Batch embedded; ~${result.remaining} triples remaining — invoke again`,
      estimated_cost_usd: ((result.processed || 0) * 0.000002).toFixed(4),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    console.error('[embedder] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
