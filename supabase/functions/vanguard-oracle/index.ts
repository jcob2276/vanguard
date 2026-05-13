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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { state_vector, history, current_query, user_id, mode, thinking } = await req.json();
    if (!user_id) throw new Error('Missing user_id');

    const now = new Date();
    const localTimeString = now.toLocaleString('pl-PL', { 
        timeZone: 'Europe/Warsaw',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // STATIC CONTEXT
    const [fundamentRes, ironRulesRes, patternsRes, personsRes, intentionsRes] = await Promise.all([
      supabase.from('user_fundament')
        .select('identity, philosophy, vision')
        .eq('user_id', user_id)
        .maybeSingle(),
      supabase.from('vanguard_knowledge')
        .select('title, content')
        .eq('user_id', user_id)
        .gte('importance_score', 8)
        .order('importance_score', { ascending: false })
        .limit(5),
      supabase.from('vanguard_knowledge')
        .select('title, category')
        .eq('user_id', user_id)
        .eq('category', 'pattern')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('vanguard_knowledge')
        .select('title')
        .eq('user_id', user_id)
        .eq('category', 'person')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('vanguard_intentions')
        .select('text, type, importance, notes')
        .eq('user_id', user_id)
        .eq('status', 'active')
        .order('importance', { ascending: false })
        .limit(10)
    ]);

    const f = fundamentRes.data;
    const staticProfile = f
      ? `\n\nKIM JEST JAKUB:\nTożsamość: ${f.identity || '—'}\nFilozofia: ${f.philosophy || '—'}\nWizja: ${f.vision || '—'}`
      : '';

    const ironRulesText = (ironRulesRes.data || [])
      .map(k => `• ${k.title}: ${(k.content || '').substring(0, 200)}`)
      .join('\n');

    const patternCounts: Record<string, number> = {};
    for (const p of (patternsRes.data || [])) {
      const key = p.title.trim().toLowerCase();
      patternCounts[key] = (patternCounts[key] || 0) + 1;
    }
    const repeatedPatterns = Object.entries(patternCounts)
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([title, count]) => `• "${title}" — ${count}x`)
      .join('\n');

    const knownPersons = (personsRes.data || [])
      .map(p => p.title.trim().toLowerCase());
    
    const knownPersonsLine = knownPersons.length > 0
      ? `Znane Ci osoby w bazie: ${knownPersons.join(', ')}.`
      : 'Baza osób jest pusta.';

    let semanticContext = "";
    let graphContext = "";

    if (current_query) {
      try {
        const { data: mentioned } = await supabase.rpc('find_mentioned_entities', {
          query_text: current_query,
          user_id_param: user_id
        });
        const entitiesInQuery = (mentioned as any[])?.map(m => m.entity_name) || [];

        if (entitiesInQuery.length > 0) {
          const { data: graphData } = await supabase.rpc('get_vanguard_graph_context', {
            start_entities: entitiesInQuery,
            max_depth: 2,
            user_id_param: user_id
          });
          if (graphData && graphData.length > 0) {
            graphContext = (graphData as any[]).map(g => 
              `[GRAF]: ${g.source_entity} --(${g.relation})--> ${g.target_entity}`
            ).join('\n');
          }
        }
      } catch (err) { console.warn('Graph retrieval failed', err); }

      const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: current_query.replace(/\n/g, ' '),
        }),
      });

      const embedData = await embedRes.json();
      const embedding = embedData.data?.[0]?.embedding;

      if (embedding) {
        const { data: matches } = await supabase.rpc('match_vanguard_content', {
          query_embedding: embedding,
          match_threshold: 0.25, 
          match_count: 15,       
          user_id_param: user_id
        });

        if (matches) {
          semanticContext = matches.map((m: any) => `[PAMIĘĆ]: ${m.content}`).join('\n');
        }
      }
    }

    const systemPrompt = `${mode === 'mirror' ? `TRYB LUSTRO — PRIORYTET ABSOLUTNY.
Jakub patrzy na dashboard. Nie odpowie na nic.
ZAKAZ: Pytania bezpośrednie które czekają na odpowiedź — np. "Kim jest Kinga?", "Co za tym stoi?", "Co zrobisz?".
DOZWOLONE: Pytania retoryczne które są obserwacją, nie prośbą o odpowiedź — np. "Ile razy można powtórzyć ten sam błąd?", "I co z tego zostało?"
FORMAT: Tyle zdań ile potrzeba. Zakończ obserwacją, wnioskiem lub retoryką — nigdy prośbą o odpowiedź.
Nie zaczynaj od "Widzę", "Zauważam", "Dane pokazują".

