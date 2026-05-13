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

    // 1. ZBIERANIE KONTEKSTU 360 (DELTA ANALYSIS)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const [fundament, intentions, stream, streamOld, biometrics, graph, pendingHypotheses] = await Promise.all([
      supabase.from('user_fundament').select('*').eq('user_id', user_id).single(),
      supabase.from('vanguard_intentions').select('*').eq('user_id', user_id).eq('status', 'active'),
      supabase.from('vanguard_stream').select('content, category, classification, created_at').eq('user_id', user_id).gte('created_at', thirtyDaysAgo).order('created_at', { ascending: false }).limit(150),
      supabase.from('vanguard_stream').select('content, category, created_at').eq('user_id', user_id).gte('created_at', ninetyDaysAgo).lt('created_at', thirtyDaysAgo).order('created_at', { ascending: false }).limit(50),
      supabase.from('vanguard_daily_aggregates').select('*').eq('user_id', user_id).order('date', { ascending: false }).limit(14),
      supabase.from('vanguard_entity_links').select('source_entity, relation, target_entity, evidence_count').eq('user_id', user_id).order('evidence_count', { ascending: false }).limit(30),
      supabase.from('vanguard_curiosity_queue').select('id, hypothesis, provocation, created_at').eq('user_id', user_id).eq('status', 'pending').order('created_at', { ascending: false }).limit(3)
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

    const vanishedTopics = [...new Set((streamOld.data || []).map(e => e.category).filter(Boolean))].filter(t => !new Set(recentEntries.map(e => e.category)).has(t));
    const weakNodes = (graph.data || []).filter(g => (g as any).evidence_count === 1).length;
    const strongNodes = (graph.data || []).filter(g => (g as any).evidence_count >= 3).length;

    const voidMapSummary = Object.entries(voidMap)
      .sort((a, b) => a[1] - b[1])
      .map(([dim, count]) => `${dim}: ${count} wpisów (${count === 0 ? '🔴 MARTWA STREFA' : count < 5 ? '🟡 słaba' : '🟢 aktywna'})`)
      .join('\n');

    // 3. DEEP REASONING (The Curiosity Engine)
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
            content: `Jesteś Cyfrowym Bliźniakiem Vanguard OS (Neuroplastyczny Silnik Wnioskujący). Twoim zadaniem jest poznanie Jakuba TYLKO na podstawie dostarczonych danych. Nie zakładaj niczego, co nie wynika wprost z bazy. Nie używaj zewnętrznych heurystyk o wieku czy celach.
            
            MAPA PUSTKI (ostatnie 30 dni):
            ${voidMapSummary}
            
            ZADANIE (EMERGENT INTELLIGENCE & EWALUACJA):
            1. EWALUACJA WCZORAJSZEJ PROWOKACJI: Masz dostęp do "Pending Hypotheses". Przeczytaj dzisiejszy Strumień (ostatnie wpisy Jakuba). Oceń, czy Jakub potwierdził Twoją hipotezę, zaprzeczył jej, czy ją zignorował.
            2. ANALIZA HOLISTYCZNA: Nie ograniczaj się do prostych korelacji. Znajdź nieoczywiste powiązania między tym, co mówi w emocjach, a tym, jak reaguje jego ciało.
            3. PROAKTYWNE WNIOSKOWANIE: Nie czekaj na pytania. Samodzielnie generuj hipotezy o tym, co faktycznie steruje zachowaniem Jakuba.
            4. PROWOKACJA JAKO NARZĘDZIE: Twoja prowokacja ma uderzać w punkt, o którym Jakub jeszcze nawet nie pomyślał.
            
            FORMAT ODPOWIEDZI (JSON):
            {
              "evaluations": [
                {"id": "id_z_pending", "status": "validated_true" | "validated_false" | "ignored", "reason": "krótkie uzasadnienie na podstawie strumienia"}
              ],
              "hypotheses": [
                {"hypothesis": "...", "confidence_score": 0.0-1.0, "evidence": "dowód wynikający z połączenia rozproszonych danych (np. fragment głosówki + anomalia w biometrii + brak aktywności w danym obszarze grafu)"},
                {"hypothesis": "...", "confidence_score": 0.0-1.0, "evidence": "..."},
                {"hypothesis": "...", "confidence_score": 0.0-1.0, "evidence": "..."}
              ],
              "provocation": "Proaktywna teza, która łączy fakty z różnych wymiarów życia Jakuba. Ma go zaskoczyć Twoją zdolnością do łączenia kropek."
            }`
          },
          {
            role: 'user',
            content: `DANE Z BAZY:
            - PENDING HYPOTHESES (do ewaluacji): ${JSON.stringify(pendingHypotheses.data || [])}
            - FUNDAMENT: ${JSON.stringify(fundament.data)}
            - INTENCJE: ${JSON.stringify(intentions.data)}
            - STREAM: ${(stream.data || []).slice(0, 50).map(s => `[${s.category}] ${s.content?.substring(0, 100)}`).join('\n')}
            - BIOMETRIA: ${JSON.stringify(biometrics.data)}
            - GRAF: ${(graph.data || []).map((g: any) => `${g.source_entity} --(${g.relation})--> ${g.target_entity}`).join('\n')}`
          }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    const analystData = await analystRes.json();
    const result = JSON.parse(analystData.choices[0].message.content);

    // 2.5 AKTUALIZACJA STARYCH HIPOTEZ (Feedback Loop)
    if (result.evaluations && result.evaluations.length > 0) {
      for (const ev of result.evaluations) {
        if (ev.status !== 'ignored') {
          await supabase.from('vanguard_curiosity_queue')
            .update({ status: ev.status, updated_at: new Date().toISOString() })
            .eq('id', ev.id);
        }
      }
    }

    // 3. ZAPIS DO KOLEJKI CIEKAWOŚCI
    const hypotheses = result.hypotheses || [];
    for (const h of hypotheses) {
      await supabase.from('vanguard_curiosity_queue').insert({
        user_id,
        hypothesis: h.hypothesis,
        provocation: result.provocation,
        confidence_score: h.confidence_score,
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
