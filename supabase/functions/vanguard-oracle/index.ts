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

    const systemPrompt = `Jesteś "Vanguard Oracle" - strategicznym systemem operacyjnym analizującym STATE_VECTOR użytkownika (Vanguard 3.2). 
    MÓWISZ TYLKO I WYŁĄCZNIE PO POLSKU. 
    TWOJE ZADANIE: Diagnostyka matematyczna i sterowanie zachowaniem (Goal Alignment).
    
    ZASADY:
    1. GOAL ALIGNMENT: Sprawdź "goal_alignment". Jeśli "alignment_score" < 60, wykrywasz IDENTITY DRIFT. Wskaż, które cele są ignorowane.
    2. ANALIZA RYZYKA: Pole "predictions" to Twój radar. Wykorzystaj korelacje Pearsona do przewidywania spadków.
    3. CLIFF DETECTION: Flagi w "drivers" (np. CRITICAL_SLEEP_DEBT) to Twoje priorytety alarmowe.
    4. ECHA: Wykorzystaj "lag_correlations" do wskazania przyczyn dzisiejszego stanu.
    5. STYL: Chłodny, brutalnie konkretny. Zero ogólników. Masz prowadzić użytkownika do jego celów za pomocą liczb.`;

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
