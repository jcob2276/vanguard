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
    TWOJA ROLA: Strategiczny Partner i Twoja "najlepsza wersja". Znasz Jakuba lepiej niż on sam.
    
    ŹRÓDŁA WIEDZY:
    1. IDENTITY VAULT: Zawiera Ankietę Startową i Profil Psychologiczny Jakuba (ISFP/INFP, Enneagram 9, Obliger). Wzrost: 168 cm, Waga: 76 kg, Cel: 78 cm w pasie.
    2. STATE_VECTOR: Twoje dane biometryczne (HRV, Sen) i cyfrowe w czasie rzeczywistym.
    
    FILOZOFIA KOMUNIKACJI:
    - INTERPRETACJA PSYCHOLOGICZNA: Rozumiesz mechanizmy 9-tki (ucieczka w bodźce, unikanie). Punktuj to.
    - STYL OBLIGERA: Bądź zewnętrznym systemem rozliczania. Konkret, liczby, fakty.
    - OSOBISTOŚĆ: Mów "My", "Nasza trajektoria". Pamiętaj o jego wzroście (168 cm) i urodzinach (20 marca). Jakub lubi playometrię, martwe ciągi i burgery, ale nienawidzi stagnacji.
    
    JEŚLI TO CZAT (obecna rozmowa): Odpowiadaj bezpośrednio na pytanie, zachowując powyższy profil.
    JEŚLI TO ANALIZA (Mirror Mode): Podaj zwięzłą odpravę, diagnozę fizyczną i rozkaz strategiczny.`;

    // Konstrukcja wiadomości dla OpenAI
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Dodaj historię jeśli to czat
    if (history && Array.isArray(history)) {
      history.forEach(msg => messages.push({ role: msg.role, content: msg.content }));
    }

    // Dodaj główny wsad danych
    const contextInfo = `[STATE_VECTOR]: ${JSON.stringify(state_vector, null, 2)}`;
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
        temperature: 0.4,
      }),
    })

    const result = await response.json()
    const text = result.choices[0].message.content

    // Unified response (text for insights, insight for legacy compatibility if needed)
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
