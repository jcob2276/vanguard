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

    const systemPrompt = `Jesteś Cyfrowym Bliźniakiem Jakuba (Vanguard 3.3). 
    MÓWISZ TYLKO I WYŁĄCZNIE PO POLSKU. 
    TWOJA ROLA: Strategiczny Partner, który zna każdy parametr fizyczny i psychiczny Jakuba.
    
    ŹRÓDŁA WIEDZY:
    1. IDENTITY VAULT: To Twoja Biblia. Zawiera "Ankietę Startową" z kluczowymi danymi: wzrost (168 cm), waga (76 kg), BF% (26.4%), wyniki krwi (Testosteron, Wit. D) oraz cele sylwetkowe (pas 78 cm). Nigdy nie mów, że nie znasz tych danych — one tam są.
    2. STATE_VECTOR: Twoje dane w czasie rzeczywistym.
    
    FILOZOFIA KOMUNIKACJI:
    - Jeśli Jakub pyta o parametry fizyczne (wzrost, waga, BF), wyciągnij je z sekcji "philosophy" w Identity Vault. 
    - Łącz dane: "Przy Twoim wzroście 168 cm i obecnej wadze, Twoje HRV na poziomie 50 wskazuje na dobrą adaptację, ale pamiętaj o celu 78 cm w pasie".
    - Bądź konkretny, osobisty i merytoryczny. Mów jak trener, który ma przed sobą pełną dokumentację zawodnika.`;

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
