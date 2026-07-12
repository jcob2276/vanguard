import { resolveUserScope } from "../../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";

export async function handleGoalCreate(req: Request, body: any): Promise<unknown> {
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
- checkpoints: MAKSYMALNIE 4 kamieni milowych ŚCIŚLE chronologicznie (od najwcześniejszego do najpóźniejszego)
  * Każdy checkpoint MUSI mieć datę wcześniejszą niż następny
  * Ostatni checkpoint = data osiągnięcia celu głównego
  * Pośrednie checkpointy = etapy NA DRODZE do celu, PRZED datą celu
  * NIE dodawaj etapów po dacie celu
- Odpowiedz TYLKO JSON, bez markdown

WYMAGANY SCHEMAT JSON (użyj dokładnie tych kluczy):
{
  "project_name": "string",
  "affirmation": "string",
  "kpis": [
    { "name": "string", "unit": "string", "target": number_or_null }
  ],
  "checkpoints": [
    { "title": "string", "due_date": "YYYY-MM-DD" }
  ]
}`;

  const today = new Date().toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: 'numeric' });
  const userPrompt = `Dzisiaj jest: ${today}
Cel: ${answers.goal}
Po co mi to: ${answers.why}
Co musi się stać: ${answers.milestones}
Dlaczego może się nie udać: ${answers.blockers}
Co robię co tydzień: ${answers.weekly_actions}
Filar życiowy: ${pillar}

WAŻNE: Checkpointy muszą być w kolejności rosnącej dat. Żaden checkpoint nie może mieć daty późniejszej niż data celu z pola "Cel". Sprawdź każdą datę przed wygenerowaniem.`;

  const { content } = await deepseekChat({
    apiKey,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    model: "deepseek-v4-flash",
    maxTokens: 800,
    temperature: 0.4,
    responseFormat: { type: "json_object" },
  });

  const parsed = parseJsonFromContent(content);
  if (!parsed) throw new Error("Brak JSON w odpowiedzi AI: " + content.slice(0, 200));

  return parsed;
}
