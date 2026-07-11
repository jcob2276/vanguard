/**
 * @function vanguard-capture
 * @trigger HTTP POST / Frontend / extension
 * @role Szybkie przechwytywanie notatek tekstowych i głosowych oraz zapisywanie do bazy jako stream/linki.
 * @reads vanguard_stream, vanguard_entity_links, entities, vanguard_relation_ontology, vanguard_links
 * @writes vanguard_stream, vanguard_raw_events, vanguard_entity_links, audit_events, vanguard_relation_ontology, vanguard_links
 * @calls deepseek-v4-flash, text-embedding-3-small
 * @consumer Inbox w aplikacji frontendowej (stream i linki)
 * @status active
 */
import { getEmbedding, transcribeBlob } from "../_shared/openai.ts";
import { createServiceClient, corsHeaders, resolveUserScope } from "../_shared/supabase.ts";
import { deepseekChat } from "../_shared/deepseek.ts";
import { deprecateSupersededLinks } from "../_shared/deprecateSupersededLinks.ts";
import { fetchUrlMetadata, generateLinkAnalysis } from "../vanguard-telegram/_handlers/savedLinks.ts";

type Triad = {
  source: string;
  source_type?: string;
  relation: string;
  target: string;
  target_type?: string;
  memory_type?: string;
  confidence_score?: number;
  layer?: string;
};

function chunkText(text: string, maxWords = 400, overlapWords = 50): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 10);
  const chunks: string[] = [];
  let current: string[] = [];
  let wordCount = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/);
    if (wordCount + words.length > maxWords && current.length > 0) {
      chunks.push(current.join("\n\n"));
      current = [current.join("\n\n").split(/\s+/).slice(-overlapWords).join(" ")];
      wordCount = overlapWords;
    }
    current.push(paragraph.trim());
    wordCount += words.length;
  }

  if (current.length > 0) chunks.push(current.join("\n\n"));
  return chunks.filter((chunk) => chunk.trim().length > 20);
}

async function embed(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const embedding = await getEmbedding(text, apiKey);
    if (!embedding || !Array.isArray(embedding)) return null;
    if (Array.isArray(embedding[0])) return embedding[0] as number[];
    return embedding as number[];
  } catch (err) {
    console.error("[capture] embed exception:", err);
    return null;
  }
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function extractTriadsWithOntology(
  text: string,
  category: string,
  apiKey: string,
  allowedRelations: string[]
): Promise<Triad[]> {
  const prompt = `Jestes systemem ekstrakcji wiedzy Vanguard OS. Przeanalizuj tekst i wypisz relacje jako triady JSON.

Kategoria tekstu: ${category}

Typy encji: person, project, place, state, event, physical_state, belief, goal, value, habit, fear, relationship, memory.
Relacja MUSI byc jedna z tej ontologii:
${allowedRelations.join(", ")}

Tekst:
${text.slice(0, 4000)}

Odpowiedz TYLKO jako JSON array, max 20 triad:
[{"source":"Jakub","source_type":"person","relation":"relacja_po_polsku","target":"nazwa","target_type":"typ","memory_type":"fact","confidence_score":0.8,"layer":"intelligence"}]

Zasady:
- Uzywaj "Jakub" jako kanonicznej encji uzytkownika.
- Encje maja byc konkretne, nie ogolne.
- Tylko pewne relacje, nie spekuluj. Hipotezy oznacz memory_type="hypothesis".
- Nie mieszaj telemetrii z psychologia; telemetryczne liczby oznacz layer="telemetry".`;

  try {
    const result = await deepseekChat({
      apiKey,
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      maxTokens: 1800,
    });
    const content = result.content;
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set(allowedRelations);
    return parsed.filter((triad: Triad) =>
      triad?.source && triad?.relation && triad?.target && allowed.has(triad.relation)
    );
  } catch (error) {
    console.error("[capture] extractTriads exception:", error);
    return [];
  }
}

async function handleVaultIngest(
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
      "zna_osobe", "chce", "dazy_do", "unika", "boi_sie", "prowadzi_do",
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
          db,
          userId,
          triad.source,
          triad.relation,
          triad.target,
          conf,
          streamIds[0] || rawEventId
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const db = createServiceClient();
    const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";

    const contentType = req.headers.get("content-type") || "";
    let userId = "";
    let content = "";
    let source = "shortcut";
    let metadata: Record<string, any> = {};
    let isVaultLog = false;
    let category = "identity_vault";
    let text = "";

    if (contentType.includes("multipart/form-data")) {
      const { userId: scopeId } = await resolveUserScope(req, null);
      if (!scopeId) throw new Error("Unauthorized");
      userId = scopeId;

      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) throw new Error("Missing audio file in form data");
      
      const declaredSource = formData.get("source");
      if (declaredSource) source = String(declaredSource);

      const declaredMeta = formData.get("metadata");
      if (declaredMeta) {
        try {
          metadata = JSON.parse(String(declaredMeta));
        } catch (_) {}
      }

      if (!openAiKey) throw new Error("OPENAI_API_KEY is not configured");
      content = await transcribeBlob(file, openAiKey, { filename: file.name || "audio.webm" });
      metadata.from_voice = true;
      source = "voice";

    } else {
      const body = await req.json().catch(() => ({}));
      const { userId: scopeId } = await resolveUserScope(req, body.userId ?? null);
      userId = scopeId || body.userId;
      if (!userId) throw new Error("userId required");

      const action = body.action;
      source = String(body.source || "shortcut");
      
      isVaultLog = body.text !== undefined || action === "vault_log" || source === "identity_vault";
      if (isVaultLog) {
        text = String(body.text || "").trim();
        category = String(body.category || "identity_vault");
      } else {
        content = String(body.content || "").trim();
        metadata = body.metadata || {};
      }
    }

    if (isVaultLog) {
      if (!text) throw new Error("Text is empty");
      return await handleVaultIngest(db, userId, text, category, openAiKey, deepseekApiKey);
    }

    if (!content) throw new Error("Content is empty");

    // Check if the content is a URL link
    const urlMatch = content.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      const url = urlMatch[0].replace(/(https?:\/\/.+?)(https?:\/\/.*)$/, "$1");
      console.log(`[capture] URL detected: ${url}`);

      const meta = await fetchUrlMetadata(url);
      const analysis = await generateLinkAnalysis(meta.title, meta.description, url, deepseekApiKey);

      const { data, error } = await db.from("vanguard_links").insert({
        user_id: userId,
        url,
        title: meta.title,
        description: meta.description,
        takeaways: analysis.takeaways,
        category: analysis.category,
        domain: meta.domain,
        status: "unread",
        ...(meta.thumbnailUrl && { thumbnail_url: meta.thumbnailUrl }),
        ...(meta.channelName && { channel_name: meta.channelName }),
      }).select("*").single();

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, type: "link", data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await db.from("vanguard_stream").insert({
      user_id: userId,
      source,
      content,
      metadata,
    }).select("*").single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, type: "stream", data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[capture] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
