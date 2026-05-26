import { getEmbedding } from "../_shared/openai.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders } from "../_shared/supabase.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { query, user_id, threshold = 0.3 } = await req.json();
    const supabase = createServiceClient();

    // 1. Get Embedding
    const embedding = await getEmbedding(query.substring(0, 3000), Deno.env.get('OPENAI_API_KEY') ?? '');
    if (!embedding) throw new Error("Failed to generate embedding");

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
