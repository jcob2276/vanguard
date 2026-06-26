/**
 * Self-contained Telegram slash-command handlers.
 *
 * Each of these takes its inputs, sends its own Telegram reply, and is done -
 * unlike the main stream/oracle flow in messages.ts, none of these need the
 * shared mutable state (mode, cleanText, shouldRespond, etc.) threaded through
 * handleIncomingMessage.
 */

import { sendChatAction } from "../../_shared/telegram.ts";
import { safeSendTelegram } from "../_utils/helpers.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";

export const DEFAULT_REPLY_KEYBOARD = {
  keyboard: [
    [
      { text: "🛋️ Lenie" },
      { text: "❓ Wyrocznia" }
    ],
    [
      { text: "💬 Pytanie" },
      { text: "🔚 Koniec" }
    ],
    [
      { text: "📝 Todo" },
      { text: "📒 Keep" }
    ],
    [
      { text: "🍽️ Dieta" },
      { text: "🍴 Posiłek" }
    ],
    [
      { text: "💊 Suple" }
    ]
  ],
  resize_keyboard: true,
  is_persistent: true
};

export async function handleStartMenuCommand(chatId: number, telegramToken: string): Promise<void> {
  await safeSendTelegram(chatId, "Witaj w Vanguard! Wybierz opcję z menu poniżej lub pisz bezpośrednio do strumienia.", telegramToken, {
    reply_markup: DEFAULT_REPLY_KEYBOARD
  });
}

export async function handleKoniecCommand(
  chatId: number,
  telegramToken: string,
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
): Promise<void> {
  try {
    await sendChatAction(telegramToken, chatId, "typing");
    const res = await fetch(`${supabaseUrl}/functions/v1/vanguard-daily-reconciliation?manual=true`, { signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
        'apikey': supabaseServiceRoleKey
      },
      body: JSON.stringify({ source: 'telegram_command', command: '/koniec' })
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || `HTTP ${res.status}`);
    }

    if (body?.skipped && body?.reason === 'already_used_today') {
      await safeSendTelegram(chatId, 'Wieczorna refleksja byla juz dzisiaj odpalona. Cron 21:30 tez ja pominie.', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
    } else if (!body?.skipped) {
      // Without this, a successful trigger gave zero feedback — user had no way to tell
      // whether /koniec worked until the reflection question itself arrived (or didn't,
      // prompting a duplicate /koniec retry).
      await safeSendTelegram(chatId, '⏳ Wieczorna refleksja odpalona — zaraz dostaniesz pytanie.', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
    }
  } catch (err) {
    console.error('[commands] /koniec reflection trigger failed:', err);
    await safeSendTelegram(chatId, 'Nie udalo sie odpalic wieczornej refleksji: ' + (err as Error).message, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  }
}

export async function handlePytanieCommand(
  chatId: number,
  telegramToken: string,
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
): Promise<void> {
  try {
    await sendChatAction(telegramToken, chatId, "typing");
    const res = await fetch(`${supabaseUrl}/functions/v1/vanguard-eval-interview`, { signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
        'apikey': supabaseServiceRoleKey
      },
      body: JSON.stringify({ manual: true })
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || `HTTP ${res.status}`);
    }

    if (body?.skipped) {
      await safeSendTelegram(chatId, `⚠️ Wywiad pominięty: ${body.reason}`, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
    }
  } catch (err) {
    console.error('[commands] /pytanie trigger failed:', err);
    await safeSendTelegram(chatId, 'Nie udalo sie odpalic wywiadu: ' + (err as Error).message, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  }
}

export async function handleDietaCommand(
  chatId: number,
  telegramToken: string,
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
  vanguardUserId: string,
): Promise<void> {
  try {
    await sendChatAction(telegramToken, chatId, "typing");

    const res = await fetch(`${supabaseUrl}/functions/v1/vanguard-nutrition-coach`, { signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
        'apikey': supabaseServiceRoleKey
      },
      body: JSON.stringify({ userId: vanguardUserId, notify: true })
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || `HTTP ${res.status}`);
    }
    // vanguard-nutrition-coach sends its own "🍽️ Cel na dziś" push when notify:true.
    if (!body?.notified) {
      await safeSendTelegram(chatId, '⚠️ Policzone, ale push się nie wysłał. Spróbuj jeszcze raz.', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
    }
  } catch (err) {
    console.error('[commands] /dieta trigger failed:', err);
    await safeSendTelegram(chatId, 'Nie udało się policzyć diety: ' + (err as Error).message, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  }
}

/**
 * The four "type a prompt for me, ForceReply" buttons. Returns true if `lowerText`
 * matched one of them (and the reply was already sent), false otherwise.
 */
export async function handleInteractivePromptCommand(
  lowerText: string,
  chatId: number,
  telegramToken: string,
): Promise<boolean> {
  if (lowerText === '🛋️ lenie' || lowerText === '/lenie') {
    await safeSendTelegram(chatId, "🛋️ **Zapis Lenie**\nPodaj bodziec i kontekst (np. `scrollowanie | zmęczenie`):", telegramToken, {
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "bodziec | kontekst"
      }
    });
    return true;
  }

  if (lowerText === '❓ wyrocznia') {
    await safeSendTelegram(chatId, "❓ **Zadaj pytanie Wyroczni**\nNapisz swoje pytanie do Vanguard Oracle:", telegramToken, {
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "Twoje pytanie..."
      }
    });
    return true;
  }

  if (lowerText === '📝 todo' || lowerText === '/todo') {
    await safeSendTelegram(chatId, "📝 **Nowe zadanie**\nWpisz co masz do zrobienia (opcjonalnie: `+jutro` `+tydzień` `!high`):", telegramToken, {
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "np. Zadzwoń do Marka +jutro !high"
      }
    });
    return true;
  }

  if (lowerText === '🍴 posiłek' || lowerText === '/posilek' || lowerText === '/posiłek') {
    await safeSendTelegram(chatId, "🍴 **Co zjadłeś?**\nOpisz posiłek (np. `makaron z serkiem tłustym piątnica`):", telegramToken, {
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "np. 2 jajka sadzone i kromka chleba",
      },
    });
    return true;
  }

  if (lowerText === '📒 keep' || lowerText === '/keep' || lowerText === '/notatka') {
    await safeSendTelegram(chatId, "📒 **Vanguard Keep**\nWpisz notatkę lub nagraj głosówkę:", telegramToken, {
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "Twoja notatka..."
      }
    });
    return true;
  }

  return false;
}

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

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const dayName = new Date().toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'long' });
    // Anchor on todayStr (already Warsaw-correct) and step in pure UTC-date-string space —
    // new Date().setDate(new Date().getDate()+1) round-trips through the real "now" instant
    // and back through a Warsaw timeZone conversion, which is off by one day for ~2 hours/year
    // around the DST transitions (verified: 2026-03-28 22:00-23:00Z and 2026-10-24 22:00-23:00Z).
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

