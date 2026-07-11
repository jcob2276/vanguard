import { corsHeaders, resolveUserScope } from "../../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";

const TASK_BREAKDOWN_SYSTEM = `Jestes asystentem Jakuba. Dostajesz jedno zadanie i zwracasz liste 3-6 konkretnych podzadan potrzebnych do jego wykonania.

Zasady:
- Podzadania maja byc konkretne i wykonalne (czasownik + obiekt)
- Kazde podzadanie = 1 krok, maks 8 slow
- Kolejnosc logiczna, od pierwszego do ostatniego
- Jezyk polski, naturalny
- NIE powtarzaj tytulu glownego zadania jako podzadania

Odpowiedz WYLACZNIE poprawnym JSON: { "subtasks": ["krok 1", "krok 2", ...] }`;

export async function handleTaskBreakdown(req: Request, body: any): Promise<Response> {
  const { itemId, userId: requestedUserId, title, notes } = body;
  const { userId } = await resolveUserScope(req, requestedUserId ?? null);

  if (!userId || !title) {
    return new Response(JSON.stringify({ error: "missing fields" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";
  const userMsg = [
    `Zadanie: "${title}"`,
    notes ? `Opis: "${notes}"` : null,
  ].filter(Boolean).join("\n");

  const result = await deepseekChat({
    apiKey,
    messages: [
      { role: "system", content: TASK_BREAKDOWN_SYSTEM },
      { role: "user", content: userMsg },
    ],
    maxTokens: 300,
    temperature: 0.3,
    responseFormat: { type: "json_object" },
  });

  const parsed = parseJsonFromContent(result.content) || {};
  const subtasks: string[] = Array.isArray(parsed.subtasks)
    ? (parsed.subtasks as string[]).filter((s) => typeof s === "string" && s.trim().length > 0).slice(0, 8)
    : [];

  return new Response(JSON.stringify({ subtasks }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
