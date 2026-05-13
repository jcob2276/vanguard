import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { table, limit = 50 } = await req.json();

    if (!['vanguard_knowledge', 'vanguard_stream', 'daily_wins'].includes(table)) {
      throw new Error(`Unsupported table: ${table}`);
    }

    console.log(`🚀 Starting backfill for ${table}...`);

    // 1. Get records without embeddings
    const { data: records, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .is('embedding', null)
      .limit(limit);

    if (fetchError) throw fetchError;
    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ message: `No missing embeddings in ${table}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${records.length} records to process.`);

    let successCount = 0;

    for (const record of records) {
      let text = "";
      if (table === 'vanguard_knowledge') {
        text = `${record.title}\n\n${record.content}`;
      } else if (table === 'vanguard_stream') {
        text = record.content;
      } else if (table === 'daily_wins') {
        text = `Dziennik: ${record.journal_entry}\n\nWdzięczność: ${record.gratitude_entry}`;
      }

      if (!text || text.trim() === "") continue;

      // 2. Generate embedding
      const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.substring(0, 3000).replace(/\n/g, ' '),
        }),
      });

      const embedData = await embedRes.json();
      if (embedData.error) {
        console.error(`OpenAI Error for ${record.id}:`, embedData.error);
        continue;
      }

      const embedding = embedData.data?.[0]?.embedding;

      if (embedding) {
        // 3. Update record
        const { error: updateError } = await supabase
          .from(table)
          .update({ embedding })
          .eq('id', record.id);

        if (updateError) {
          console.error(`Update Error for ${record.id}:`, updateError);
        } else {
          successCount++;
        }
      }
      
      // Basic rate limiting avoidance
      await new Promise(r => setTimeout(r, 50));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: records.length, 
      updated: successCount 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Backfill Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
