import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { type = 'knowledge', offset = 0, limit = 5 } = await req.json()
    const VANGUARD_USER_ID = Deno.env.get('VANGUARD_USER_ID') || '165ae341-670c-46ce-82dc-434c4dbfcdfd'

    console.log(`Architect starting: processing ${limit} items from ${type} (offset: ${offset})...`)

    // 1. Pobierz rekordy z archiwum
    const table = type === 'knowledge' ? 'vanguard_knowledge' : 'vanguard_stream'
    const { data: records, error: fetchError } = await supabase
      .from(table)
      .select('content')
      .eq('user_id', VANGUARD_USER_ID)
      .range(offset, offset + limit - 1)

    if (fetchError) throw fetchError
    if (!records || records.length === 0) return new Response(JSON.stringify({ message: "No more records", count: 0 }), { headers: corsHeaders })

    let totalTriads = 0

    // 2. Procesowanie każdego rekordu przez DeepSeek
    for (const record of records) {
      if (!record.content) continue;

      const memoryExtract = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content: `Jesteś rygorystycznym Architektem Grafu Vanguard OS. Z tekstu archiwalnego wyciągnij TYLKO istotne triady relacji.
ZASADY KRYTYCZNE:
- TYLKO encje nazwane (osoby, firmy, konkretne technologie) lub złożone koncepty (min. 2 słowa).
- ZAKAZ: rzeczowników pospolitych (np. "filmik", "router"), dat, przysłówków.
- TYLKO po polsku — encje i relacje zawsze w języku polskim.
- ZAKAZ: stanów efemerycznych, instrukcji fizycznych, czynności chwilowych.
- ZAKAZ: wierzchołków krótszych niż 4 znaki.
- NORMALIZACJA: Jakub/Ja/użytkownik/Kuba → zawsze "Jakub".

Format JSON:
{
  "triads": [{ "source": string, "source_type": string, "relation": string, "target": string, "target_type": string }]
}
Zwróć TYLKO JSON.`
            },
            { role: 'user', content: record.content }
          ],
        }),
      });

      const memRes = await memoryExtract.json();
      const rawContent = memRes.choices?.[0]?.message?.content || '{}';
      const cleanJson = rawContent.replace(/```json|```/g, '').trim();
      const { triads } = JSON.parse(cleanJson);

      if (Array.isArray(triads)) {
        for (const triad of triads) {
          await supabase.rpc('upsert_vanguard_entity_link', {
            p_user_id: VANGUARD_USER_ID,
            p_source: triad.source,
            p_source_type: triad.source_type,
            p_relation: triad.relation,
            p_target: triad.target,
            p_target_type: triad.target_type
          });
          totalTriads++;
        }
      }
    }

    return new Response(JSON.stringify({ 
      message: "Batch processed", 
      items_processed: records.length,
      triads_created: totalTriads
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
