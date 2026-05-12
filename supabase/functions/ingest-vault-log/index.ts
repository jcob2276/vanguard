import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── 1. CHUNKER ────────────────────────────────────────────────────────────────
// Kroi tekst na kawałki ~400 słów z 50-słownym overlapem (zachowuje akapity)
function chunkText(text: string, maxWords = 400, overlapWords = 50): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 10);
  const chunks: string[] = [];
  let current: string[] = [];
  let wordCount = 0;

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/);
    if (wordCount + words.length > maxWords && current.length > 0) {
      chunks.push(current.join('\n\n'));
      // Overlap: zachowaj ostatnie N słów
      const overlapText = current.join('\n\n').split(/\s+/).slice(-overlapWords).join(' ');
      current = [overlapText];
      wordCount = overlapWords;
    }
    current.push(para.trim());
    wordCount += words.length;
  }
  if (current.length > 0) chunks.push(current.join('\n\n'));
  return chunks.filter(c => c.trim().length > 20);
}

// ── 2. EMBEDDING ──────────────────────────────────────────────────────────────
async function embed(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text.replace(/\n/g, ' ').slice(0, 8000) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0]?.embedding ?? null;
  } catch { return null; }
}

// ── 3. ENTITY EXTRACTION (Graf) ───────────────────────────────────────────────
async function extractTriads(text: string, category: string, apiKey: string): Promise<Array<{source: string, source_type: string, relation: string, target: string, target_type: string}>> {
  const prompt = `Jesteś systemem ekstrakcji wiedzy. Przeanalizuj tekst i wypisz relacje jako triady JSON.

Kategoria tekstu: ${category}

Typy encji: person, technique, state, event, physical_state, belief, place, goal
Typy relacji: CAUSES, PRECEDES, CORRELATES_WITH, OPPOSES, SUPPORTS, TRIGGERS, LEADS_TO, DEFINES

Tekst:
${text.slice(0, 3000)}

Odpowiedz TYLKO jako JSON array (max 15 triad):
[{"source":"nazwa","source_type":"typ","relation":"RELACJA","target":"nazwa","target_type":"typ"}]

Zasady:
- Encje: konkretne (np. "Magdalena", "lęk przed bliskością", "brat bliźniak") nie ogólne
- Min 2 słowa dla złożonych stanów
- Tylko pewne relacje, nie spekuluj`;

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[VAULT INGEST] DeepSeek error ${res.status}: ${errText}`);
      return [];
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    console.log(`[VAULT INGEST] DeepSeek raw response: ${content.slice(0, 300)}`);
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) { console.warn('[VAULT INGEST] No JSON array in response'); return []; }
    return JSON.parse(match[0]);
  } catch (e) {
    console.error('[VAULT INGEST] extractTriads exception:', e);
    return [];
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY') ?? '';

    const { userId, category, text } = await req.json();
    if (!userId || !text?.trim()) throw new Error('Missing userId or text');

    console.log(`[VAULT INGEST] user=${userId} category=${category} chars=${text.length}`);

    // ── A. Chunking + Embedding → vanguard_stream ────────────────────────────
    const chunks = chunkText(text);
    console.log(`[VAULT INGEST] ${chunks.length} chunks`);

    let streamCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = openaiKey ? await embed(chunk, openaiKey) : null;

      await supabase.from('vanguard_stream').insert({
        user_id: userId,
        source: 'identity_vault',
        classification: category,
        content: chunk,
        embedding,
        metadata: {
          category,
          chunk_index: i,
          total_chunks: chunks.length,
          ingested_at: new Date().toISOString(),
        }
      });
      streamCount++;
    }

    // ── B. Entity Extraction → vanguard_entity_links (Graf) ──────────────────
    // Ekstrakcja z pełnego tekstu (pierwsze 6000 znaków + środek + koniec)
    const textSample = text.length > 9000
      ? text.slice(0, 3000) + '\n...\n' + text.slice(text.length / 2 - 1500, text.length / 2 + 1500) + '\n...\n' + text.slice(-3000)
      : text;

    let triadCount = 0;
    if (deepseekKey) {
      const triads = await extractTriads(textSample, category, deepseekKey);
      console.log(`[VAULT INGEST] ${triads.length} triads extracted`);

      for (const triad of triads) {
        if (!triad.source || !triad.relation || !triad.target) continue;
        const { error: rpcError } = await supabase.rpc('upsert_vanguard_entity_link', {
          p_user_id: userId,
          p_source: triad.source,
          p_source_type: triad.source_type || 'unknown',
          p_relation: triad.relation,
          p_target: triad.target,
          p_target_type: triad.target_type || 'unknown',
        });
        if (rpcError) {
          console.error(`[VAULT INGEST] RPC error for triad "${triad.source} ${triad.relation} ${triad.target}": ${JSON.stringify(rpcError)}`);
        } else {
          triadCount++;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      chunks: streamCount,
      triads: triadCount,
      message: `Wgrano ${streamCount} chunków i ${triadCount} relacji do grafu.`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error(`[VAULT INGEST ERROR] ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
