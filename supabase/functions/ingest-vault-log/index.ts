import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

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
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.replace(/\n/g, " ").slice(0, 8000),
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data?.[0]?.embedding ?? null
  } catch {
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
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 1800,
      }),
    })
    if (!res.ok) {
      console.error(`[VAULT INGEST] DeepSeek error ${res.status}: ${await res.text()}`)
      return []
    }
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ""
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )
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
      const { data: ontologyRows } = await supabase
        .from("vanguard_relation_ontology")
        .select("relation")

      const allowedRelations = (ontologyRows || []).map((row: any) => row.relation).filter(Boolean)
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
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
