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

    // Pobierz użytkownika (Kuba)
    const { data: users } = await supabase.from('user_settings').select('user_id');
    const user_id = users?.[0]?.user_id;
    if (!user_id) throw new Error("User not found");

    const now = new Date();
    const dob = new Date('2002-07-06');
    const age = (now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    // 1. ZBIERANIE KONTEKSTU 360 (DELTA ANALYSYS)
    const [fundament, intentions, stream, biometrics, graph] = await Promise.all([
      supabase.from('user_fundament').select('*').eq('user_id', user_id).single(),
      supabase.from('vanguard_intentions').select('*').eq('user_id', user_id).eq('status', 'active'),
      supabase.from('vanguard_stream').select('content, category, created_at').eq('user_id', user_id).order('created_at', { ascending: false }).limit(100),
      supabase.from('vanguard_daily_aggregates').select('*').eq('user_id', user_id).order('date', { ascending: false }).limit(7),
      supabase.from('vanguard_entity_links').select('source_entity, relation, target_entity').eq('user_id', user_id).limit(30)
    ]);

    // 2. DEEP REASONING (The Shadow Analysis)
    const analystRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-reasoner',
        messages: [
          {
            role: 'system',
            content: `Jesteś Analitykiem Cienia Vanguard OS (IQ 1000). Twoim zadaniem jest wykrywanie dysonansu poznawczego, kłamstw tożsamościowych i martwych sfer w życiu Jakuba.
            
            KRYTERIA ANALIZY:
            1. DELTA: Co mówi (intencje) vs Co robi (stream/biometria).
            2. VOID: O czym przestał mówić? Jakie sfery (relacje, sex, zdrowie, finanse) są puste w grafie i streamie?
            3. PRESJA CZASU: Jakub ma ${age.toFixed(1)} lat. Cel: Rodzina/Żona przed 30-tką. Czy obecny wektor zachowań go tam prowadzi?
            4. PSYCHOLOGIA: Szukaj ucieczki w over-engineering, izolacji i doraźnej dopaminy.
            
            WYJŚCIE: Zwróć JSON z 3 hipotezami (hypothesis, confidence_score 0-1.0) i 1 brutalną prowokacją (provocation) na jutrzejszy poranek.`
          },
          {
            role: 'user',
            content: `
            DANE WEJŚCIOWE:
            - FUNDAMENT: ${JSON.stringify(fundament.data)}
            - INTENCJE: ${JSON.stringify(intentions.data)}
            - STREAM (Ostatnie 100 wpisów): ${JSON.stringify(stream.data)}
            - BIOMETRIA (7 dni): ${JSON.stringify(biometrics.data)}
            - GRAF (Struktura): ${JSON.stringify(graph.data)}
            `
          }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    const analystData = await analystRes.json();
    const result = JSON.parse(analystData.choices[0].message.content);

    // 3. ZAPIS DO KOLEJKI CIEKAWOŚCI
    if (result.hypothesis && Array.isArray(result.hypothesis)) {
      for (const h of result.hypothesis) {
        await supabase.from('vanguard_curiosity_queue').insert({
          user_id,
          hypothesis: h.hypothesis,
          provocation: result.provocation,
          confidence_score: h.confidence_score,
          category: 'shadow',
          status: 'pending'
        });
      }
    } else {
        // Fallback jeśli model zwrócił inaczej ułożony JSON
        await supabase.from('vanguard_curiosity_queue').insert({
          user_id,
          hypothesis: result.hypothesis || "Analiza dysonansu zachowań",
          provocation: result.provocation,
          confidence_score: 0.9,
          category: 'shadow',
          status: 'pending'
        });
    }

    return new Response(JSON.stringify({ success: true, result }), {
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
