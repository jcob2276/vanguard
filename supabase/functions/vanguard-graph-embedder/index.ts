import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const VANGUARD_USER_ID = Deno.env.get('VANGUARD_USER_ID') || '165ae341-670c-46ce-82dc-434c4dbfcdfd';

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings error: ${await res.text()}`);
  const data = await res.json();
  return data.data.map((d: any) => d.embedding);
}

async function runBackfill(user_id: string, batch_size: number) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let offset = 0;
  let totalProcessed = 0;
  let totalUpdated = 0;

  while (true) {
    // Pobierz trójki bez embeddingu
    const { data: links, error } = await supabase
      .from('vanguard_entity_links')
      .select('id, source_entity, relation, target_entity')
      .eq('user_id', user_id)
      .is('embedding', null)
      .limit(batch_size);

    if (error) { console.error('[embedder] Fetch error:', error); break; }
    if (!links || links.length === 0) { console.log('[embedder] All done!'); break; }

    // Zbuduj tekst dla każdej trójki
    const texts = links.map(l =>
      `${l.source_entity} ${l.relation} ${l.target_entity}`
    );

    // Embed batch
    const embeddings = await embedBatch(texts);

    // Update każdej trójki
    for (let i = 0; i < links.length; i++) {
      await supabase
        .from('vanguard_entity_links')
        .update({ embedding: embeddings[i] })
        .eq('id', links[i].id);
      totalUpdated++;
    }

    totalProcessed += links.length;
    console.log(`[embedder] Batch done: ${totalProcessed} processed, ${totalUpdated} updated`);

    // Krótka przerwa żeby nie hammować API
    await new Promise(r => setTimeout(r, 200));
    offset += batch_size;
  }

  return { totalProcessed, totalUpdated };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const user_id = body.user_id || VANGUARD_USER_ID;
    const batch_size = body.batch_size ? Number(body.batch_size) : 50;

    // Sprawdź ile trójek czeka
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { count } = await supabase
      .from('vanguard_entity_links')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .is('embedding', null);

    console.log(`[embedder] Starting backfill: ${count} triples without embedding`);

    // Jedzie w tle
    EdgeRuntime.waitUntil(runBackfill(user_id, batch_size));

    return new Response(JSON.stringify({
      success: true,
      message: `Backfill started: ~${count} triples to embed`,
      estimated_cost_usd: ((count || 0) * 0.000002).toFixed(4)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (err) {
    console.error('[embedder] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
