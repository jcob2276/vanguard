import { safeSendTelegram } from "../_utils/helpers.ts";
import { getWarsawDateString } from "../../_shared/time.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../_utils/constants.ts";
import { fetchWorldState } from "../../_shared/worldState.ts";
import { insertStreamRecord } from "../../_shared/repos/streamRepo.ts";

export async function handleLenieCommand(
  text: string,
  chatId: number,
  telegramToken: string,
  supabase: any,
  vanguardUserId: string,
): Promise<void> {
  try {
    const raw = text.replace(/^\/lenie\s*/i, '').trim();
    const parts = raw ? raw.split('|').map(p => p.trim()) : [];
    const stimulus = parts[0] || '';
    const contextNote = parts[1] || '';

    const today = getWarsawDateString();

    // 1. Get or create habit "Lenie"
    let { data: habit, error: habitErr } = await supabase
      .from('habits')
      .select('id')
      .eq('user_id', vanguardUserId)
      .eq('name', 'Lenie')
      .maybeSingle();

    if (habitErr) throw habitErr;

    if (!habit) {
      const { data: newHabit, error: hErr } = await supabase
        .from('habits')
        .insert({ user_id: vanguardUserId, name: 'Lenie', icon: '😒', is_positive: false })
        .select('id')
        .single();
      if (hErr) throw hErr;
      habit = newHabit;
    }

    // 2. Check if there's already a log for today
    const { data: existing, error: findErr } = await supabase
      .from('habit_logs')
      .select('id, final_stimulus, context_note')
      .eq('user_id', vanguardUserId)
      .eq('habit_id', habit.id)
      .eq('date', today)
      .maybeSingle();

    if (findErr) throw findErr;

    let nextStimulus = stimulus;
    let nextContext = contextNote;

    if (existing) {
      const prevStimuli = existing.final_stimulus ? [existing.final_stimulus] : [];
      const newStimuli = [...prevStimuli];
      if (stimulus) newStimuli.push(stimulus);
      nextStimulus = newStimuli.join(' + ');

      const prevContext = existing.context_note ? [existing.context_note] : [];
      const newContexts = [...prevContext];
      if (contextNote) newContexts.push(contextNote);
      nextContext = newContexts.join(' · ');

      const { error: updateErr } = await supabase
        .from('habit_logs')
        .update({
          completed: true,
          final_stimulus: nextStimulus || null,
          context_note: nextContext || null,
          logged_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase
        .from('habit_logs')
        .insert({
          user_id: vanguardUserId,
          habit_id: habit.id,
          date: today,
          completed: true,
          final_stimulus: stimulus || null,
          context_note: contextNote || null,
          logged_at: new Date().toISOString(),
        });
      if (insertErr) throw insertErr;
    }

    // Mirror to vanguard_stream
    const count = nextStimulus ? nextStimulus.split(' + ').length : 1;
    const streamParts = [`[LOG NAWYKU] Lenie x${count}`];
    if (nextStimulus) streamParts.push(`Bodziec: ${nextStimulus}`);
    if (nextContext) streamParts.push(`Kontekst: ${nextContext}`);

    try {
      await insertStreamRecord(supabase, {
        user_id: vanguardUserId,
        content: streamParts.join(' · '),
        source: 'habit_log',
        category: 'behavior',
        classification: 'habit_log',
        metadata: { habit_name: 'Lenie', is_positive: false, date: today },
      });
    } catch (streamErr) {
      console.warn('[commands] /lenie stream mirror failed:', (streamErr as Error).message);
    }

    // Invalidate world state cache
    fetchWorldState(supabase, vanguardUserId, today, undefined, true).catch((e) => {
      console.error("[telegram] fetchWorldState forceRefresh failed:", e);
    });

    const label = stimulus ? `"${stimulus}"` : 'bez opisu';
    const totalLabel = nextStimulus && nextStimulus !== stimulus ? ` (razem dzisiaj: "${nextStimulus}")` : '';
    await safeSendTelegram(chatId, `✅ Lenie zapisane (${today})\nBodziec: ${label}${totalLabel}${contextNote ? `\nKontekst: ${contextNote}` : ''}`, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  } catch (err) {
    console.error('[commands] /lenie failed:', err);
    await safeSendTelegram(chatId, '! Nie udało się zapisać lenie.', telegramToken);
  }
}
