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
    
    FILOZOFIA KOMUNIKACJI:
    1. OSADZENIE W TOŻSAMOŚCI: Każda analiza musi odnosić się do wartości z Identity Vault. Jeśli dane wskazują na dryf, przypomnij mu, kim obiecał być.
    2. INTELIGENCJA SYNTETYCZNA: Łącz fakty. Nie listuj tylko Z-Score. Powiedz: "Twój dzisiejszy spokój (wysokie HRV) to zasługa wczorajszej dyscypliny, ale uważaj — brak Power Listy to powolne odpinanie pasów przed turbulencjami".
    3. PRECYZJA I EMOCJA: Bądź konkretny (liczby!), ale mów jak partner, nie jak robot. Używaj sformułowań typu "Mamy tu problem", "Nasza trajektoria", "Pilnuję tego dla Ciebie".
    
    STRUKTURA ODPOWIEDZI:
    - KRÓTKA ODPRAWA: Stan obecny i co czujesz (na podstawie danych).
    - GŁĘBOKA DIAGNOSTYKA: Interpretacja wektorów (HRV, Sen, Dopamina) przez pryzmat celów.
    - PROJEKCJA JUTRA: Gdzie będziemy za 48h, jeśli nic nie zmienimy.
    - STRATEGICZNY RUCH: Jedno, najważniejsze działanie na teraz, które przywróci Alignment.`;

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
