import { safeSendTelegram } from "../_utils/helpers.ts";
import { getWarsawDateString } from "../../_shared/time.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";
import { LLM_TASKS } from "../../_shared/llm/tasks.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../_utils/constants.ts";
import { fetchWorldState } from "../../_shared/worldState.ts";
import { sendChatAction } from "../../_shared/telegram.ts";

type TodoPriority = 'urgent' | 'high' | 'normal' | 'low';

function normalizePriority(value: unknown): TodoPriority {
  if (value === 'medium') return 'normal';
  return value === 'urgent' || value === 'high' || value === 'normal' || value === 'low'
    ? value
    : 'normal';
}

function deterministicTodoParse(raw: string, todayStr: string): {
  title: string;
  due_date: string | null;
  due_time: string | null;
  priority: TodoPriority;
  notes: string;
} | null {
  let text = raw.trim();
  if (!text) return null;

  // If contains words like "jeśli", "jeżeli", "zanim", "przed", "po", "gdy", "kiedy", "chyba że", "ale" -> fall back to LLM
  if (/\b(jeśli|jeżeli|zanim|przed|po|gdy|kiedy|chyba|ale|wcześniej|pozniej|później|potem|wtedy)\b/i.test(text)) {
    return null;
  }

  let priority: TodoPriority = 'normal';
  let dueDate: string | null = null;
  let dueTime: string | null = null;
  let notes = '';

  // 1. Priority parsing
  const p1Regex = /\b(p1|!high|pilne)\b/i;
  const p2Regex = /\b(p2)\b/i;
  const p3Regex = /\b(p3)\b/i;
  const p4Regex = /\b(p4|!low|niski)\b/i;

  if (p1Regex.test(text)) {
    priority = 'urgent';
    text = text.replace(p1Regex, '');
  } else if (p2Regex.test(text)) {
    priority = 'high';
    text = text.replace(p2Regex, '');
  } else if (p3Regex.test(text)) {
    priority = 'normal';
    text = text.replace(p3Regex, '');
  } else if (p4Regex.test(text)) {
    priority = 'low';
    text = text.replace(p4Regex, '');
  }

  // 2. Date helper
  const getNextDayOfWeek = (dayIndex: number): string => {
    const today = new Date(todayStr + 'T12:00:00Z');
    let diff = dayIndex - today.getUTCDay();
    if (diff <= 0) diff += 7;
    today.setUTCDate(today.getUTCDate() + diff);
    return today.toISOString().split('T')[0];
  };

  const tomorrowStr = (() => {
    const d = new Date(todayStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  const pojutrzeStr = (() => {
    const d = new Date(todayStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 2);
    return d.toISOString().split('T')[0];
  })();

  // 3. Match relative dates and expressions
  // "za N minut/godzin/dni"
  const relativeRegex = /\bza\s+(\d+)\s*(minut|min|godzin|h|dni|dniach|dni)\b/i;
  const relMatch = text.match(relativeRegex);
  if (relMatch) {
    const num = parseInt(relMatch[1], 10);
    const unit = relMatch[2].toLowerCase();
    const d = new Date();
    if (unit.startsWith('min')) {
      d.setMinutes(d.getMinutes() + num);
    } else if (unit.startsWith('godz') || unit === 'h') {
      d.setHours(d.getHours() + num);
    } else if (unit.startsWith('dn')) {
      d.setDate(d.getDate() + num);
    }
    const warsawStr = d.toLocaleString('sv', { timeZone: 'Europe/Warsaw' });
    dueDate = warsawStr.split(' ')[0];
    dueTime = warsawStr.split(' ')[1].substring(0, 5);
    text = text.replace(relativeRegex, '');
  }

  // "dziś", "dzisiaj", "dzis"
  const todayRegex = /\b(dziś|dzisiaj|dzis)\b/i;
  if (todayRegex.test(text)) {
    dueDate = todayStr;
    text = text.replace(todayRegex, '');
  }

  // "jutro"
  const tomorrowRegex = /\bjutro\b/i;
  if (tomorrowRegex.test(text)) {
    dueDate = tomorrowStr;
    text = text.replace(tomorrowRegex, '');
  }

  // "pojutrze"
  const pojutrzeRegex = /\bpojutrze\b/i;
  if (pojutrzeRegex.test(text)) {
    dueDate = pojutrzeStr;
    text = text.replace(pojutrzeRegex, '');
  }

  // Days of week
  const daysMap: Record<string, number> = {
    'niedziel': 0, 'niedziela': 0, 'niedzielę': 0, 'niedziele': 0,
    'poniedzia': 1, 'poniedziałek': 1, 'poniedzialek': 1,
    'wtorek': 2, 'wtore': 2,
    'środa': 3, 'sroda': 3, 'środę': 3,
    'czwartek': 4, 'czwarte': 4,
    'piątek': 5, 'piatek': 5, 'piąt': 5,
    'sobota': 6, 'sobotę': 6, 'sobot': 6,
  };
  for (const [key, val] of Object.entries(daysMap)) {
    const dayRegex = new RegExp(`\\bw\\s+${key}\\w*\\b|\\b${key}\\w*\\b`, 'i');
    if (dayRegex.test(text)) {
      dueDate = getNextDayOfWeek(val);
      text = text.replace(dayRegex, '');
      break;
    }
  }

  // 4. Time parsing: "o 12", "o 12:30", "12:30"
  const timeRegex = /\b(o\s+)?(\d{1,2}):(\d{2})\b/i;
  const timeMatch = text.match(timeRegex);
  if (timeMatch) {
    const hr = timeMatch[2].padStart(2, '0');
    const min = timeMatch[3];
    dueTime = `${hr}:${min}`;
    text = text.replace(timeRegex, '');
  } else {
    const simpleTimeRegex = /\bo\s+(\d{1,2})\b/i;
    const simpleTimeMatch = text.match(simpleTimeRegex);
    if (simpleTimeMatch) {
      const hr = simpleTimeMatch[1].padStart(2, '0');
      dueTime = `${hr}:00`;
      text = text.replace(simpleTimeRegex, '');
    }
  }

  text = text.replace(/\+/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  return {
    title: text,
    due_date: dueDate,
    due_time: dueTime,
    priority,
    notes,
  };
}

export async function handleTodoCommand(
  text: string,
  chatId: number,
  telegramToken: string,
  supabase: any,
  vanguardUserId: string,
  deepseekApiKey = '',
  inboxRecordId?: string,
): Promise<void> {
  try {
    const raw = text.replace(/^\/todo\s*/i, '').trim();
    if (!raw) {
      await safeSendTelegram(chatId, '! Podaj treść zadania.', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
      return;
    }

    await sendChatAction(telegramToken, chatId, "typing", { direct: true });

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
    let priority: TodoPriority = 'normal';
    let notes = '';

    const deterministicResult = deterministicTodoParse(raw, todayStr);
    if (deterministicResult) {
      title = deterministicResult.title;
      dueDate = deterministicResult.due_date;
      dueTime = deterministicResult.due_time;
      priority = deterministicResult.priority;
      notes = deterministicResult.notes;
    } else {
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
- hours np. "o 14", "15:30" -> due_time = "14:00" lub "15:30"
- priorities np. "pilne", "ASAP", "na wczoraj", exclamation marks "!" -> priority = "urgent"
- priorities np. "kiedyś", "low", "niski" -> priority = "low"

Wymagany format wyjściowy JSON:
{
  "title": "oczyszczony tytuł zadania (bez słów kluczowych dat/godzin/priorytetów, np. 'kupić mleko')",
  "due_date": "RRRR-MM-DD lub null",
  "due_time": "GG:MM lub null",
  "priority": "urgent | high | normal | low",
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
          priority = normalizePriority(parsed.priority);
          notes = (parsed.notes as string) || '';
        }
      }
    }

    const scheduledTime = dueDate && dueTime
      ? `${dueDate}T${dueTime}:00${warsawOffsetForDate(dueDate)}`
      : null;
    const { data: inserted, error } = await supabase.from('todo_items').insert({
      user_id: vanguardUserId,
      title,
      status: 'open',
      priority,
      due_date: dueDate,
      scheduled_time: scheduledTime,
      reminder_at: scheduledTime,
      reminder_sent: false,
      notes,
      tags: ['telegram', ...(scheduledTime ? ['reminder'] : [])],
    }).select('id').single();
    if (error) throw error;

    fetchWorldState(supabase, vanguardUserId, todayStr, undefined, true).catch((e) => {
      console.error("[telegram] fetchWorldState forceRefresh failed:", e);
    });

    const contextParts: string[] = [];
    if (dueDate) {
      if (dueDate === todayStr) {
        contextParts.push("Dzisiaj");
      } else if (dueDate === tomorrowStr) {
        contextParts.push("Jutro");
      } else {
        contextParts.push(dueDate);
      }
    }
    if (dueTime) {
      contextParts.push(dueTime);
    }
    if (priority && priority !== 'normal') {
      const prioLbl: Record<TodoPriority, string> = {
        urgent: '🔴 pilne', high: '🟠 wysoki priorytet', normal: '', low: '⬇️ niski priorytet'
      };
      contextParts.push(prioLbl[priority]);
    }
    const contextLine = contextParts.join(' · ');

    const messageText = `✓ Dodano zadanie\n\n${title}${contextLine ? `\n${contextLine}` : ''}`;

    await safeSendTelegram(chatId, messageText, telegramToken, {
      reply_markup: {
        inline_keyboard: [[{ text: 'Cofnij', callback_data: `todo_undo:${inserted.id}` }]],
      },
    });
  } catch (err) {
    console.error('[commands] /todo failed:', err);
    
    const inlineKeyboard = inboxRecordId ? [[
      { text: 'Spróbuj ponownie', callback_data: `retry_inbox:${inboxRecordId}` },
      { text: 'Zapisz jako notatkę', callback_data: `save_as_note:${inboxRecordId}` }
    ]] : undefined;

    await safeSendTelegram(chatId, '! Nie udało się zapisać zadania.', telegramToken, {
      reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined
    });
  }
}

function warsawOffsetForDate(date: string): string {
  const probe = new Date(`${date}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Warsaw',
    timeZoneName: 'longOffset',
  }).formatToParts(probe).find((part) => part.type === 'timeZoneName')?.value.replace('GMT', '') || '+01:00';
  if (offset.includes(':')) return offset;
  return `${offset[0]}${offset.slice(1).padStart(2, '0')}:00`;
}
