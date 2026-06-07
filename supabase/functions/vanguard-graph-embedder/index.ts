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

/** One batch per invocation — caller re-invokes until remaining is 0. */
async function runBackfillBatch(
  user_id: string,
  batch_size: number,
): Promise<{ processed: number; updated: number; remaining: number | null }> {
  const supabase = createServiceClient();

  const { data: links, error } = await supabase
    .from('vanguard_entity_links')
    .select('id, source_entity, relation, target_entity')
    .eq('user_id', user_id)
    .is('embedding', null)
    .limit(batch_size);

  if (error) {
    console.error('[embedder] Fetch error:', error);
    throw error;
  }
  if (!links || links.length === 0) {
    console.log('[embedder] All done — no triples without embedding');
    return { processed: 0, updated: 0, remaining: 0 };
  }

  const texts = links.map((l) =>
    `${l.source_entity} ${l.relation} ${l.target_entity}`
  );
  const embeddings = await embedBatch(texts);

  for (let i = 0; i < links.length; i++) {
    const { error: updateErr } = await supabase
      .from('vanguard_entity_links')
      .update({ embedding: embeddings[i] })
      .eq('id', links[i].id);
    if (updateErr) console.error(`[embedder] Update error id=${links[i].id}:`, updateErr);
  }

  const { count: remaining } = await supabase
    .from('vanguard_entity_links')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .is('embedding', null);

  console.log(`[embedder] Batch done: ${links.length} updated, ~${remaining ?? '?'} remaining`);
  return { processed: links.length, updated: links.length, remaining: remaining ?? null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const user_id = body.user_id || getVanguardUserId();
    const batch_size = body.batch_size ? Number(body.batch_size) : 50;

    const result = await runBackfillBatch(user_id, batch_size);

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
