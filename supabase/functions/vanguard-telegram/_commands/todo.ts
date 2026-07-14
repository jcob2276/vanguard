import { safeSendTelegram } from "../_utils/helpers.ts";
import { getWarsawDateString } from "../../_shared/time.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";
import { LLM_TASKS } from "../../_shared/llm/tasks.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../_utils/constants.ts";
import { fetchWorldState } from "../../_shared/worldState.ts";

export async function handleTodoCommand(
  text: string,
  chatId: number,
  telegramToken: string,
  supabase: any,
  vanguardUserId: string,
  deepseekApiKey = '',
): Promise<void> {
  try {
    const raw = text.replace(/^\/todo\s*/i, '').trim();
    if (!raw) {
      await safeSendTelegram(chatId, '❌ Podaj treść zadania.', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
      return;
    }

    const todayStr = getWarsawDateString();
    const dayName = new Date().toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'long' });
    const tomorrowStr = (() => {
      const d = new Date(todayStr + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().split('T')[0];
    })();

    let title = raw;
    let dueDate: string | null = null;
    let dueTime: string | null = null;
    let priority: 'high' | 'medium' | 'low' = 'medium';
    let notes = '';

    const systemPrompt = `Jesteś parserem zadań (TODO) w systemie Vanguard.
Przetwórz wpis użytkownika i zwróć dane w formacie JSON.
Użytkownik pisze w języku polskim.
Dzisiejsza data: ${todayStr} (dzień tygodnia: ${dayName}).
Jutrzejsza data: ${tomorrowStr}.

Zasady parsowania terminów:
- "jutro" -> due_date = jutrzejsza data
- "dziś", "dzisiaj" -> due_date = dzisiejsza data
- "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela" -> due_date = najbliższy dany dzień tygodnia
- "za tydzień" -> due_date = dzisiejsza data + 7 dni
- godziny np. "o 14", "15:30" -> due_time = "14:00" lub "15:30"
- priorytety np. "pilne", "ASAP", "na wczoraj", wykrzykniki "!" -> priority = "high"
- priorytety np. "kiedyś", "low", "niski" -> priority = "low"

Wymagany format wyjściowy JSON:
{
  "title": "oczyszczony tytuł zadania (bez słów kluczowych dat/godzin/priorytetów, np. 'kupić mleko')",
  "due_date": "RRRR-MM-DD lub null",
  "due_time": "GG:MM lub null",
  "priority": "high | medium | low",
  "notes": "wszelkie dodatkowe uwagi lub kontekst"
}

Zwróć TYLKO czysty obiekt JSON.`;

    const chatRes = await deepseekChat({
      apiKey: deepseekApiKey,
      ...LLM_TASKS.structured,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: raw }
      ],
      temperature: 0.0,
    }).catch((e) => {
      console.error('[commands] LLM parse failed, falling back to raw:', e);
      return null;
    });

    if (chatRes) {
      const parsed = parseJsonFromContent(chatRes.content);
      if (parsed) {
        title = (parsed.title as string) || title;
        dueDate = (parsed.due_date as string) || null;
        dueTime = (parsed.due_time as string) || null;
        priority = (parsed.priority as 'high' | 'medium' | 'low') || 'medium';
        notes = (parsed.notes as string) || '';
      }
    }

    const { error } = await supabase.from('todo_items').insert({
      user_id: vanguardUserId,
      title,
      status: 'open',
      priority,
      due_date: dueDate,
      notes,
      tags: ['telegram'],
    });
    if (error) throw error;

    // Invalidate world state cache asynchronously
    fetchWorldState(supabase, vanguardUserId, todayStr, undefined, true).catch((e) => {
      console.error("[telegram] fetchWorldState forceRefresh failed:", e);
    });

    const duePart = dueDate ? ` · ${dueDate}${dueTime ? ` ${dueTime}` : ''}` : '';
    const prioPart = priority === 'high' ? ' · 🔴' : priority === 'low' ? ' · ⬇️' : '';
    await safeSendTelegram(chatId, `✅ "${title}"${duePart}${prioPart}`, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  } catch (err) {
    console.error('[commands] /todo failed:', err);
    await safeSendTelegram(chatId, '❌ Błąd zapisu todo: ' + (err as Error).message, telegramToken);
  }
}
