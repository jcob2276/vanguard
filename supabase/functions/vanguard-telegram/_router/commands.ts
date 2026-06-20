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
      { text: "🍽️ Dieta" }
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
    const res = await fetch(`${supabaseUrl}/functions/v1/vanguard-daily-reconciliation?manual=true`, {
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
    const res = await fetch(`${supabaseUrl}/functions/v1/vanguard-eval-interview`, {
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
    // Refresh today's Yazio first so "zjedzone / zostało" reflects what you ate so far.
    await fetch(`${supabaseUrl}/functions/v1/sync-yazio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
        'apikey': supabaseServiceRoleKey
      },
      body: JSON.stringify({ userId: vanguardUserId, days: 1 })
    }).catch((e) => console.error('[commands] /dieta yazio presync failed:', e));

    const res = await fetch(`${supabaseUrl}/functions/v1/vanguard-nutrition-coach`, {
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

  if (lowerText === '📒 keep' || lowerText === '/keep') {
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
): Promise<void> {
  try {
    let title = text.replace(/^\/todo\s*/i, '').trim();

    // Parse flags
    let dueDate: string | null = null;
    let priority = 'normal';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (/\+jutro/i.test(title)) {
      const d = new Date(today); d.setDate(d.getDate() + 1);
      dueDate = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
      title = title.replace(/\+jutro/gi, '').trim();
    } else if (/\+tydzień|\+tydzien/i.test(title)) {
      const d = new Date(today); d.setDate(d.getDate() + 7);
      dueDate = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
      title = title.replace(/\+tydzień|\+tydzien/gi, '').trim();
    }

    if (/!high/i.test(title)) {
      priority = 'high';
      title = title.replace(/!high/gi, '').trim();
    }

    title = title.replace(/\s{2,}/g, ' ').trim();
    if (!title) {
      await safeSendTelegram(chatId, '❌ Podaj treść zadania.', telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
      return;
    }

    const { error } = await supabase.from('todo_items').insert({
      user_id: vanguardUserId,
      title,
      status: 'open',
      priority,
      due_date: dueDate,
      tags: ['telegram'],
    });
    if (error) throw error;

    const duePart = dueDate ? ` · termin ${dueDate}` : '';
    const prioPart = priority === 'high' ? ' · 🔴 high' : '';
    await safeSendTelegram(chatId, `✅ Todo: "${title}"${duePart}${prioPart}`, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
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
    let { data: habit } = await supabase
      .from('habits')
      .select('id')
      .eq('user_id', vanguardUserId)
      .ilike('name', '%lenie%')
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
