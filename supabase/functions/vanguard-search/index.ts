import { createServiceClient, corsHeaders, resolveUserScope } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const db = createServiceClient();
    const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";

    const body = await req.json().catch(() => ({}));
    const { userId: scopeId } = await resolveUserScope(req, body.userId ?? null);
    const userId = scopeId || body.userId;
    if (!userId) throw new Error("userId required");

    const query = String(body.query || "").trim();
    // Strip chars that are special in Supabase .or() filter strings or SQL ILIKE
    const safeQuery = query.replace(/[%_,]/g, '').slice(0, 200);
    if (!query) {
      return new Response(JSON.stringify({ graph: [], todos: [], projects: [], notes: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Generate query embedding if OpenAI key is present
    let graphResults: any[] = [];
    if (openAiKey) {
      try {
        const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: query,
            model: "text-embedding-3-small",
          }),
        });

        if (embedRes.ok) {
          const embedData = await embedRes.json();
          const embedding = embedData.data?.[0]?.embedding;
          if (embedding) {
            // Vector search on graph
            const { data: vectorData } = await db.rpc("search_entity_links", {
              query_embedding: embedding,
              match_user_id: userId,
              match_count: 10,
            });
            if (vectorData) graphResults = vectorData;
          }
        }
      } catch (err) {
        console.warn("[search] embedding search failed, falling back:", err);
      }
    }

    // 2. Full-Text Search on Graph
    const { data: ftsData } = await db.rpc("search_entity_links_fulltext", {
      query_text: query,
      match_user_id: userId,
      match_count: 10,
    });

    // Merge & deduplicate graph results based on (source_entity, relation, target_entity)
    const graphMap = new Map<string, any>();
    for (const r of graphResults) {
      const key = `${r.source_entity}::${r.relation}::${r.target_entity}`;
      graphMap.set(key, { ...r, source: "vector" });
    }
    if (ftsData) {
      for (const r of ftsData) {
        const key = `${r.source_entity}::${r.relation}::${r.target_entity}`;
        if (!graphMap.has(key)) {
          graphMap.set(key, { ...r, source: "fts" });
        } else {
          // Keep best metadata
          const existing = graphMap.get(key);
          graphMap.set(key, { ...existing, rank: r.rank, source: "hybrid" });
        }
      }
    }

    // 3. Search todo_items (ILIKE title/notes)
    const { data: todos } = await db
      .from("todo_items")
      .select("id, title, notes, status, priority, due_date")
      .eq("user_id", userId)
      .or(`title.ilike.%${safeQuery}%,notes.ilike.%${safeQuery}%`)
      .limit(10);

    // 4. Search projects (ILIKE name/goal)
    const { data: projects } = await db
      .from("projects")
      .select("id, name, goal, status, color")
      .eq("user_id", userId)
      .or(`name.ilike.%${safeQuery}%,goal.ilike.%${safeQuery}%`)
      .limit(10);

    // 5. Search vanguard_notes (ILIKE title/content)
    const { data: notes } = await db
      .from("vanguard_notes")
      .select("id, title, content, tags, updated_at")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .or(`title.ilike.%${safeQuery}%,content.ilike.%${safeQuery}%`)
      .limit(10);

    return new Response(
      JSON.stringify({
        graph: Array.from(graphMap.values()),
        todos: todos || [],
        projects: projects || [],
        notes: notes || [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err: unknown) {
    console.error("[search] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
