import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";

const NOTE_SUMMARY_SYSTEM =
  "Jesteś asystentem Jakuba. Stwórz krótkie, zwięzłe i konkretne podsumowanie podanej notatki (maksymalnie 3-4 zdania). Pisz bezpośrednio, bez wstępów typu 'Oto podsumowanie:'.";

const EXTRACT_TASKS_SYSTEM =
  'Jesteś asystentem Jakuba. Przeanalizuj podaną notatkę i wyekstrahuj z niej listę zadań do wykonania. Zwróć je wyłącznie w formacie JSON jako tablicę stringów w kluczu \'tasks\'. Każde zadanie powinno być konkretne i zaczynać się od czasownika. Przykład: { "tasks": ["Zadzwonić do X", "Napisać raport"] }';

function buildNoteUserMsg(title: string | undefined, content: string | undefined): string {
  return `Tytuł: ${title || "Bez tytułu"}\n\nTreść:\n${content || ""}`;
}

export async function handleNoteSummary(
  user_id: string,
  noteTitle: string | undefined,
  noteContent: string | undefined,
): Promise<Record<string, unknown>> {
  console.log(`[oracle] note_summary for: "${noteTitle}"`);
  const chatRes = await deepseekChat({
    apiKey: Deno.env.get("DEEPSEEK_API_KEY") ?? "",
    model: "deepseek-v4-flash",
    messages: [
      { role: "system", content: NOTE_SUMMARY_SYSTEM },
      { role: "user", content: buildNoteUserMsg(noteTitle, noteContent) },
    ],
    temperature: 0.3,
    userId: user_id,
    feature: "note_summary",
  });
  return { summary: chatRes.content.trim() };
}

export async function handleExtractTasks(
  user_id: string,
  noteTitle: string | undefined,
  noteContent: string | undefined,
): Promise<Record<string, unknown>> {
  console.log(`[oracle] extract_tasks for: "${noteTitle}"`);
  const chatRes = await deepseekChat({
    apiKey: Deno.env.get("DEEPSEEK_API_KEY") ?? "",
    model: "deepseek-chat",
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACT_TASKS_SYSTEM },
      { role: "user", content: buildNoteUserMsg(noteTitle, noteContent) },
    ],
    temperature: 0.1,
    userId: user_id,
    feature: "extract_tasks",
  });
  const parsed = parseJsonFromContent(chatRes.content) || {};
  return { tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] };
}
