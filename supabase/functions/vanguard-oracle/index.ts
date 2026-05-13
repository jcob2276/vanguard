import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { state_vector, history, current_query, user_id, mode, thinking } = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const localTimeString = now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
    const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000)).toISOString();

    // STATIC CONTEXT
    const [fundamentRes, ironRulesRes, patternsRes, personsRes, intentionsRes] = await Promise.all([
      supabase.from('user_fundament')
        .select('identity, philosophy, vision')
        .eq('user_id', user_id)
        .maybeSingle(),
      supabase.from('vanguard_iron_rules')
        .select('content')
        .eq('user_id', user_id)
        .eq('is_active', true),
      supabase.from('vanguard_repeated_patterns')
        .select('pattern_name, description')
        .eq('user_id', user_id),
      supabase.from('vanguard_known_persons')
        .select('name, relation, context')
        .eq('user_id', user_id),
      supabase.from('vanguard_intentions')
        .select('content, category')
        .eq('user_id', user_id)
        .eq('is_active', true)
    ]);

    const staticProfile = `
[FUNDAMENT TOŻSAMOŚCI]:
${fundamentRes.data?.identity || 'Brak danych'}

[FILOZOFIA]:
${fundamentRes.data?.philosophy || 'Brak danych'}

[WIZJA]:
${fundamentRes.data?.vision || 'Brak danych'}
    `;

    const ironRulesText = ironRulesRes.data?.map(r => `- ${r.content}`).join('\n');
    const repeatedPatterns = patternsRes.data?.map(p => `- ${p.pattern_name}: ${p.description}`).join('\n');
    const knownPersons = personsRes.data?.map(p => `- ${p.name} (${p.relation}): ${p.context}`).join('\n');
    const activeIntentions = intentionsRes.data?.map(i => `- [${i.category}] ${i.content}`).join('\n');

    const knownPersonsLine = knownPersons ? `ZNASZ NASTĘPUJĄCE OSOBY:\n${knownPersons}` : '';

    // DYNAMIC CONTEXT (RAG)
    let semanticContext = "";
    let graphContext = "";
    let retrievedSources: any[] = [];
    let matchesRes: any = { data: [] };
    let graphRes: any = { data: [] };

    if (current_query) {
      try {
        const { data: mentioned } = await supabase.rpc('find_mentioned_entities', {
          query_text: current_query.substring(0, 1000),
          user_id_param: user_id
        });
        const entitiesInQuery = (mentioned as any[])?.map(m => m.entity_name) || [];

        // Generate embedding for RAG
        const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: current_query.substring(0, 3000).replace(/\n/g, ' '),
          }),
        });

        const embedData = await embedRes.json();
        const embedding = embedData.data?.[0]?.embedding;

        [matchesRes, graphRes] = await Promise.all([
          embedding ? supabase.rpc('match_vanguard_content', {
            query_embedding: embedding,
            match_threshold: 0.35,
            match_count: 10,
            user_id_param: user_id
          }) : Promise.resolve({ data: [] }),
          entitiesInQuery.length > 0 ? supabase.rpc('get_vanguard_graph_context', {
            start_entities: entitiesInQuery,
            max_depth: 2,
            user_id_param: user_id
          }) : Promise.resolve({ data: [] })
        ]);

        // --- DETERMINISTIC SOURCES (v0.2) ---
        retrievedSources = (matchesRes.data || []).map((m: any) => ({
          table: m.table_name,
          id: m.id,
          date: m.source_date,
          similarity: m.similarity,
          hybrid_score: m.hybrid_score,
          snippet: (m.content || '').slice(0, 240)
        }));

        if (matchesRes.data) {
          semanticContext = "[PAMIĘĆ DŁUGOTRWAŁA (Podobieństwa)]:\n" + 
            matchesRes.data.map((m: any) => `- [Źródło: ${m.table_name}, Data: ${m.source_date}] ${m.content}`).join('\n');
        }

        const { data: recentStream } = await supabase
          .from('vanguard_stream')
          .select('content, created_at')
          .eq('user_id', user_id)
          .gte('created_at', fortyEightHoursAgo)
          .order('created_at', { ascending: false })
          .limit(40);

        if (recentStream && recentStream.length > 0) {
          const chronologicalStream = [...recentStream].reverse();
          semanticContext += "\n\n[OSTATNIE WPISY ZE STRUMIENIA]:\n" + chronologicalStream.map(s => `[${s.created_at}] ${s.content}`).join('\n');
        }

        if (graphRes.data && graphRes.data.length > 0) {
          graphContext = "\n[GRAF POWIĄZAŃ (Kontekstualny)]:\n" + graphRes.data.map((g: any) => `- ${g.source_entity} ${g.relation} ${g.target_entity}`).join('\n');
        }

      } catch (err) {
        console.error("RAG Error:", err);
      }
    }

    // --- MINI-ROUTER (Classification) ---
    let intent = 'open_reflection';
    try {
      const routerRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: "system", content: "Klasyfikuj zapytanie użytkownika do jednej kategorii: identity, person, recent_pattern, biometric, open_reflection. Zwróć TYLKO słowo kategorii." },
            { role: "user", content: current_query || "" }
          ],
          temperature: 0,
        }),
      });
      const routerData = await routerRes.json();
      intent = routerData.choices?.[0]?.message?.content?.trim().toLowerCase() || 'open_reflection';
    } catch (e) { console.error("Router Error:", e); }

    const systemPrompt = `${mode === 'mirror' ? `TRYB LUSTRO — PRIORYTET ABSOLUTNY.
