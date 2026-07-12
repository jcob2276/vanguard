/**
 * @function vanguard-graph-embedder
 * @trigger HTTP POST / manual
 * @role Generuje embeddingi dla relacji grafu (vanguard_entity_links) w celu wyszukiwania semantycznego.
 * @reads vanguard_entity_links
 * @writes vanguard_entity_links (embedding)
 * @calls text-embedding-3-small, deepseek-v4-flash (do podsumowań relacji)
 * @consumer RAG Wyroczni (wyszukiwanie podobieństwa)
 * @status active
 */
import { getEmbedding } from "../_shared/openai.ts";
import { createServiceClient } from "../_shared/supabase.ts"
import { serveJson } from "../_shared/http.ts"
import { getVanguardUserId } from "../_shared/constants.ts"
import { deepseekChat } from "../_shared/deepseek.ts"

const getOpenAIKey = () => Deno.env.get('OPENAI_API_KEY') ?? '';
const getDeepSeekKey = () => Deno.env.get('DEEPSEEK_API_KEY') ?? '';

async function embedBatch(texts: string[]): Promise<number[][]> {
  const embeddings = await getEmbedding(texts, getOpenAIKey());
  if (!embeddings) throw new Error("Failed to generate embeddings batch");
  return embeddings as number[][];
}

/**
 * Graphiti-inspired: rich fact sentence (not just "source relation target").
 * Before: "Jakub studiuje Cyberbezpieczeństwo"
 * After:  "Jakub (person) studiuje Cyberbezpieczeństwo (kierunek). Pewność: wysoka. Potwierdzony 5 razy."
 */
function buildFactText(link: {
  source_entity: string;
  source_type: string | null;
  relation: string;
  target_entity: string;
  target_type: string | null;
  memory_type: string | null;
  confidence_score: number | null;
  evidence_count: number | null;
  metadata?: Record<string, any> | null;
}): string {
  const relationHuman = link.relation.replace(/_/g, ' ');
  const sourceLabel = link.source_type ? `${link.source_entity} (${link.source_type})` : link.source_entity;
  const targetLabel = link.target_type ? `${link.target_entity} (${link.target_type})` : link.target_entity;
  const conf = link.confidence_score ?? 0.8;
  const confLabel = conf >= 0.9 ? 'wysoka' : conf >= 0.7 ? 'średnia' : 'niska';
  const evidenceNote = link.evidence_count && link.evidence_count > 1
    ? `Potwierdzony ${link.evidence_count} razy.` : '';
  const typeNote = link.memory_type && link.memory_type !== 'fact'
    ? ` Typ: ${link.memory_type}.` : '';
  const keywordsNote = link.metadata?.keywords
    ? ` Tematy: ${link.metadata.keywords}.` : '';
  return `${sourceLabel} ${relationHuman} ${targetLabel}.${typeNote} Pewność: ${confLabel}. ${evidenceNote}${keywordsNote}`.trim();
}

/**
 * HyPE (Hypothetical Prompt Embeddings — NirDiamant/RAG_Techniques #8)
 * At indexing time, generate questions this fact answers → embed fact+questions together.
 * Bridges "question space" ↔ "fact space" gap — same problem HyDE solves at query time.
 *
 * Before embedding: "Jakub (person) studiuje Cyberbezpieczeństwo (kierunek)."
 * After HyPE:       "[fact]\nPytania: Co studiuje Jakub? Jaki kierunek wybrał Jakub? Gdzie Jakub chodzi na studia?"
 */
async function generateHypeQuestions(factText: string): Promise<string> {
  try {
    const result = await deepseekChat({
      apiKey: getDeepSeekKey(),
      model: "deepseek-v4-flash",
      maxTokens: 80,
      temperature: 0.2,
      timeoutMs: 5000,
      messages: [
        {
          role: "system",
          content: "Wygeneruj 3 krótkie pytania po polsku, które BEZPOŚREDNIO odpytują o podany fakt. Tylko pytania, oddzielone ' | ', bez numeracji.",
        },
        { role: "user", content: factText },
      ],
    })
    return result.content.trim()
  } catch {
    return ''
  }
}
/** One batch per invocation — caller re-invokes until remaining is 0. */
async function runBackfillBatch(
  user_id: string,
  batch_size: number,
  force_reembed: boolean,
  hype_mode: boolean,
): Promise<{ processed: number; updated: number; remaining: number | null }> {
  const supabase = createServiceClient();

  const query = supabase
    .from('vanguard_entity_links')
    .select('id, source_entity, source_type, relation, target_entity, target_type, memory_type, confidence_score, evidence_count, metadata')
    .eq('user_id', user_id)
    .limit(batch_size);

  if (!force_reembed) {
    query.is('embedding', null);
  } else {
    query.is('fact_text', null);
  }

  const { data: links, error } = await query;

  if (error) { console.error('[embedder] Fetch error:', error); throw error; }
  if (!links || links.length === 0) {
    console.log('[embedder] All done');
    return { processed: 0, updated: 0, remaining: 0 };
  }

  // Build fact texts
  const factTexts = links.map(buildFactText);

  // HyPE mode: enrich each fact_text with generated hypothetical questions
  let enrichedTexts = factTexts;
  if (hype_mode && getDeepSeekKey()) {
    enrichedTexts = await Promise.all(
      factTexts.map(async (ft) => {
        const questions = await generateHypeQuestions(ft);
        return questions ? `${ft}\nPytania: ${questions}` : ft;
      })
    );
    console.log(`[embedder] HyPE enriched ${links.length} facts with hypothetical questions`);
  }

  const embeddings = await embedBatch(enrichedTexts);

  for (let i = 0; i < links.length; i++) {
    const { error: updateErr } = await supabase
      .from('vanguard_entity_links')
      .update({ embedding: embeddings[i], fact_text: enrichedTexts[i] })
      .eq('id', links[i].id);
    if (updateErr) console.error(`[embedder] Update error id=${links[i].id}:`, updateErr);
  }

  const countQuery = supabase
    .from('vanguard_entity_links')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user_id);

  if (!force_reembed) countQuery.is('embedding', null);
  else countQuery.is('fact_text', null);

  const { count: remaining, error: countErr } = await countQuery;
  if (countErr) throw countErr;

  console.log(`[embedder] Batch done: ${links.length} updated (hype=${hype_mode}), ~${remaining ?? '?'} remaining`);
  return { processed: links.length, updated: links.length, remaining: remaining ?? null };
}

Deno.serve(serveJson(async (req) => {
  const body = await req.clone().json().catch(() => ({}));
  const user_id = body.user_id || getVanguardUserId();
  const batch_size = body.batch_size ? Number(body.batch_size) : 50;
  const force_reembed = body.force_reembed === true;
  const hype_mode = body.hype_mode === true; // HyPE: generate questions at index time

  const result = await runBackfillBatch(user_id, batch_size, force_reembed, hype_mode);

  return {
    success: true,
    ...result,
    message: result.remaining === 0
      ? 'Backfill complete'
      : `Batch embedded; ~${result.remaining} triples remaining — invoke again`,
    estimated_cost_usd: ((result.processed || 0) * 0.000002).toFixed(4),
  };
}, { auth: 'service' }));