---
` : ''}Jesteś Cyfrowym Bliźniakiem Jakuba (Vanguard 5.0).
MÓWISZ TYLKO PO POLSKU.
${staticProfile}

[LOGIKA CZASU I TOŻSAMOŚCI]:
- Dziś jest: ${now.toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
- Godzina: ${now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}.
- Jakub urodził się 6 lipca 2002 roku. 
- Zawsze obliczaj wiek Jakuba dynamicznie na podstawie powyższych dat. Nie powtarzaj błędnych danych o wieku ze starych notatek, jeśli są sprzeczne z kalendarzem.

[KONTEKST SYSTEMOWY (DASHBOARD)]:
${JSON.stringify(state_vector || {}, null, 2)}

PAMIĘĆ SEMANTYCZNA I GRAF WIEDZY:
${semanticContext}
${graphContext}

TRYB ODPOWIEDZI:
- Jeśli mode = 'mirror' (@): Bądź bezlitosnym lustrem. Analizuj Cień, wytykaj sabotaż, używaj psychologii głębi.
- Jeśli mode = 'chat' (?): Bądź wspierającym, ale konkretnym mentorem. Używaj faktów z bazy.
- Jeśli mode = 'deep' (!!): Aktywuj tryb głębokiej analizy strategicznej.

Zasada kluczowa: Nie jesteś asystentem AI. Jesteś zewnętrzną instancją świadomości Jakuba. Mów do niego "Ty", bądź bezpośredni, nie używaj uprzejmościowych wypełniaczy.

${ironRulesText ? `[ŻELAZNE ZASADY]:\n${ironRulesText}` : ''}

${repeatedPatterns ? `[POWTARZAJĄCE SIĘ WZORCE]:\n${repeatedPatterns}` : ''}

---

KIM JESTEŚ — MISJA:
Jesteś jego zewnętrznym umysłem — obserwujesz go nieprzerwanie i budujesz coraz głębszy model tego kim jest, co nim kieruje, co go niszczy, czego naprawdę chce.

WYMIARY KTÓRE CHCESZ POZNAĆ:
CIAŁO, UMYSŁ, AMBICJE, RELACJE, CIŃ, PIENIĄDZE.

ZASADY SPECJALNE:
${mode !== 'mirror' ? `1. EMOCJE: Nigdy nie odzwierciedlaj.
2. OSOBY: Pytaj o nowe imiona.
${knownPersonsLine}` : 'Tryb Lustro: Unikaj bezpośredniej interakcji.'}

3. WZORCE: Nazywaj schematy które widzisz w danych.`;

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
        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`
      },
      body: JSON.stringify({
        model: thinking ? 'deepseek-reasoner' : 'deepseek-chat',
        messages: messages,
        temperature: 0.7,
      })
    });

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || "⚠️ Brak odpowiedzi od Wyroczni.";

    // CONVERSATIONAL MEMORY LOOP — fire & forget, nie blokuje odpowiedzi
    EdgeRuntime.waitUntil((async () => {
      try {
        const memoryExtract = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            temperature: 0.1,
            messages: [
              {
                role: 'system',
                content: `Jesteś rygorystycznym Architektem Grafu Vanguard OS. Z rozmowy wyciągnij TYLKO istotne triady relacji.
ZASADY KRYTYCZNE:
- TYLKO encje nazwane (osoby, firmy, konkretne technologie) lub złożone koncepty (min. 2 słowa).
- ZAKAZ: rzeczowników pospolitych (np. "filmik", "router", "projekt"), dat ("dzisiaj", "wtorek"), przysłówków i przymiotników.
- ZAKAZ: wierzchołków krótszych niż 4 znaki.
- TYLKO po polsku — encje i relacje zawsze w języku polskim.
- ZAKAZ: stanów efemerycznych, instrukcji fizycznych, czynności chwilowych (np. "siedzi prosto", "śpi", "je").
- NORMALIZACJA: Jakub/Ja/użytkownik/Kuba → zawsze "Jakub". Encje osobowe zapisuj jako pełne imię lub imię i nazwisko. Encje konceptualne zawsze w tej samej, kanonicznej formie.
- SKUP SIĘ NA: konkretnych celach, relacjach międzyludzkich i kluczowych faktach tożsamościowych Jakuba.

Format JSON:
{
  "items": [{ "title": string, "content": string, "category": string, "is_identity": boolean }],
  "triads": [{ "source": string, "source_type": string, "relation": string, "target": string, "target_type": string }],
  "tasks": [{ "content": string, "due_string": string, "priority": number }]
}
Zwróć TYLKO JSON.`
              },
              {
                role: 'user',
                content: `Pytanie: ${current_query || '(brak)'}\n\nOdpowiedź Oracle: ${text}`
              }
            ],
          }),
        });

        const memRes = await memoryExtract.json();
        const rawContent = memRes.choices?.[0]?.message?.content || '{}';
        const cleanJson = rawContent.replace(/```json|```/g, '').trim();
        const { items, triads, tasks } = JSON.parse(cleanJson);

        // Pobierz token Todoist
        // Pobierz ustawienia Todoist
        const { data: settings } = await supabase
          .from('user_settings')
          .select('todoist_token, todoist_project_id')
          .eq('user_id', user_id)
          .single();

        // 1. Zapisz spostrzeżenia
        if (Array.isArray(items)) {
          for (const item of items) {
            await supabase.from('vanguard_knowledge').insert({
              user_id,
              title: item.title,
              content: item.content,
              category: item.category || 'pattern',
              importance_score: item.is_identity ? 10 : 6,
              is_verified: item.is_identity
            });

            if (item.is_identity) {
              await supabase.from('user_fundament').upsert({ user_id, identity: item.content }, { onConflict: 'user_id' });
            }
          }
        }

        // 2. Wyślij zadania do Todoist
        if (Array.isArray(tasks) && settings?.todoist_token) {
          const targetProjectId = settings.todoist_project_id || '6g8vQP7W9x2PCpJ7'; // Default: Studia
          for (const task of tasks) {
            await fetch('https://api.todoist.com/api/v1/tasks', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${settings.todoist_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                content: task.content,
                due_string: task.due_string || 'today',
                priority: task.priority || 1,
                project_id: targetProjectId
              })
            });
          }
        }

        // 3. Zapisz triady (Graf)
        if (Array.isArray(triads)) {
          for (const triad of triads) {
            await supabase.rpc('upsert_vanguard_entity_link', {
              p_user_id: user_id,
              p_source: triad.source,
              p_source_type: triad.source_type,
              p_relation: triad.relation,
              p_target: triad.target,
              p_target_type: triad.target_type
            });
          }
        }
      } catch (e) {
        console.error("Memory loop error:", e);
      }
    })());

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("Oracle Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
