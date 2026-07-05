import { corsHeaders, resolveUserScope } from "../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";

const SYSTEM = `Jestes asystentem Jakuba. Dostajesz dowolny wklejony tekst (notatki ze spotkania, e-mail, plan, luzne mysli) i wyciagasz z niego KONKRETNE, WYKONALNE zadania do zrobienia.

Zasady:
- Kazde zadanie to jedna konkretna akcja (czasownik + obiekt), maks 12 slow
- Ignoruj zdania ktore nie sa zadaniami (opisy, kontekst, pytania retoryczne)
- Jesli w tekscie jest jasna data dla zadania, ustaw due_date (YYYY-MM-DD, Warsaw TZ, dzisiaj = {{TODAY}})
- Jesli brak daty, due_date = null
- Priorytet ustaw tylko gdy tekst jednoznacznie sugeruje pilnosc: "urgent" (blokuje/deadline dzisiaj), "high" (wazne w tym tygodniu), w innym wypadku null
- Maksymalnie 20 zadan
- Jezyk polski

Odpowiedz WYLACZNIE poprawnym JSON: { "tasks": [{ "title": string, "due_date": string|null, "priority": string|null }] }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { text, userId: requestedUserId } = body;
    const { userId } = await resolveUserScope(req, requestedUserId ?? null);

    if (!userId || !text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const apiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";
    const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
    const system = SYSTEM.replace("{{TODAY}}", todayIso);

    const result = await deepseekChat({
      apiKey,
      messages: [
        { role: "system", content: system },
        { role: "user", content: text.slice(0, 6000) },
      ],
      maxTokens: 1500,
      temperature: 0.2,
      responseFormat: { type: "json_object" },
    });

    const parsed = parseJsonFromContent(result.content) || {};
    const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const tasks = rawTasks
      .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
      .map((t) => ({
        title: typeof t.title === "string" ? t.title.trim() : "",
        due_date: typeof t.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : null,
        priority: typeof t.priority === "string" && ["urgent", "high", "normal", "low"].includes(t.priority) ? t.priority : null,
      }))
      .filter((t) => t.title.length > 0)
      .slice(0, 20);

    return new Response(JSON.stringify({ tasks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[todo-extract]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
