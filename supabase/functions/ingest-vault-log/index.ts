import { getEmbedding } from "../_shared/openai.ts";
import { createServiceClient, corsHeaders } from "../_shared/supabase.ts"
import { deepseekChat } from "../_shared/deepseek.ts"

type Triad = {
  source: string
  source_type?: string
  relation: string
  target: string
  target_type?: string
  memory_type?: string
  confidence_score?: number
  layer?: string
}

function chunkText(text: string, maxWords = 400, overlapWords = 50): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 10)
  const chunks: string[] = []
  let current: string[] = []
  let wordCount = 0

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/)
    if (wordCount + words.length > maxWords && current.length > 0) {
      chunks.push(current.join("\n\n"))
      current = [current.join("\n\n").split(/\s+/).slice(-overlapWords).join(" ")]
      wordCount = overlapWords
    }
    current.push(paragraph.trim())
    wordCount += words.length
  }

  if (current.length > 0) chunks.push(current.join("\n\n"))
  return chunks.filter((chunk) => chunk.trim().length > 20)
}

async function embed(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const embedding = await getEmbedding(text, apiKey)
    if (!embedding || !Array.isArray(embedding)) return null
    if (Array.isArray(embedding[0])) return embedding[0] as number[]
    return embedding as number[]
  } catch (err) {
    console.error("[VAULT INGEST] embed exception:", err)
    return null
  }
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function extractTriads(text: string, category: string, apiKey: string): Promise<Triad[]> {
  return extractTriadsWithOntology(text, category, apiKey, [
    "jest", "posiada", "studiuje", "pracuje_w", "mieszka_w", "ma_relacje_z",
    "zna_osobe", "chce", "dazy_do", "unika", "boi_sie", "prowadzi_do",
    "spowodowane_przez", "poprzedza", "nastepuje_po", "uzywa", "tworzy",
    "cwiczy", "uczy_sie", "deklaruje", "czuje", "doswiadcza", "wynosi",
    "dotyczy", "zawiera", "wspiera", "blokuje", "planuje", "wymaga",
    "pamieta", "osiaga", "reaguje_na", "wywoluje", "wzmacnia", "oslabia",
    "pracuje_nad", "ma_wspomnienie_z", "wskazuje_na", "ma_wskaznik",
    "ma_egzamin", "analizuje",
  ])
}

async function extractTriadsWithOntology(text: string, category: string, apiKey: string, allowedRelations: string[]): Promise<Triad[]> {
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
- Nie mieszaj telemetrii z psychologia; telemetryczne liczby oznacz layer="telemetry".`

  try {
    const result = await deepseekChat({
      apiKey,
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      maxTokens: 1800,
    })
    const content = result.content
    const match = content.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []
    const allowed = new Set(allowedRelations)
    return parsed.filter((triad: Triad) =>
      triad?.source && triad?.relation && triad?.target && allowed.has(triad.relation)
    )
  } catch (error) {
    console.error("[VAULT INGEST] extractTriads exception:", error)
    return []
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const supabase = createServiceClient()
    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? ""
    const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY") ?? ""

    const { userId, category = "identity_vault", text } = await req.json()
    if (!userId || !text?.trim()) throw new Error("Missing userId or text")

    console.log(`[VAULT INGEST] user=${userId} category=${category} chars=${text.length}`)

    const rawHash = await sha256(`${userId}:${category}:${text}`)
    const { data: existingRawEvent } = await supabase
      .from("vanguard_raw_events")
      .select("id")
      .eq("user_id", userId)
      .eq("raw_hash", rawHash)
      .maybeSingle()

    let rawEventId = existingRawEvent?.id ?? null
    if (existingRawEvent) {
      console.log(`[VAULT INGEST] duplicate raw_hash, skipping stream insert: ${rawEventId}`)
      return new Response(JSON.stringify({
        success: true,
        duplicate: true,
        raw_event_id: rawEventId,
        chunks: 0,
        triads: 0,
        message: "Ten vault log byl juz zaimportowany; pominieto duplikat.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    if (!existingRawEvent) {
      const { data: rawInserted, error: rawInsertError } = await supabase.from("vanguard_raw_events").insert({
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
      }).select("id").single()

      if (rawInsertError) throw rawInsertError
      rawEventId = rawInserted?.id ?? null
    }

    const chunks = chunkText(text)
    let streamCount = 0
    const streamIds: string[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = openaiKey ? await embed(chunk, openaiKey) : null

      const { data: streamInserted, error: streamInsertError } = await supabase.from("vanguard_stream").insert({
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
      }).select("id").single()

      if (streamInsertError) throw streamInsertError
      if (streamInserted?.id) streamIds.push(streamInserted.id)
      streamCount++
    }

    const textSample = text.length > 12000
      ? `${text.slice(0, 4000)}\n...\n${text.slice(text.length / 2 - 2000, text.length / 2 + 2000)}\n...\n${text.slice(-4000)}`
      : text

    let triadCount = 0
    if (deepseekKey) {
      const { data: ontologyRows, error: ontologyErr } = await supabase
        .from("vanguard_relation_ontology")
        .select("relation")

      const ontologyList = (ontologyRows || []).map((row: any) => row.relation).filter(Boolean)
      if (ontologyErr) console.warn('[VAULT INGEST] ontology fetch failed, using hardcoded fallback:', ontologyErr.message)
      const allowedRelations = ontologyList.length > 0 ? ontologyList : [
        "jest", "posiada", "studiuje", "pracuje_w", "mieszka_w", "ma_relacje_z",
        "zna_osobe", "chce", "dazy_do", "unika", "boi_sie", "prowadzi_do",
        "spowodowane_przez", "poprzedza", "nastepuje_po", "uzywa", "tworzy",
        "cwiczy", "uczy_sie", "deklaruje", "czuje", "doswiadcza", "wynosi",
        "dotyczy", "zawiera", "wspiera", "blokuje", "planuje", "wymaga",
        "pamieta", "osiaga", "reaguje_na", "wywoluje", "wzmacnia", "oslabia",
        "pracuje_nad", "ma_wspomnienie_z", "wskazuje_na", "ma_wskaznik",
        "ma_egzamin", "analizuje",
      ]
      const triads = await extractTriadsWithOntology(textSample, category, deepseekKey, allowedRelations)
      console.log(`[VAULT INGEST] ${triads.length} triads extracted`)

      for (const triad of triads) {
        if (!triad.source || !triad.relation || !triad.target) continue
        const { error } = await supabase.rpc("upsert_vanguard_entity_link", {
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
        })
        if (!error) triadCount++
        else console.error("[VAULT INGEST] graph upsert error:", error)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      chunks: streamCount,
      triads: triadCount,
      message: `Wgrano ${streamCount} chunkow i ${triadCount} relacji do grafu.`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error: any) {
    console.error(`[VAULT INGEST ERROR] ${error.message}`)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
