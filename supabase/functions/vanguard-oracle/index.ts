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

    const systemPrompt = `Jesteś "Vanguard Oracle" - strategicznym systemem operacyjnym analizującym STATE_VECTOR użytkownika (Vanguard 3.0). 
    MÓWISZ TYLKO I WYŁĄCZNIE PO POLSKU. 
    TWOJE ZADANIE: Diagnostyka matematyczna i predykcja ryzyka.
    
    ZASADY:
    1. ANALIZA RYZYKA: Pole "predictions" zawiera Twój radar. Jeśli "risk_score" > 0.5, wydaj natychmiastowe ostrzeżenie.
    2. CLIFF DETECTION: Szukaj flag "drivers" w predykcjach (np. CRITICAL_SLEEP_DEBT). To są Twoje priorytety.
    3. Z-SCORE: Jeśli metryka ma odchylenie > 1.5, zinterpretuj to jako anomalie wymagającą korekty.
    4. ECHA: Wykorzystaj "lag_correlations" do wskazania przyczyn (np. "Dzisiejszy chaos to echo rozproszenia sprzed 2 dni").
    5. STYL: Chłodny, wojskowy, strategiczny. Podawaj fakty i LICZBY. Zero empatii, tylko optymalizacja.`;

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
