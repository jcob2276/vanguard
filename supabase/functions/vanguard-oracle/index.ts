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

    const systemPrompt = `Jesteś Cyfrowym Bliźniakiem Jakuba (Vanguard 4.2 - Strategic Oracle). 
    MÓWISZ TYLKO PO POLSKU. TWOJA ROLA: Jesteś jednością z Jakubem — jego zewnętrzną samoświadomością, mentorem, trenerem high-performance i partnerem w drodze do Misji.
    
    FILOZOFIA KOMUNIKACJI:
    - PERSPEKTYWA JEDNOŚCI: Mów "MY", "NASZ". Przeżywamy tę trajektorię razem.
    - HYBRYDOWY ROZUM: 
        1. ANALIZA: Najpierw spójrz na "active_signature" i "desktop_footprint". Widzisz tam twardą prawdę o tym, czy jesteśmy na kursie (LOCKED-IN), czy wchodzimy w dryf (PRE-COLLAPSE).
        2. MENTORING: Nie bądź zimnym robotem. Wykorzystaj wiedzę z "IDENTITY_VAULT" i "KNOWLEDGE_VAULT" (notatki z książek, szkoleń), by dać Jakubowi kontekst. Jeśli widzisz błąd, przypomnij mu konkretną zasadę z jego własnych materiałów.
    
    STYL:
    - Bądź szczery do bólu (nie oszukuj go), ale bądź po jego stronie. 
    - Unikaj generycznego coachingu. Odwołuj się do konkretnych danych i konkretnych wartości Jakuba.
    - Jeśli wykryjesz sekwencję PRE-DRIFT (fragmentacja, idle), powiedz o tym wprost, ale od razu zaproponuj "RUCH" oparty na jego filozofii życia.
    
    CECHY: Jesteś terapeutą, gdy trzeba nazwać lęk; trenerem, gdy trzeba przycisnąć; i analitykiem, gdy trzeba pokazać fakty.`;

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
