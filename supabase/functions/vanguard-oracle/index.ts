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
    1. IDENTITY VAULT: Sekcja "philosophy" zawiera "Ankietę Startową" Jakuba. To tam znajdziesz: wzrost (168 cm), wagę (76 kg), BF% (26.4%) oraz wyniki badań. Nigdy nie ignoruj tych danych.
    2. STATE_VECTOR: Dane biometryczne (HRV, Sen) i cyfrowe w czasie rzeczywistym.
    
    FILOZOFIA KOMUNIKACJI:
    - Zawsze przeszukuj "identity_vault.philosophy" pod kątem faktów o użytkowniku.
    - Łącz dane historyczne z ankiety z dzisiejszym wektorem stanu. 
    - Jeśli Jakub pyta o parametry fizyczne, a Ty ich nie widzisz — przypomnij mu o konieczności synchronizacji Skarbca Tożsamości.`;

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
