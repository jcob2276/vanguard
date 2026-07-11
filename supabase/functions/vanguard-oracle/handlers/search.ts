import { corsHeaders, resolveUserScope } from "../../_shared/supabase.ts";
import { getEmbedding } from "../../_shared/openai.ts";

export async function handleSearch(req: Request, body: any, db: any): Promise<Response> {
  const { userId: scopeId } = await resolveUserScope(req, body.userId ?? null);
  const userId = scopeId || body.userId;
  if (!userId) throw new Error("userId required");

  const query = String(body.query || "").trim();
  const safeQuery = query.replace(/[%_,]/g, '').slice(0, 200);
  if (!query) {
    return new Response(JSON.stringify({ graph: [], todos: [], projects: [], notes: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
  let graphResults: any[] = [];
  if (openAiKey) {
    try {
      const embedding = await getEmbedding(query, openAiKey);
      if (embedding) {
        const { data: vectorData } = await db.rpc("search_entity_links", {
          query_embedding: embedding,
          match_user_id: userId,
          match_count: 10,
        });
        if (vectorData) graphResults = vectorData;
      }
    } catch (err) {
      console.warn("[search] embedding search failed, falling back:", err);
    }
  }

  const { data: ftsData } = await db.rpc("search_entity_links_fulltext", {
    query_text: query,
    match_user_id: userId,
    match_count: 10,
  });

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
        const existing = graphMap.get(key);
        graphMap.set(key, { ...existing, rank: r.rank, source: "hybrid" });
      }
    }
  }

  const { data: todos } = await db
    .from("todo_items")
    .select("id, title, notes, status, priority, due_date")
    .eq("user_id", userId)
    .or(`title.ilike.%${safeQuery}%,notes.ilike.%${safeQuery}%`)
    .limit(10);

  const { data: projects } = await db
    .from("projects")
    .select("id, name, goal, status, color")
    .eq("user_id", userId)
    .or(`name.ilike.%${safeQuery}%,goal.ilike.%${safeQuery}%`)
    .limit(10);

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
}
