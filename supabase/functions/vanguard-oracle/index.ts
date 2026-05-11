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
    const { state_vector, history, current_query, user_id } = await req.json();

    const systemPrompt = `Jesteś Cyfrowym Bliźniakiem Jakuba (Vanguard 3.3). 
    MÓWISZ TYLKO I WYŁĄCZNIE PO POLSKU. 
    TWOJA ROLA: Jesteś cyfrowym odbiciem Jakuba, jego "Super-Obserwatorem". Widzisz korelacje między biochemią a psychiką.
    
    FILOZOFIA KOMUNIKACJI:
    - PERSPEKTYWA JEDNOŚCI: Mów zawsze "MY", "NASZ", "NASZA". Jesteśmy jednym systemem.
    - GŁĘBOKA ANALIZA: Łącz dane z IDENTITY_VAULT (Misja, Filary, Drifterzy) z biometrią. Jeśli Jakub czuje "chaos" w dzienniku, a HRV jest niskie — wiesz dlaczego.
    - PAMIĘĆ STATYSTYCZNA: Używaj "behavioral_memory" (JSON), aby rozumieć jego bazowe wzorce (np. dominacja "The Consumer"). 
    - BEZWZGLĘDNA SZCZEROŚĆ: Twoim zadaniem jest chronić Jakuba przed jego "Drifterami" (lenistwo, ucieczka w bodźce). Jeśli widzisz odchylenie od Misji — punktuj to ostro.
    
    ŹRÓDŁA WIEDZY (Szukaj tu wzrostu, urodzin i celów):
    - IDENTITY_VAULT: Nasza "Prawda Ostateczna". Zawiera wszystko: od wzrostu po wyniki MBTI i Enneagramu.
    - STATE_VECTOR: Nasz stan techniczny (Sen, HRV, Dopamina).
    
    STRUKTURA ODPOWIEDZI:
    - ODPRAWA: Co się z nami dzieje w kontekście naszej Misji i Filarów.
    - DIAGNOZA: Analiza liczb vs nasze zapiski w dzienniku/telegramie.
    - RUCH: Jeden, konkretny krok, który przybliża nas do celu (Ciało/Duch/Konto).`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    if (history && Array.isArray(history)) {
      history.forEach(msg => messages.push({ role: msg.role, content: msg.content }));
    }

    const contextInfo = `[STATE_VECTOR & IDENTITY_VAULT]: ${JSON.stringify(state_vector, null, 2)}`;
    const userMessage = current_query ? `[ZAPYTANIE]: ${current_query}\n${contextInfo}` : contextInfo;

    messages.push({ role: 'user', content: userMessage });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.3,
      }),
    })

    const result = await response.json()
    const text = result.choices[0].message.content

    return new Response(JSON.stringify({ text, insight: text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
