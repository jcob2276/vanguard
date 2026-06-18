import { corsHeaders, resolveUserScope } from "../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { userId: scopeId } = await resolveUserScope(req, body.userId ?? null);
    const userId = scopeId ?? body.userId;
    if (!userId) throw new Error("userId required");

    const apiKey = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");

    const { answers, pillar, userName = "Jakub" } = body as {
      answers: { goal: string; why: string; milestones: string; blockers: string; weekly_actions: string };
      pillar: string;
      userName?: string;
    };

    const systemPrompt = `Jesteś Antigravity — AI asystentem ${userName}. Na podstawie odpowiedzi wygeneruj strukturę projektu jako JSON.

ZASADY:
- project_name: krótka nazwa SYSTEMU (co robisz), nie cel (co chcesz osiągnąć)
- affirmation: 1 zdanie, czas teraźniejszy, "Ja ${userName} mam/jestem/posiadam...", zawiera datę z celu
- kpis: MAKSYMALNIE 2, tylko LEADING indicators (tygodniowe działania które kontrolujesz), NIE wyniki końcowe
- checkpoints: MAKSYMALNIE 4 kamieni milowych chronologicznie, daty YYYY-MM-DD jeśli da się wywnioskować z celu
- Odpowiedz TYLKO JSON, bez markdown`;

    const userPrompt = `Cel: ${answers.goal}
Po co mi to: ${answers.why}
Co musi się stać: ${answers.milestones}
Dlaczego może się nie udać: ${answers.blockers}
Co robię co tydzień: ${answers.weekly_actions}
Filar życiowy: ${pillar}`;

    const { content } = await deepseekChat({
      apiKey,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "deepseek-chat",
      maxTokens: 800,
      temperature: 0.4,
      responseFormat: { type: "json_object" },
    });

    const parsed = parseJsonFromContent(content);
    if (!parsed) throw new Error("Brak JSON w odpowiedzi AI: " + content.slice(0, 200));

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("[vanguard-goal-create] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
