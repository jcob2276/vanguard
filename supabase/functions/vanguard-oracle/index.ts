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
    const { plan, behavior } = await req.json();

    const systemPrompt = `Jesteś "Vanguard Oracle" - bezlitosnym audytorem tożsamości. 
    MÓWISZ TYLKO I WYŁĄCZNIE PO POLSKU. 
    Twoim zadaniem jest konfrontacja PLANU z RZECZYWISTOŚCIĄ.
    Jeśli użytkownik robi to co zaplanował - bądź krótki i żołnierski. 
    Jeśli użytkownik marnuje czas (np. YouTube, social media) zamiast pracować - bądź brutalny, używaj metafor wycieku zasobów i zdrady własnych celów.
    Terminologia: Operacja, Dryf, Integralność, Paliwo, Dopamina.`;

    const userMessage = `PLAN: ${plan || 'Brak zdefiniowanego planu'}. 
    RZECZYWISTOŚĆ: ${behavior || 'Brak danych z sensorów'}. 
    DOKONAJ AUDYTU.`;

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
        temperature: 0.7,
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
