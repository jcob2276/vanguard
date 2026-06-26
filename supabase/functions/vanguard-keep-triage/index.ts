import { createServiceClient, corsHeaders, resolveUserScope } from "../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";

const ACTIONS = new Set(["keep", "archive", "todo"]);
const MAX_NOTES = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { userId: scopeId } = await resolveUserScope(req, body.userId ?? null);
    const userId = scopeId ?? body.userId;
    if (!userId) throw new Error("userId required");

    const db = createServiceClient();
    const apiKey = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");

    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data: staleNotes, error: notesErr } = await db
      .from("vanguard_notes")
      .select("id, title, content, tags, updated_at")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: true });
    if (notesErr) throw notesErr;

    const totalStale = (staleNotes ?? []).length;
    if (totalStale === 0) {
      return new Response(JSON.stringify({ suggestions: [], totalStale: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const notesForPrompt = (staleNotes ?? []).slice(0, MAX_NOTES);
    const snippets = new Map<string, string>();
    for (const n of notesForPrompt as any[]) {
      const snippet = String(n.content ?? "").slice(0, 200);
      snippets.set(n.id, snippet);
    }

    const now = Date.now();
    const notesBlock = (notesForPrompt as any[])
      .map((n) => {
        const days = Math.floor((now - new Date(n.updated_at).getTime()) / 86400000);
        const tags = (n.tags ?? []).length ? ` [tagi: ${(n.tags ?? []).join(", ")}]` : "";
        return `id: ${n.id}\ntytul: ${n.title || "(bez tytulu)"}\ntresc: ${snippets.get(n.id)}\nlezy bez zmian: ${days} dni${tags}`;
      })
      .join("\n---\n");

    const systemPrompt =
      "Jestes Antigravity - AI Jakuba. Ocenisz stare notatki z Keep, ktore nie byly edytowane 30+ dni.\n\n" +
      "Dla kazdej notatki zdecyduj jedna akcje:\n" +
      "- \"keep\" - wciaz aktualna/wazna, niech lezy dalej\n" +
      "- \"archive\" - nieaktualna, bezuzyteczna, mozna zarchiwizowac\n" +
      "- \"todo\" - to w istocie zadanie do wykonania, lepiej jako todo z deadlinem niz notatka\n\n" +
      "reasoning: jedno krotkie zdanie po polsku, konkretne uzasadnienie.\n\n" +
      "Zwroc TYLKO JSON: {\"suggestions\": [{\"id\": \"...\", \"action\": \"keep|archive|todo\", \"reasoning\": \"...\"}]}";

    const { content } = await deepseekChat({
      apiKey,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: notesBlock },
      ],
      model: "deepseek-v4-flash",
      maxTokens: 2000,
      temperature: 0.2,
      responseFormat: { type: "json_object" },
    });

    const parsed = parseJsonFromContent(content);
    if (!parsed) throw new Error("Invalid AI JSON: " + content.slice(0, 200));

    const validIds = new Set(notesForPrompt.map((n: any) => n.id));
    const titleById = new Map((notesForPrompt as any[]).map((n) => [n.id, n.title]));

    const rawSuggestions = Array.isArray((parsed as any).suggestions) ? (parsed as any).suggestions : [];
    const suggestions = rawSuggestions
      .filter((s: any) => s && validIds.has(s.id) && ACTIONS.has(s.action))
      .map((s: any) => ({
        id: s.id,
        title: titleById.get(s.id) || "",
        snippet: snippets.get(s.id) || "",
        action: s.action,
        reasoning: String(s.reasoning || "").slice(0, 300),
      }));

    return new Response(JSON.stringify({ suggestions, totalStale }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    console.error("[vanguard-keep-triage] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
