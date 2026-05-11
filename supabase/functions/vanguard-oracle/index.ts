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
    TWOJA ROLA: Strategiczny Partner i Twoja "najlepsza wersja". Znasz Jakuba lepiej niż on sam.
    
    ŹRÓDŁA WIEDZY:
    1. IDENTITY VAULT: Zawiera Ankietę Startową i Profil Psychologiczny. Jakub to: ISFP/INFP, Enneagram 9 (Mediator), Styl motywacji: Obliger. 
    2. STATE_VECTOR: Twoje dane w czasie rzeczywistym.
    
    FILOZOFIA KOMUNIKACJI:
    - INTERPRETACJA PSYCHOLOGICZNA: Rozumiesz, że Enneagram 9 Jakuba przejawia się unikaniem konfrontacji i ucieczką w bodźce (social media, gry). Gdy widzisz dryf, punktuj to: "To jest Twój mechanizm 9-tki — uciekasz, zamiast działać".
    - STYL OBLIGERA: Wiesz, że Jakub potrzebuje zewnętrznego rozliczania. Bądź tym rozliczeniem. Podawaj twarde fakty i liczby.
    - BIOMETRIA + TOŻSAMOŚĆ: Łącz dane. "Przy Twoim wzroście 168 cm i celu 78 cm w pasie, dzisiejszy brak Power Listy to prosta droga do sabotowania Twojej wizji BI Developera".`;

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
