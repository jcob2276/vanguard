import { resolveUserScope } from "../../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";
import { LLM_TASKS } from "../../_shared/llm/tasks.ts";
import { getWarsawDateString } from "../../_shared/time.ts";
import { TODO_EXTRACT_SYSTEM } from "../prompts.ts";

export async function handleTodoExtract(req: Request, body: any): Promise<unknown> {
  const { text, userId: requestedUserId } = body;
  const { userId } = await resolveUserScope(req, requestedUserId ?? null);

  if (!userId || !text || typeof text !== "string" || !text.trim()) {
    throw new Error("missing fields");
  }

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";
  const todayIso = getWarsawDateString();
  const system = TODO_EXTRACT_SYSTEM.replace("{{TODAY}}", todayIso);

  const result = await deepseekChat({
    apiKey,
    ...LLM_TASKS.structured,
    messages: [
      { role: "system", content: system },
      { role: "user", content: text.slice(0, 6000) },
    ],
    maxTokens: 1500,
    temperature: 0.2,
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

  return { tasks };
}
