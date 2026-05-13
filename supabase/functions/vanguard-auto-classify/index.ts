import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. AUTH CHECK (Ten sam klucz co w Schedulera)
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('VANGUARD_CRON_SECRET')
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. POBIERZ DANE Z WEBHOOKA
    const payload = await req.json()
    const { record } = payload // Supabase Webhook wysyła nowy rekord w polu 'record'
    
    if (!record || !record.content || !record.user_id) {
      return new Response(JSON.stringify({ message: 'No content to classify' }), { status: 200 })
    }

    const today = new Date().toISOString().split('T')[0]

    // 3. POBIERZ KONTEKST DNIA (Snapshot)
    const { data: aggregate } = await supabase
      .from('vanguard_daily_aggregates')
      .select('*')
      .eq('user_id', record.user_id)
      .eq('date', today)
      .maybeSingle()

    const contextStr = aggregate 
      ? `BIOMETRIA DZIŚ: HRV ${aggregate.hrv_avg}, Sen ${aggregate.sleep_hours}h, Stan: ${aggregate.final_state}.`
      : 'BIOMETRIA DZIŚ: Brak danych (użytkownik jeszcze nie zsynchronizował urządzeń).'

    // 4. DEEPSEEK FLASH — ANALIZA I SYNTEZA
    const classifyRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `Jesteś systemem analitycznym Vanguard OS. Twoim zadaniem jest wygenerować obiekt JSON na podstawie notatki i biometrii.
Struktura JSON:
{
  "importance_score": (1-10),
  "category": ("Ciało" | "Konto" | "Duch" | "Chaos" | "Relacje"),
  "tags": [max 5 tagów],
  "fingerprint_text": (2-zdaniowe podsumowanie skrzyżowania stanu biometrycznego z tematem notatki),
  "is_closure": boolean,
  "closed_topic_description": (krótki opis zamykanego wątku, jeśli is_closure jest true),
  "expiration_date": (ISO string, jeśli w tekście jest jasny termin wygaśnięcia, np. 'egzamin w czwartek' -> czwartek 23:59:59. Dzisiaj jest ${new Date().toISOString()})
}
Zwróć TYLKO czysty JSON.`
          },
          {
            role: 'user',
            content: `KONTEKST: ${contextStr}\nNOTATKA: ${record.content}`
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }),
    })

    const classifyData = await classifyRes.json()
    const result = JSON.parse(classifyData.choices[0].message.content)

    // 5. WEKTORYZACJA FINGERPRINTU
    const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: result.fingerprint_text,
      }),
    })

    const embedData = await embedRes.json()
    const embedding = embedData.data?.[0]?.embedding

    // 6. LOGIKA BI-TEMPORALNA: ZAMYKANIE WĄTKÓW
    if (result.is_closure && result.closed_topic_description) {
      console.log(`[Vanguard] Attempting to close topic: ${result.closed_topic_description}`)
      
      const closureEmbedRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: result.closed_topic_description,
        }),
      })
      const closureEmbedData = await closureEmbedRes.json()
      const closureEmbedding = closureEmbedData.data?.[0]?.embedding

      if (closureEmbedding) {
        const { data: matches } = await supabase.rpc('match_vanguard_content', {
          query_embedding: closureEmbedding,
          match_threshold: 0.65,
          match_count: 5,
          user_id_param: record.user_id
        })

        if (matches && matches.length > 0) {
          const idsToClose = matches
            .filter((m: any) => m.table_name === 'vanguard_stream' && m.id !== record.id)
            .map((m: any) => m.id)

          if (idsToClose.length > 0) {
            await supabase
              .from('vanguard_stream')
              .update({ valid_until: new Date().toISOString() })
              .in('id', idsToClose)
            console.log(`[Vanguard] Closed ${idsToClose.length} past entries.`)
          }
        }
      }
    }

    // 7. UPDATE REKORDU W BAZIE
    const { error: updateError } = await supabase
      .from('vanguard_stream')
      .update({
        importance_score: result.importance_score,
        category: result.category,
        tags: result.tags,
        situation_fingerprint: embedding,
        classification: result.category.toLowerCase(),
        valid_from: new Date().toISOString(),
        valid_until: result.expiration_date || null
      })
      .eq('id', record.id)

    if (updateError) throw updateError

    return new Response(JSON.stringify({ success: true, classification: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Classification Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
