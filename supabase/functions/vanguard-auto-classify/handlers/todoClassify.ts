import { resolveUserScope, corsHeaders } from "../../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";
import { getWarsawDateString } from "../../_shared/time.ts";
import { TODO_CLASSIFY_SYSTEM } from "../prompts.ts";

export async function handleTodoClassify(req: Request, body: any, supabase: any): Promise<Response> {
  const { itemId, userId: requestedUserId, title, notes, due_date, priority } = body;
  const { userId } = await resolveUserScope(req, requestedUserId ?? null);

  if (!itemId || !userId || !title) {
    return new Response(JSON.stringify({ error: "missing fields" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";
  const todayFull = new Date().toLocaleDateString("pl-PL", {
    timeZone: "Europe/Warsaw",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const todayIso = getWarsawDateString();

  const userMsg = [
    `Zadanie: "${title}"`,
    notes ? `Opis: "${notes}"` : null,
    due_date ? `Uzytkownik juz wpisal date: ${due_date} - NIE nadpisuj.` : null,
    priority ? `Uzytkownik juz wpisal priorytet: ${priority} - NIE nadpisuj.` : null,
    `Dzisiaj: ${todayFull} (${todayIso})`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await deepseekChat({
    apiKey,
    model: "deepseek-chat",
    messages: [
      { role: "system", content: TODO_CLASSIFY_SYSTEM },
      { role: "user", content: userMsg },
    ],
    maxTokens: 120,
    temperature: 0,
    responseFormat: { type: "json_object" },
  });

  const classification = parseJsonFromContent(result.content) || {};
  const ai_bucket = (classification.ai_bucket as string) || "later";

  const patch: Record<string, unknown> = {
    ai_bucket,
    ai_classified_at: new Date().toISOString(),
  };
  if (!due_date && classification.due_date) patch.due_date = classification.due_date;
  if (!priority && classification.priority) patch.priority = classification.priority;

  const { error: updateErr } = await supabase
    .from("todo_items")
    .update(patch)
    .eq("id", itemId)
    .eq("user_id", userId);
  if (updateErr) throw new Error(updateErr.message);

  return new Response(JSON.stringify({ ok: true, ...patch }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
