import { corsHeaders } from "../_shared/supabase.ts";
import { deprecateSupersededLinks } from "../_shared/deprecateSupersededLinks.ts";
import { chunkText, embed, sha256, extractTriadsWithOntology } from "./captureHelpers.ts";

export async function handleVaultIngest(
  db: any,
  userId: string,
  text: string,
  category: string,
  openaiKey: string,
  deepseekKey: string
): Promise<Response> {
  console.log(`[capture/vault-ingest] user=${userId} category=${category} chars=${text.length}`);

  const rawHash = await sha256(`${userId}:${category}:${text}`);
  const { data: existingRawEvent } = await db
    .from("vanguard_raw_events")
    .select("id")
    .eq("user_id", userId)
    .eq("raw_hash", rawHash)
    .maybeSingle();

  let rawEventId = existingRawEvent?.id ?? null;
  if (existingRawEvent) {
    console.log(`[capture/vault-ingest] duplicate raw_hash, skipping stream insert: ${rawEventId}`);
    return new Response(JSON.stringify({
      success: true,
      duplicate: true,
      raw_event_id: rawEventId,
      chunks: 0,
      triads: 0,
      message: "Ten vault log byl juz zaimportowany; pominieto duplikat.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: rawInserted, error: rawInsertError } = await db.from("vanguard_raw_events").insert({
    user_id: userId,
    source: "identity_vault",
    event_type: "vault_log",
    raw_text: text,
    raw_hash: rawHash,
    payload: { text },
    metadata: {
      category,
      char_count: text.length,
      word_count: text.trim().split(/\s+/).length,
    },
    occurred_at: new Date().toISOString(),
    processing_status: "processed",
  }).select("id").single();

  if (rawInsertError) throw rawInsertError;
  rawEventId = rawInserted?.id ?? null;

  const chunks = chunkText(text);
  let streamCount = 0;
  const streamIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = openaiKey ? await embed(chunk, openaiKey) : null;

    const { data: streamInserted, error: streamInsertError } = await db.from("vanguard_stream").insert({
      user_id: userId,
      source: "identity_vault",
      classification: category,
      content: chunk,
      embedding,
      metadata: {
        category,
        chunk_index: i,
        total_chunks: chunks.length,
        ingested_at: new Date().toISOString(),
        raw_event_id: rawEventId,
      },
    }).select("id").single();

    if (streamInsertError) throw streamInsertError;
    if (streamInserted?.id) streamIds.push(streamInserted.id);
    streamCount++;
  }

  const textSample = text.length > 12000
    ? `${text.slice(0, 4000)}\n...\n${text.slice(text.length / 2 - 2000, text.length / 2 + 2000)}\n...\n${text.slice(-4000)}`
    : text;

  let triadCount = 0;
  if (deepseekKey) {
    const { data: ontologyRows, error: ontologyErr } = await db
      .from("vanguard_relation_ontology")
      .select("relation");

    const ontologyList = (ontologyRows || []).map((row: any) => row.relation).filter(Boolean);
    if (ontologyErr) console.warn('[capture] ontology fetch failed, using hardcoded fallback:', ontologyErr.message);
    const allowedRelations = ontologyList.length > 0 ? ontologyList : [
      "jest", "posiada", "studiuje", "pracuje_w", "mieszka_w", "ma_relacje_z",
      "zna_osobe", "chce", "dazy_do", "unika", "boi_sie", "prowadzido",
      "spowodowane_przez", "poprzedza", "nastepuje_po", "uzywa", "tworzy",
      "cwiczy", "uczy_sie", "deklaruje", "czuje", "doswiadcza", "wynosi",
      "dotyczy", "zawiera", "wspiera", "blokuje", "planuje", "wymaga",
      "pamieta", "osiaga", "reaguje_na", "wywoluje", "wzmacnia", "oslabia",
      "pracuje_nad", "ma_wspomnienie_z", "wskazuje_na", "ma_wskaznik",
      "ma_egzamin", "analizuje",
    ];
    const triads = await extractTriadsWithOntology(textSample, category, deepseekKey, allowedRelations);
    console.log(`[capture] ${triads.length} triads extracted`);

    for (const triad of triads) {
      if (!triad.source || !triad.relation || !triad.target) continue;
      const { error } = await db.rpc("upsert_vanguard_entity_link", {
        p_user_id: userId,
        p_source: triad.source,
        p_source_type: triad.source_type || "unknown",
        p_relation: triad.relation,
        p_target: triad.target,
        p_target_type: triad.target_type || "unknown",
        p_confidence_score: triad.confidence_score || 0.7,
        p_memory_type: triad.memory_type || "fact",
        p_layer: triad.layer || "intelligence",
        p_metadata: {
          source: "vault_ingest",
          vault_category: category,
          raw_event_id: rawEventId,
          ingested_at: new Date().toISOString(),
        },
        p_source_episode_id: streamIds[0] || rawEventId,
        p_observed_at: new Date().toISOString(),
      });
      if (!error) {
        triadCount++;
        const conf = triad.confidence_score || 0.7;
        await deprecateSupersededLinks(
          db, userId, triad.source, triad.relation, triad.target, conf, streamIds[0] || rawEventId
        );
      } else console.error("[capture] graph upsert error:", error);
    }
  }

  return new Response(JSON.stringify({
    success: true,
    chunks: streamCount,
    triads: triadCount,
    message: `Wgrano ${streamCount} chunkow i ${triadCount} relacji do grafu.`,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