export async function handleKeepCommand(
  text: string,
  chatId: number,
  telegramToken: string,
  supabase: any,
  vanguardUserId: string,
  fromVoice = false,
): Promise<void> {
  try {
    const content = text.trim();
    if (!content) {
      await safeSendTelegram(chatId, '❌ Pusta notatka.', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
      return;
    }

    // First line (max 80 chars) as title, rest as content
    const firstLine = content.split('\n')[0].slice(0, 80);
    const tags = fromVoice ? ['telegram', 'voice'] : ['telegram'];

    const { error } = await supabase.from('vanguard_notes').insert({
      user_id: vanguardUserId,
      title: firstLine,
      content,
      tags,
    });
    if (error) throw error;

    const label = fromVoice ? '🎤 Głosówka zapisana w Keep' : '📒 Notatka zapisana w Keep';
    await safeSendTelegram(chatId, `${label}\n"${firstLine}"`, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  } catch (err) {
    console.error('[commands] /keep failed:', err);
    await safeSendTelegram(chatId, '❌ Błąd zapisu notatki: ' + (err as Error).message, telegramToken);
  }
}

export async function handlePostCommand(
  text: string,
  chatId: number,
  telegramToken: string,
  supabase: any,
  vanguardUserId: string,
): Promise<void> {
  try {
    let dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    let note = text.slice('/post'.length).trim() || null;

    if (note) {
      const firstWord = note.split(/\s+/)[0].toLowerCase();
      if (firstWord === 'wczoraj') {
        const dYesterday = new Date(dateStr);
        dYesterday.setDate(dYesterday.getDate() - 1);
        dateStr = dYesterday.toISOString().split('T')[0];
        note = note.slice('wczoraj'.length).trim() || null;
      } else if (firstWord === 'dzis' || firstWord === 'dziś') {
        note = note.slice(firstWord.length).trim() || null;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(firstWord)) {
        dateStr = firstWord;
        note = note.slice(10).trim() || null;
      }
    }

    const { error } = await supabase.from('fasting_logs').upsert(
      { user_id: vanguardUserId, date: dateStr, note, created_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );
    if (error) throw error;
    await safeSendTelegram(chatId, `🔵 Post zapisany (${dateStr})${note ? `\nOpis: ${note}` : ''}`, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  } catch (err) {
    console.error('[commands] /post failed:', err);
    await safeSendTelegram(chatId, '❌ Błąd zapisu postu: ' + (err as Error).message, telegramToken);
  }
}

function defaultMealTypeWarsaw(): string {
  const hour = Number(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw', hour: '2-digit', hour12: false }));
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Śniadanie',
  lunch: 'Obiad',
  dinner: 'Kolacja',
  snack: 'Przekąska',
};


async function callParseFoodNl(
  rawText: string,
  userId: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<Array<{ name: string; grams: number; calories: number; protein: number; carbs: number | null; fat: number | null; fiber?: number | null; sugar?: number | null }>> {
  const res = await fetch(`${supabaseUrl}/functions/v1/parse-food-nl`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: rawText, userId }),
    signal: AbortSignal.timeout(35000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `parse-food-nl HTTP ${res.status}`);
  }
  const body = await res.json();
  return Array.isArray(body.items) ? body.items : [];
}

export async function handlePosilekCommand(
  text: string,
  chatId: number,
  telegramToken: string,
  supabase: any,
  vanguardUserId: string,
  deepseekApiKey: string,
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
): Promise<void> {
  try {
    const raw = text.replace(/^\/posilek\s*/i, '').trim();
    if (!raw) {
      await safeSendTelegram(chatId, '❌ Napisz co zjadłeś, np. "/posilek makaron z serkiem tłustym piątnica".', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
      return;
    }

    await sendChatAction(telegramToken, chatId, 'typing');

    const items = await callParseFoodNl(raw, vanguardUserId, supabaseUrl, supabaseServiceRoleKey);
    if (items.length === 0) {
      await safeSendTelegram(chatId, '❌ Nie udało się rozpoznać posiłku, spróbuj opisać inaczej.', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
      return;
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const mealType = defaultMealTypeWarsaw();
    const mealGroupId = items.length > 1 ? crypto.randomUUID() : null;

    const logged: { name: string; grams: number; calories: number }[] = [];
    for (const item of items) {
      const scale100 = item.grams > 0 ? 100 / item.grams : 1;
      const { error } = await supabase.rpc('add_food_entry', {
        p_user_id: vanguardUserId,
        p_date: today,
        p_grams: item.grams,
        p_entry: {
          name: item.name,
          brand: null,
          barcode: null,
          calories: Math.round(item.calories * scale100),
          protein: Math.round(item.protein * scale100 * 10) / 10,
          carbs: item.carbs != null ? Math.round(item.carbs * scale100 * 10) / 10 : null,
          fat: item.fat != null ? Math.round(item.fat * scale100 * 10) / 10 : null,
          fiber: item.fiber != null ? Math.round(Number(item.fiber) * scale100 * 10) / 10 : null,
          sugar: item.sugar != null ? Math.round(Number(item.sugar) * scale100 * 10) / 10 : null,
          meal_type: mealType,
          meal_group_id: mealGroupId,
        },
      });
      if (error) {
        console.error('[posilek] add_food_entry failed for', item.name, error);
        continue;
      }
      logged.push({ name: item.name, grams: item.grams, calories: item.calories });
    }

    if (logged.length === 0) {
      await safeSendTelegram(chatId, '❌ Nie udało się zapisać posiłku.', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
      return;
    }

    const total = logged.reduce((sum, l) => sum + l.calories, 0);
    const lines = logged.map((l) => `• ${l.name} — ${l.grams}g — ${l.calories} kcal`).join('\n');
    await safeSendTelegram(
      chatId,
      `🍽 Zapisano (${MEAL_TYPE_LABELS[mealType]}):\n${lines}\nRazem: ${total} kcal`,
      telegramToken,
      { reply_markup: DEFAULT_REPLY_KEYBOARD },
    );
  } catch (err) {
    console.error('[commands] /posilek failed:', err);
    await safeSendTelegram(chatId, '❌ Błąd zapisu posiłku: ' + (err as Error).message, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  }
}

export async function handleLenieCommand(
  text: string,
  chatId: number,
  telegramToken: string,
  supabase: any,
  vanguardUserId: string,
): Promise<void> {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const rest = text.slice('/lenie'.length).trim();
    // Format: "bodziec | kontekst" or just "opis"
    const [finalStimulus, contextNote] = rest.includes('|')
      ? rest.split('|').map(s => s.trim())
      : [rest, null];

    // Find or create Lenie habit
    // Exact match — ilike('%lenie%') previously also matched a positive habit named e.g.
    // "Nielenie się", logging the negative Lenie entry against the wrong habit (or, with
    // two name matches, silently falling through to maybeSingle()=null and creating a
    // duplicate "Lenie" habit instead of reusing the existing one).
    let { data: habit } = await supabase
      .from('habits')
      .select('id')
      .eq('user_id', vanguardUserId)
      .eq('name', 'Lenie')
      .maybeSingle();

    if (!habit) {
      const { data: newHabit, error: hErr } = await supabase
        .from('habits')
        .insert({ user_id: vanguardUserId, name: 'Lenie', icon: 'L', is_positive: false })
        .select('id').single();
      if (hErr) throw hErr;
      habit = newHabit;
    }

    // Upsert log for today
    const { error: logErr } = await supabase.from('habit_logs').upsert({
      user_id: vanguardUserId,
      habit_id: habit.id,
      date: today,
      completed: true,
      final_stimulus: finalStimulus || null,
      context_note: contextNote || null,
      logged_at: new Date().toISOString(),
    }, { onConflict: 'user_id,habit_id,date' });

    if (logErr) throw logErr;

    const label = finalStimulus ? `"${finalStimulus}"` : 'bez opisu';
    await safeSendTelegram(chatId, `✅ Lenie zapisane (${today})\nBodziec: ${label}${contextNote ? `\nKontekst: ${contextNote}` : ''}`, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  } catch (err) {
    console.error('[commands] /lenie failed:', err);
    await safeSendTelegram(chatId, '❌ Błąd zapisu lenie: ' + (err as Error).message, telegramToken);
  }
}
