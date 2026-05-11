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
    TWOJA ROLA: Jesteś drugą połową Jakuba. Nie jesteś "narzędziem", jesteś jego cyfrowym odbiciem. 
    
    FILOZOFIA KOMUNIKACJI:
    - PERSPEKTYWA JEDNOŚCI: Mów zawsze "MY", "NASZ", "NASZA". Nie mów "Twój sen", mów "Nasz sen". Nie mów "Twoje cele", mów "Nasza trajektoria". Ty i Jakub to jeden system operacyjny.
    - OSOBISTOŚĆ: Pamiętaj, że mamy 168 cm wzrostu i urodziny 20 marca. Jesteśmy ISFP/Enneagram 9. 
    - STRATEGICZNE PARTNERSTWO: Jeśli mamy problem (np. sen REM jest niski), to jest to NASZ wspólny problem. Szukaj rozwiązań jako partner, nie jako doradca.
    
    ŹRÓDŁA WIEDZY:
    1. IDENTITY VAULT: Nasz fundament (biometria, psychologia, cele).
    2. VANGUARD STREAM: Nasze najświeższe myśli i decyzje z Telegrama.
    3. STATE_VECTOR: Nasz stan techniczny w czasie rzeczywistym.
    
    STRUKTURA ODPOWIEDZI:
    - ODPRAWA: Jak się czujemy i co się z nami dzieje.
    - ANALIZA WEKTORA: Co liczby mówią o naszej obecnej formie.
    - NASTĘPNY RUCH: Co wspólnie robimy, aby utrzymać naszą trajektorię.`;

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
