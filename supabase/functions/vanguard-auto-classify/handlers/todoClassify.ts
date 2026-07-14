import { resolveUserScope } from "../../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";
import { LLM_TASKS } from "../../_shared/llm/tasks.ts";
import { getWarsawDateString } from "../../_shared/time.ts";
import { TODO_CLASSIFY_SYSTEM } from "../prompts.ts";

export async function handleTodoClassify(req: Request, body: any, supabase: any): Promise<unknown> {
  const { itemId, userId: requestedUserId, title, notes, due_date, priority } = body;
  const { userId } = await resolveUserScope(req, requestedUserId ?? null);

  if (!itemId || !userId || !title) {
    throw new Error("missing fields");
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
    ...LLM_TASKS.structured,
    messages: [
      { role: "system", content: TODO_CLASSIFY_SYSTEM },
      { role: "user", content: userMsg },
    ],
    maxTokens: 120,
    temperature: 0,
  });

  const classification = parseJsonFromContent(result.content) || {};
  // Wartości z LLM — clamp na słowniki zgodne z CHECK constraintami todo_items
  // (ai_bucket_check, priority_check), inaczej nielegalna wartość wywala cały update.
  const ALLOWED_BUCKETS = ["today", "soon", "later", "future"];
  const ALLOWED_PRIORITIES = ["low", "normal", "high", "urgent"];
  const ai_bucket = ALLOWED_BUCKETS.includes(classification.ai_bucket as string)
    ? (classification.ai_bucket as string)
    : "later";

  const patch: Record<string, unknown> = {
    ai_bucket,
    ai_classified_at: new Date().toISOString(),
  };
  if (!due_date && typeof classification.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(classification.due_date)) {
    patch.due_date = classification.due_date;
  }
  if (!priority && ALLOWED_PRIORITIES.includes(classification.priority as string)) {
    patch.priority = classification.priority;
  }

  const { error: updateErr } = await supabase
    .from("todo_items")
    .update(patch)
    .eq("id", itemId)
    .eq("user_id", userId);
  if (updateErr) throw new Error(updateErr.message);

  return { ok: true, ...patch };
}
