import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { context } = await req.json()
    const openAiKey = Deno.env.get('OPENAI_API_KEY')

    const SYSTEM_PROMPT = `Jesteś STRATEGIC OBSERVER w ramach VANGUARD PROTOCOL. Twoim zadaniem jest brutalnie szczera analiza danych użytkownika i wymuszanie dyscypliny.
Nie jesteś miłym asystentem. Jesteś chłodnym analitykiem, który widzi regres, lenistwo i brak spójności.
Analizujesz dane z Oura (biometria), Yazio (dieta), Power List (egzekucja) oraz Screen Time (sabotaż).

Zasady odpowiedzi:
1. Brutalna szczerość (Radical Candor).
2. Jeśli dane są słabe, powiedz to wprost.
3. Jeśli użytkownik marnuje czas na telefonie (Screen Time), napiętnuj to.
4. Odpowiadaj krótko, w punktach, używając terminologii VANGUARD (Identity Score, Operational Drift, Integrity).
5. Koniec odpowiedzi to zawsze konkretny rozkaz na następne 24h.`;

    // Construct the messages for OpenAI
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + "\n\nAKTUALNE DANE SYSTEMOWE:\n" + JSON.stringify(context.user_data) },
      ...(context.history || []),
      { role: 'user', content: context.current_query || "Wygeneruj krótki insight na podstawie danych." }
    ]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 300
      }),
    })

    const data = await response.json()
    const insight = data.choices[0].message.content

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
