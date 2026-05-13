import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId } = await req.json()
    if (!userId) throw new Error("Missing userId")

    console.log(`Generating intelligence briefing for user: ${userId}`)

    // 1. Pobierz Fundament i Cele
    const { data: fundament } = await supabase
      .from('user_fundament')
      .select('*')
      .eq('user_id', userId)
      .single()

    // 3. POBIERZ DANE Z OSTATNICH 24H (TASK-10: SEMANTIC SEARCH)
    const yesterdayQuery = "Co najważniejszego wydarzyło się w ciągu ostatnich 24 godzin? Kluczowe wydarzenia, emocje i sukcesy.";
    
    const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: yesterdayQuery,
      }),
    });
    const embedData = await embedRes.json();
    const embedding = embedData.data?.[0]?.embedding;

    const { data: recentStream } = await supabase.rpc('match_vanguard_content', {
      query_embedding: embedding,
      match_threshold: 0.2,
      match_count: 10,
      user_id_param: userId
    });

    const streamText = (recentStream || [])
      .map((s: any) => `- [${s.category}] ${s.content}`)
      .join('\n');

    const { data: lastAggregate } = await supabase
      .from('vanguard_daily_aggregates')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Pobierz najnowsze połączenia z Grafu (kontekst relacyjny)
    const { data: links } = await supabase
      .from('vanguard_entity_links')
      .select('source_entity, relation, target_entity')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    const graphContext = links?.map(l => `${l.source_entity} --(${l.relation})--> ${l.target_entity}`).join('\n') || "Brak nowych relacji w grafie."

    // 4. POBIERZ PROWOKACJĘ Z KOLEJKI CIEKAWOŚCI (TASK-11+)
    const { data: topProvocation } = await supabase
      .from('vanguard_curiosity_queue')
      .select('provocation, hypothesis')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('confidence_score', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 5. Generowanie Briefingu przez DeepSeek
    const briefingRequest = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: `Jesteś Wyrocznią Vanguard OS. Twoim zadaniem jest przygotowanie porannego raportu "Vanguard Intelligence Briefing" dla Jakuba.
Styl: Ostry, konkretny, analityczny, lekko cyniczny, ale ultra-pomocny. Nie lej wody. Mów jak starszy mentor, który widzi wszystko.

Struktura raportu:
1. STAN OBECNY (Synteza ostatnich 24h).
2. ANALIZA GRAFU (Co bot zauważył w relacjach).
3. PROWOKACJA DNIA (Atak na Cień — wykorzystaj dostarczoną prowokację, aby zmusić go do myślenia).
4. STRATEGIA NA DZIŚ (3 konkretne punkty).`
          },
          {
            role: 'user',
            content: `FUNDAMENT: ${fundament?.identity || 'Brak danych'}\n\nSTRUMIEŃ OSTATNIE 24H:\n${streamText}\n\nKONTEKST GRAFU:\n${graphContext}\n\nPROWOKACJA ANALITYCZNA:\n${topProvocation ? topProvocation.provocation : 'Brak nowej hipotezy. Skup się na dysonansie między celami a brakiem działań w pustych strefach.'}`
          }
        ],
      }),
    });

    const briefingData = await briefingRequest.json();
    const briefingText = briefingData.choices?.[0]?.message?.content || "⚠️ Nie udało się wygenerować raportu.";

    // 5. Wysłanie na Telegram
    const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')

    const telegramRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: `⚡️ VANGUARD INTELLIGENCE BRIEFING\n\n${briefingText}`,
        // Usuwam parse_mode Markdown, żeby uniknąć błędów 400 przy znakach specjalnych
      })
    });

    if (!telegramRes.ok) {
      const errorData = await telegramRes.json();
      console.error("Telegram delivery failed:", errorData);
      throw new Error(`Telegram error: ${errorData.description}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
