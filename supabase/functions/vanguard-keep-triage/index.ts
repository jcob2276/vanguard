/**
 * @function vanguard-keep-triage
 * @trigger HTTP POST / Frontend weekly ritual (Direction tab)
 * @role Klasyfikuje i segreguje notatki Google Keep (akcja: keep/archive/todo, kategoria).
 * @reads vanguard_notes, vanguard_stream (poprzez powiązania)
 * @writes vanguard_notes (status, kategoria), vanguard_stream
 * @calls deepseek-chat
 * @consumer Widok notatek w zakładce Direction w aplikacji
 * @status active
 */
import { createServiceClient, corsHeaders, resolveUserScope } from "../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";

const ACTIONS = new Set(["keep", "archive", "todo"]);
const CATEGORIES = new Set(["Kariera", "Zdrowie", "Technologia", "Biznes", "Inne"]);
const MAX_LINKS = 15;

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

    // Fetch oldest unread links
    const { data: unreadLinks, error: linksErr } = await db
      .from("vanguard_links")
      .select("id, title, url, description, category, takeaways, created_at")
      .eq("user_id", userId)
      .eq("status", "unread")
      .order("created_at", { ascending: true })
      .limit(MAX_LINKS);

    if (linksErr) throw linksErr;

    const totalStale = (unreadLinks ?? []).length;
    if (totalStale === 0) {
      return new Response(JSON.stringify({ suggestions: [], totalStale: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const linksBlock = (unreadLinks ?? [])
      .map((l) => {
        return `id: ${l.id}\ntytul: ${l.title || "(bez tytulu)"}\nurl: ${l.url}\nopis: ${String(l.description || "").slice(0, 150)}\nkategoria: ${l.category || "nieznana"}`;
      })
      .join("\n---\n");

    const systemPrompt =
      "Jestes Antigravity - AI Jakuba. Ocenisz nieprzeczytane linki z jego skrzynki odbiorczej (LinksInbox).\n\n" +
      "Dla kazdego linku zdecyduj:\n" +
      "1. \"action\": jedna z akcji:\n" +
      "   - \"keep\" - zostaw w skrzynce (nadal wazne do przeczytania/obejrzenia)\n" +
      "   - \"archive\" - bezuzyteczne, zdezaktualizowane, mozna zarchiwizowac\n" +
      "   - \"todo\" - to jest konkretne zadanie lub material do natychmiastowej akcji, lepiej stworzyc z tego zadanie todo\n" +
      "2. \"category\": popraw lub uzupelnij kategorie (wybierz jedna z: Kariera, Zdrowie, Technologia, Biznes, Inne)\n" +
      "3. \"takeaways\": lista dokładnie 3 krótkich, konkretnych wniosków/takeaways na podstawie tytulu/opisu (po polsku)\n" +
      "4. \"reasoning\": jedno krotkie zdanie po polsku, wyjasniajace sugerowana akcje.\n\n" +
      "Zwroc TYLKO JSON: {\"suggestions\": [{\"id\": \"...\", \"action\": \"keep|archive|todo\", \"category\": \"Kariera|Zdrowie|...\", \"takeaways\": [\"wniosek1\", \"wniosek2\", \"wniosek3\"], \"reasoning\": \"...\"}]}";

    const { content } = await deepseekChat({
      apiKey,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: linksBlock },
      ],
      model: "deepseek-chat",
      maxTokens: 2000,
      temperature: 0.2,
      responseFormat: { type: "json_object" },
    });

    const parsed = parseJsonFromContent(content);
    if (!parsed) throw new Error("Invalid AI JSON: " + content.slice(0, 200));

    const validIds = new Set((unreadLinks ?? []).map((l) => l.id));
    const rawSuggestions = Array.isArray((parsed as any).suggestions) ? (parsed as any).suggestions : [];
    
    const suggestions = rawSuggestions
      .filter((s: any) => s && validIds.has(s.id) && ACTIONS.has(s.action))
      .map((s: any) => ({
        id: s.id,
        action: s.action,
        category: CATEGORIES.has(s.category) ? s.category : "Inne",
        takeaways: Array.isArray(s.takeaways) ? s.takeaways.map(String).slice(0, 3) : [],
        reasoning: String(s.reasoning || "").slice(0, 300),
      }));

    return new Response(JSON.stringify({ suggestions, totalStale }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: unknown) {
    console.error("[vanguard-keep-triage] error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
