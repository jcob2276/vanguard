import { safeSendTelegram } from "../_utils/helpers.ts";
import { getWarsawDateString } from "../../_shared/time.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../_utils/constants.ts";
import { fetchWorldState } from "../../_shared/worldState.ts";

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
    
    // Check if there's already a log for today
    const { data: existing } = await supabase.from('habit_logs')
      .select('id, metadata')
      .eq('user_id', vanguardUserId)
      .eq('habit_name', 'Lenie')
      .eq('date', today)
      .maybeSingle();

    let finalStimulus = stimulus;
    if (existing) {
      const prevMeta = existing.metadata || {};
      const prevStimuli = Array.isArray(prevMeta.stimuli) ? prevMeta.stimuli : (prevMeta.stimulus ? [prevMeta.stimulus] : []);
      const newStimuli = [...prevStimuli];
      if (stimulus) newStimuli.push(stimulus);

      const count = (prevMeta.count || 1) + 1;
      await supabase.from('habit_logs').update({
        metadata: { ...prevMeta, count, stimuli: newStimuli, last_stimulus: stimulus }
      }).eq('id', existing.id);
      finalStimulus = newStimuli.join(' + ');
    } else {
      await supabase.from('habit_logs').insert({
        user_id: vanguardUserId,
        habit_name: 'Lenie',
        date: today,
        value_number: 1,
        metadata: { count: 1, stimuli: stimulus ? [stimulus] : [], last_stimulus: stimulus }
      });
    }

    // Mirror to vanguard_stream
    const streamParts = [`[LOG NAWYKU] Lenie x${existing ? (existing.metadata?.count || 1) + 1 : 1}`];
    if (finalStimulus) streamParts.push(`Bodziec: ${finalStimulus}`);
    if (contextNote) streamParts.push(`Kontekst: ${contextNote}`);

    const { error: streamErr } = await supabase.from('vanguard_stream').insert({
      user_id: vanguardUserId,
      content: streamParts.join(' · '),
      source: 'habit_log',
      category: 'behavior',
      classification: 'habit_log',
      metadata: { habit_name: 'Lenie', is_positive: false, date: today },
    });
    if (streamErr) console.warn('[commands] /lenie stream mirror failed:', streamErr.message);

    // Invalidate world state cache
    fetchWorldState(supabase, vanguardUserId, today, undefined, true).catch((e) => {
      console.error("[telegram] fetchWorldState forceRefresh failed:", e);
    });

    const label = finalStimulus ? `"${finalStimulus}"` : 'bez opisu';
    await safeSendTelegram(chatId, `✅ Lenie zapisane (${today})\nBodziec: ${label}${contextNote ? `\nKontekst: ${contextNote}` : ''}`, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  } catch (err) {
    console.error('[commands] /lenie failed:', err);
    await safeSendTelegram(chatId, '❌ Błąd zapisu lenie: ' + (err as Error).message, telegramToken);
  }
}
