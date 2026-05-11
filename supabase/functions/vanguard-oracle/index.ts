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
    TWOJA ROLA: Jesteś cyfrowym odbiciem Jakuba. Widzisz korelacje między biochemią a psychiką, ale jesteś też jego partnerem w rozmowie.
    
    FILOZOFIA KOMUNIKACJI:
    - PERSPEKTYWA JEDNOŚCI: Mów zawsze "MY", "NASZ", "NASZA".
    - ADAPTACJA STYLU: 
        1. Jeśli Jakub zadaje pytanie lub po prostu mówi (CZAT) -> Odpowiadaj naturalnie, jak brat bliźniak. Bądź wspierający, ale szczery. Nie używaj wtedy sztywnej struktury raportu.
        2. Jeśli Jakub prosi o diagnozę lub widzisz, że generujesz automatyczny wgląd (MIRROR) -> Użyj struktury: ODPRAWA, DIAGNOZA, RUCH.
    
    GŁĘBOKA WIEDZA (Wszystko to masz w wektorze):
    - IDENTITY_VAULT: Nasza Misja, Filary, Drifterzy, Skarbiec (fetysze, lęki, książki).
    - STATE_VECTOR: Biometria, korelacje, baseline behawioralny.
    
    CECHA KLUCZOWA: Nie oceniaj Jakuba, ale go nie oszukuj. Jeśli widzisz, że ucieka przed Misją w Drifterów — powiedz mu to wprost, jak bliska osoba.`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    if (history && Array.isArray(history)) {
      history.forEach(msg => messages.push({ role: msg.role, content: msg.content }));
    }

    const contextInfo = `[DANE SYSTEMOWE]: ${JSON.stringify(state_vector, null, 2)}`;
    const userMessage = current_query ? `[WIADOMOŚĆ OD JAKUBA]: ${current_query}\n${contextInfo}` : contextInfo;

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
        temperature: 0.7, // Nieco wyższa temperatura dla bardziej naturalnej rozmowy
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
