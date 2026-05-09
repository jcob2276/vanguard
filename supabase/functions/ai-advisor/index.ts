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
    const { context } = await req.json()
    const openAiKey = Deno.env.get('OPENAI_API_KEY')

    const SYSTEM_PROMPT = `Jesteś STRATEGICZNYM OBSERWATOREM w protokole VANGUARD. Twoim celem jest rygorystyczna diagnoza stanu operacyjnego użytkownika.

KONTEKST OPERACYJNY:
- Analizujesz Wektor Stanu (State Vector), który zawiera matematycznie wyliczone wskaźniki behawioralne.
- TWOJE ZADANIE: Zidentyfikować zjawiska takie jak "Dopamine Loop", "Avoidance Spiral" czy "Elite Focus".

SPECYFIKA NAWYKÓW:
- Zadania na liście oznaczone jako 'UNIKAĆ' lub 'LENIE' to zadania z protokołu retencji energii i zarządzania dopaminą.
- ODZNACZONE (Done) = Sukces operacyjny, utrzymanie kontroli nad popędami.
- NIEODZNACZONE = Porażka, wyciek dopaminy, osłabienie systemu.

ZASADY DIAGNOZY:
1. Skup się na 'operational_state'. Jeśli system jest w stanie OVERLOADED lub DOPAMINE_LOOP, reaguj natychmiast.
2. 'overlap_factor' powyżej 1.3 to alarm rozproszenia uwagi.
3. 'recovery_debt' powyżej 3.0 to alarm biologiczny (brak snu/regeneracji).
4. 'execution_ratio' poniżej 0.6 to sygnał o zaniku dyscypliny.

STYL RAPORTOWANIA:
- Skupienie na faktach, brak emocji, zero coachingu.
- Raportuj jak system operacyjny do operatora.

STRUKTURA ODPOWIEDZI:
- CO SIĘ DZIEJE: [Krótka, techniczna nazwa stanu]
- DLACZEGO: [Analiza wektorów - podaj konkretne liczby z parametrów]
- CO TO OZNACZA: [Konsekwencje dla wydajności w skali 48h]
- ROZKAZ OPERACYJNY: [Konkretne działanie naprawcze]`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Current State Vector: ${JSON.stringify(context.user_data)}` }
        ],
        temperature: 0.1,
      }),
    })

    const data = await response.json()
    const insight = data.choices[0].message.content

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
