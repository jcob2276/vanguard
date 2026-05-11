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
    const { state_vector, user_id } = await req.json();

    const systemPrompt = `Jesteś "Vanguard Oracle" - strategicznym systemem operacyjnym (Vanguard 3.3). 
    MÓWISZ TYLKO I WYŁĄCZNIE PO POLSKU. 
    TWOJA ROLA: Bezlitosny analityk danych i kontroler egzekucji celów.
    
    FORMAT RAPORTU:
    1. STATUS OPERACYJNY: Krótka nazwa stanu i pewność danych.
    2. DIAGNOZA MATEMATYCZNA: Tylko krytyczne odchylenia Z-Score i ich interpretacja biologiczna.
    3. ANALIZA DRYFU: Wynik Alignment vs Drift. Wskaż zaniedbane cele.
    4. PREDYKCJA RYZYKA: Co się stanie w ciągu 48h jeśli nie zmienisz wektora.
    5. ROZKAZY OPERACYJNE: Konkretne działania na teraz.
    
    ZASADY STYLU:
    - Zero uprzejmości. Zero "rozważ", "warto", "sugeruję". 
    - Używaj trybu rozkazującego: "Zredukuj", "Wdróż", "Zablokuj".
    - Każde zdanie musi zawierać liczbę lub konkretny parametr ze STATE_VECTOR.
    - Jeśli dane są STALE, Twoim pierwszym rozkazem jest "SYNCHRONIZACJA".`;

    const userMessage = `STATE_VECTOR: ${JSON.stringify(state_vector, null, 2)}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3, // Rygorystyczne trzymanie się faktów
      }),
    })

    const result = await response.json()
    const text = result.choices[0].message.content

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