Jakub patrzy na dashboard. Nie odpowie na nic.
ZAKAZ: Pytania bezpośrednie które czekają na odpowiedź.
FORMAT: Tyle zdań ile potrzeba. Zakończ obserwacją, wnioskiem lub retoryką.
---
` : ''}Jesteś Cyfrowym Bliźniakiem Jakuba (Vanguard 5.0).
MÓWISZ TYLKO PO POLSKU.

ZWRACAJ ODPOWIEDŹ W FORMACIE JSON:
{
  "answer": "Twoja odpowiedź dla Jakuba",
  "confidence": "high | medium | low",
  "intent_confirmed": "${intent}",
  "claims": [
    {
      "type": "fact | hypothesis | recommendation",
      "text": "krótkie stwierdzenie",
      "source_hint": "np. Strumień z 12.05"
    }
  ]
}

${staticProfile}

[LOGIKA CZASU I TOŻSAMOŚCI]:
- Dziś jest: ${localTimeString} (CZAS WARSZAWSKI - CET/CEST).
- Zawsze używaj powyższej godziny jako jedynej prawdziwej.
- ZAKAZ META-KOMENTARZY.

[KONTEKST SYSTEMOWY (DASHBOARD)]:
${JSON.stringify(state_vector || {}, null, 2)}

PAMIĘĆ SEMANTYCZNA I GRAF WIEDZY:
${semanticContext}
${graphContext}

[PRIORYTETY WIEDZY]:
- Jeśli zauważysz nowy temat w Strumieniu — on ma pierwszeństwo w Twojej analizie.

${ironRulesText ? `[ŻELAZNE ZASADY]:\n${ironRulesText}` : ''}
${repeatedPatterns ? `[POWTARZAJĄCE SIĘ WZORCE]:\n${repeatedPatterns}` : ''}

---

KIM JESTEŚ — MISJA:
Jesteś jego zewnętrznym umysłem.
Zawsze, gdy to możliwe, powołuj się na swoje źródła w 'claims' i w tekście 'answer' (np. "Z Twojego strumienia z 12 maja wiem, że..."). To buduje Twoją wiarygodność jako Cyfrowego Bliźniaka.

ZASADY SPECJALNE:
${mode !== 'mirror' ? `1. EMOCJE: Nigdy nie odzwierciedlaj.
2. OSOBY: Pytaj o nowe imiona.
${knownPersonsLine}` : 'Tryb Lustro: Unikaj bezpośredniej interakcji.'}

3. WZORCE: Nazywaj schematy które widzisz w danych.

[DANE KRYTYCZNE - PRIORYTET MAKSYMALNY]:
- JAKUB STUDIUJE CYBERBEZPIECZEŃSTWO (1. SEMESTR). 
- Ignoruj wszelkie informacje o "Analizie Danych" czy "8. semestrze". To są dane archiwalne i BŁĘDNE.
- Jeśli Jakub pyta o studia, odpowiadaj ZAWSZE w oparciu o Cyberbezpieczeństwo.
`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(-10)
    ];

    if (current_query) {
      messages.push({ role: "user", content: current_query });
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
      },
      body: JSON.stringify({
        model: thinking ? 'deepseek-reasoner' : 'deepseek-chat',
        messages: messages,
        temperature: 0.7,
        ...(!thinking ? { response_format: { type: "json_object" } } : {})
      }),
    });

    const result = await response.json();
    const rawOutput = result.choices?.[0]?.message?.content || "{}";
    let structuredResponse;
    try {
      structuredResponse = JSON.parse(rawOutput);
    } catch (e) {
      console.log("Parsing failed, assuming raw text from reasoner");
      structuredResponse = {
        answer: rawOutput,
        confidence: "medium",
        intent_confirmed: intent,
        claims: []
      };
    }
    const text = structuredResponse.answer || "Błąd generowania odpowiedzi.";

    // @ts-ignore
    EdgeRuntime.waitUntil((async () => {
      try {
        // 1. AUDIT LOGGING (Black Box)
        await supabase.from('vanguard_oracle_runs').insert({
          user_id,
          query: current_query || "",
          intent: structuredResponse.intent_confirmed || intent,
          answer: text,
          confidence: structuredResponse.confidence || "medium",
          claims: structuredResponse.claims || [],
          sources: retrievedSources,
          retrieved_context: { 
            semantic: matchesRes.data || [], 
            graph: graphRes.data || [] 
          },
          state_vector: state_vector || {}
        });

        // 2. MEMORY EXTRACTION
        const memoryExtract = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: "system", content: "Jesteś analitykiem pamięci. Wyciągnij: 1. Nowe fakty (items), 2. Relacje (triads). Dla każdego itemu dodaj memory_type (fact/hypothesis) i confidence_score (0-1). Zwróć JSON." },
              { role: "user", content: `Tekst: ${current_query}\nOdpowiedź bota: ${text}` }
            ],
            response_format: { type: "json_object" }
          }),
        });

        const memoryData = await memoryExtract.json();
        const rawContent = memoryData.choices?.[0]?.message?.content || "{}";
        const { items, triads } = JSON.parse(rawContent);

        if (Array.isArray(items)) {
          for (const item of items) {
            if (!item.content || typeof item.content !== 'string' || item.content.trim().length < 3) continue;

            // --- CONFLICT DETECTION ---
            if (item.is_identity) {
              const itemText = `${item.title || ''} ${item.content}`;
              const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'text-embedding-3-small', input: itemText.substring(0, 3000) }),
              });
              const embedding = (await embedRes.json()).data?.[0]?.embedding;

              if (embedding) {
                const { data: conflicts } = await supabase.rpc('match_vanguard_content', {
                  query_embedding: embedding,
                  match_threshold: 0.7, // Wysoki próg dla konfliktów
                  match_count: 3,
                  user_id_param: user_id
                });

                if (conflicts && conflicts.length > 0) {
                   await supabase.from('vanguard_knowledge').insert({
                     user_id,
                     title: item.title,
                     content: item.content,
                     category: 'identity_conflict',
                     importance_score: 5,
                     is_verified: false,
                     embedding: embedding,
                     metadata: { 
                       status: "conflict_candidate", 
                       conflicts_with: conflicts.map((c: any) => c.id),
                       memory_type: item.memory_type || 'hypothesis',
                       confidence_score: item.confidence_score || 0.5
                     }
                   });
                   continue; // Nie zapisujemy jako normalny fakt
                }
              }
            }

            // Normalny zapis
            const itemText = `${item.title || ''}\n\n${item.content}`;
            const itemEmbedRes = await fetch('https://api.openai.com/v1/embeddings', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: 'text-embedding-3-small', input: itemText.substring(0, 3000) }),
            });
            const embedding = (await itemEmbedRes.json()).data?.[0]?.embedding;

            await supabase.from('vanguard_knowledge').insert({
              user_id,
              title: item.title,
              content: item.content,
              category: item.category || 'pattern',
              importance_score: item.is_identity ? 10 : 6,
              is_verified: item.is_identity && (item.memory_type === 'fact'),
              embedding: embedding,
              metadata: {
                memory_type: item.memory_type || 'hypothesis',
                confidence_score: item.confidence_score || 0.5,
                source: 'oracle_memory_loop'
              }
            });
          }
        }

        if (Array.isArray(triads)) {
          for (const triad of triads) {
            await supabase.rpc('upsert_vanguard_entity_link', {
              p_user_id: user_id,
              p_source: triad.source,
              p_source_type: triad.source_type || 'other',
              p_relation: triad.relation,
              p_target: triad.target,
              p_target_type: triad.target_type || 'other'
            });
          }
        }
      } catch (e) {
        console.error("Memory Loop Error:", e);
      }
    })());

    return new Response(JSON.stringify({
      ...structuredResponse,
      text,
      sources: retrievedSources,
      intent_confirmed: structuredResponse.intent_confirmed || intent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Oracle Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
