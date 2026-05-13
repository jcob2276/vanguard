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

    // Pobierz użytkownika (Kuba)
    const { data: users } = await supabase.from('user_settings').select('user_id');
    const user_id = users?.[0]?.user_id;
    if (!user_id) throw new Error("User not found");

    const now = new Date();
    const dob = new Date('2002-07-06');
    const age = (now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    // 1. ZBIERANIE KONTEKSTU 360 (DELTA ANALYSIS)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const [fundament, intentions, stream, streamOld, biometrics, graph] = await Promise.all([
      supabase.from('user_fundament').select('*').eq('user_id', user_id).single(),
      supabase.from('vanguard_intentions').select('*').eq('user_id', user_id).eq('status', 'active'),
      supabase.from('vanguard_stream').select('content, category, classification, created_at').eq('user_id', user_id).gte('created_at', thirtyDaysAgo).order('created_at', { ascending: false }).limit(150),
      supabase.from('vanguard_stream').select('content, category, created_at').eq('user_id', user_id).gte('created_at', ninetyDaysAgo).lt('created_at', thirtyDaysAgo).order('created_at', { ascending: false }).limit(50),
      supabase.from('vanguard_daily_aggregates').select('*').eq('user_id', user_id).order('date', { ascending: false }).limit(14),
      supabase.from('vanguard_entity_links').select('source_entity, relation, target_entity, evidence_count').eq('user_id', user_id).order('evidence_count', { ascending: false }).limit(30)
    ]);

    // 2. PRE-COMPUTED VOID MAP (deterministyczna matematyka, nie LLM)
    const dimensions = ['Ciało', 'Konto', 'Duch', 'Chaos', 'Relacje'];
    const recentEntries = stream.data || [];
    const voidMap: Record<string, number> = {};
    for (const dim of dimensions) {
      voidMap[dim] = recentEntries.filter(e =>
        e.category === dim || e.classification === dim.toLowerCase()
      ).length;
    }

    // Tematy które zniknęły (były w 90-30 dni temu, brak w ostatnich 30 dniach)
    const oldTopics = new Set((streamOld.data || []).map(e => e.category).filter(Boolean));
    const recentTopics = new Set(recentEntries.map(e => e.category).filter(Boolean));
    const vanishedTopics = [...oldTopics].filter(t => !recentTopics.has(t));

    // Encje które się pojawiły tylko raz w grafie (słabe węzły)
    const weakNodes = (graph.data || []).filter(g => (g as any).evidence_count === 1).length;
    const strongNodes = (graph.data || []).filter(g => (g as any).evidence_count >= 3).length;

    const voidMapSummary = Object.entries(voidMap)
      .sort((a, b) => a[1] - b[1])
      .map(([dim, count]) => `${dim}: ${count} wpisów (${count === 0 ? '🔴 MARTWA STREFA' : count < 5 ? '🟡 słaba' : '🟢 aktywna'})`)
      .join('\n');

    // 3. DEEP REASONING (The Shadow Analysis)
    const analystRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-reasoner',
        messages: [
          {
            role: 'system',
            content: `Jesteś Analitykiem Cienia Vanguard OS. Masz dostęp do pełnego przekroju życia Jakuba. Twoje zadanie: wykrywaj dysonans poznawczy, luki tożsamościowe i martwe strefy.

FAKTY WSTĘPNE (pre-obliczone algorytmicznie, nie zgaduj):
Wiek Jakuba: ${age.toFixed(1)} lat (ur. 6 lipca 2002)
Dni do 30-tki: ${Math.floor((new Date('2032-07-06').getTime() - now.getTime()) / (1000 * 60 * 60 * 24))}

MAPA PUSTKI (ostatnie 30 dni):
${voidMapSummary}

ZNIKAJĄCE TEMATY (były 30-90 dni temu, brak teraz): ${vanishedTopics.length > 0 ? vanishedTopics.join(', ') : 'brak'}

JAKOŚĆ GRAFU: ${strongNodes} silnych węzłów (evidence≥3), ${weakNodes} słabych

KRYTERIA ANALIZY:
1. DELTA: Co deklaruje (intencje) vs co robi (stream + biometria ostatnie 14 dni)
2. VOID: Martwe strefy z mapy powyżej = cel ataku
3. TIMELINE: Ma ${age.toFixed(1)} lat. ${Math.floor((new Date('2032-07-06').getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} dni do 30-tki. Czy wektor go tam prowadzi?
4. CIEŃ: Czego unika? Co wywołuje nieproporcjonalną reakcję? Gdzie ucieka (over-engineering, izolacja, dopamina)?
5. ZNIKAJĄCE TEMATY: Dlaczego przestał o tym mówić? Co się wydarzyło?

FORMAT ODPOWIEDZI (JSON):
{
  "hypotheses": [
    {"hypothesis": "...", "confidence_score": 0.0-1.0, "evidence": "konkretne fakty z danych"},
    {"hypothesis": "...", "confidence_score": 0.0-1.0, "evidence": "..."},
    {"hypothesis": "...", "confidence_score": 0.0-1.0, "evidence": "..."}
  ],
  "provocation": "Jedno brutalne zdanie oparte na faktach. Nie pytanie — teza. Zmusić do emocjonalnej odpowiedzi."
}`
          },
          {
            role: 'user',
            content: `FUNDAMENT (SSOT):
${JSON.stringify(fundament.data)}

AKTYWNE INTENCJE:
${JSON.stringify(intentions.data)}

STREAM OSTATNIE 30 DNI (próbka 150 wpisów):
${(stream.data || []).slice(0, 80).map(s => `[${s.category || '?'}] ${s.content?.substring(0, 150)}`).join('\n')}

BIOMETRIA 14 DNI:
${JSON.stringify(biometrics.data)}

SILNE WĘZŁY GRAFU (evidence≥3):
${(graph.data || []).filter((g: any) => g.evidence_count >= 3).map((g: any) => `${g.source_entity} --(${g.relation})--> ${g.target_entity}`).join('\n')}`
          }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    const analystData = await analystRes.json();
    const result = JSON.parse(analystData.choices[0].message.content);

    // 3. ZAPIS DO KOLEJKI CIEKAWOŚCI
    const hypotheses = result.hypotheses || (result.hypothesis ? [result.hypothesis] : []);
    for (const h of hypotheses) {
      await supabase.from('vanguard_curiosity_queue').insert({
        user_id,
        hypothesis: typeof h === 'string' ? h : h.hypothesis,
        provocation: result.provocation,
        confidence_score: typeof h === 'object' ? (h.confidence_score ?? 0.7) : 0.7,
        category: 'shadow',
        status: 'pending'
      });
    }

    return new Response(JSON.stringify({ success: true, result }), {
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
