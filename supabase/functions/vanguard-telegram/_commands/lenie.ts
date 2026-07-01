import { safeSendTelegram } from "../_utils/helpers.ts";
import { getWarsawDateString } from "../../_shared/time.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../_utils/constants.ts";

export async function handleLenieCommand(
  text: string,
  chatId: number,
  telegramToken: string,
  supabase: any,
  vanguardUserId: string,
): Promise<void> {
  try {
    const today = getWarsawDateString();
    const rest = text.slice('/lenie'.length).trim();
    const [finalStimulus, contextNote] = rest.includes('|')
      ? rest.split('|').map(s => s.trim())
      : [rest, null];

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

    const streamParts = [`[Nawyk/Lenie] (unikać, ${today})`];
    if (finalStimulus) streamParts.push(`bodziec: ${finalStimulus}`);
    if (contextNote) streamParts.push(`kontekst: ${contextNote}`);
    const { error: streamErr } = await supabase.from('vanguard_stream').insert({
      user_id: vanguardUserId,
      content: streamParts.join(' · '),
      source: 'habit_log',
      category: 'behavior',
      classification: 'habit_log',
      metadata: { habit_name: 'Lenie', is_positive: false, date: today },
    });
    if (streamErr) console.warn('[commands] /lenie stream mirror failed:', streamErr.message);

    const label = finalStimulus ? `"${finalStimulus}"` : 'bez opisu';
    await safeSendTelegram(chatId, `✅ Lenie zapisane (${today})\nBodziec: ${label}${contextNote ? `\nKontekst: ${contextNote}` : ''}`, telegramToken, { reply_markup: DEFAULT_REPLY_KEYBOARD });
  } catch (err) {
    console.error('[commands] /lenie failed:', err);
    await safeSendTelegram(chatId, '❌ Błąd zapisu lenie: ' + (err as Error).message, telegramToken);
  }
}
