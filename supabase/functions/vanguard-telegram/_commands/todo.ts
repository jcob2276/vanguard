import { safeSendTelegram } from "../_utils/helpers.ts";
import { getWarsawDateString } from "../../_shared/time.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../_utils/constants.ts";

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
    let priority = 'normal';

    if (deepseekApiKey) {
      try {
        const res = await deepseekChat({
          apiKey: deepseekApiKey,
          model: 'deepseek-chat',
          temperature: 0,
          maxTokens: 120,
          responseFormat: { type: 'json_object' },
          messages: [{
            role: 'user',
            content: `Dzisiaj: ${todayStr} (${dayName}). Sparsuj polskie zadanie i wyciągnij: czysty tytuł, datę i czas wykonania, priorytet.

Zasady:
- "jutro" → ${tomorrowStr}
- "pojutrze" → +2 dni
- "w poniedziałek/wtorek/środę/czwartek/piątek/sobotę/niedzielę" → najbliższy taki dzień
- "za tydzień" → +7 dni
- "za dwa tygodnie" / "za 2 tygodnie" → +14 dni
- "za miesiąc" → +30 dni
- "w weekend" → najbliższa sobota
- "p1" lub "pilne" lub "!high" → priority: high
- "p2" → priority: normal
- "p3" lub "!low" → priority: low
- czas: "o 14", "o 14:00", "14:00", "rano"→09:00, "wieczorem"→20:00, "w południe"→12:00
- usuń z tytułu wszystkie znalezione daty/czasy/priorytety, zostaw tylko treść zadania

Odpowiedz TYLKO JSON (bez markdown):
{"title":"<treść zadania>","due_date":"YYYY-MM-DD lub null","due_time":"HH:MM lub null","priority":"normal|high|low"}

Tekst: "${raw}"`
          }]
        });

        const parsed: any = parseJsonFromContent(res.content || '{}') || {};
        if (parsed.title) title = parsed.title;
        if (parsed.due_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.due_date)) dueDate = parsed.due_date;
        if (parsed.due_time && /^\d{2}:\d{2}$/.test(parsed.due_time)) dueTime = parsed.due_time;
        if (['high', 'normal', 'low'].includes(parsed.priority)) priority = parsed.priority;
      } catch (parseErr) {
        console.warn('[todo] DeepSeek parse failed, using raw text:', parseErr);
      }
    }

    const notes = dueTime ? `⏰ ${dueTime}` : null;

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

    const duePart = dueDate ? ` · ${dueDate}${dueTime ? ` ${dueTime}` : ''}` : '';
    const prioPart = priority === 'high' ? ' · 🔴' : priority === 'low' ? ' · ⬇️' : '';
    await safeSendTelegram(chatId, `✅ "${title}"${duePart}${prioPart}`, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  } catch (err) {
    console.error('[commands] /todo failed:', err);
    await safeSendTelegram(chatId, '❌ Błąd zapisu todo: ' + (err as Error).message, telegramToken);
  }
}
