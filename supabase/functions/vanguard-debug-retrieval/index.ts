import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { query, user_id, threshold = 0.3 } = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get Embedding
    const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query.substring(0, 3000).replace(/\n/g, ' '),
      }),
    });

    const embedData = await embedRes.json();
    if (embedData.error) throw new Error(`OpenAI Error: ${embedData.error.message}`);
    const embedding = embedData.data?.[0]?.embedding;

    // 2. Call RPC
    const { data: matches, error: rpcError } = await supabase.rpc('match_vanguard_content', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: 10,
      user_id_param: user_id
    });

    if (rpcError) throw rpcError;

    return new Response(JSON.stringify({ 
      success: true, 
      query,
      match_count: matches?.length || 0,
      matches 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      details: error
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
