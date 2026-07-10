import { supabase } from '../supabase';
import { getTodayWarsaw } from '../date';

/** Lekki mirror do vanguard_stream — ten sam fakt co habit_logs, bez duplikowania tabeli. */
export async function mirrorHabitLogToStream(
  userId: string,
  habit: { name: string; is_positive?: boolean | null },
  opts: {
    completed: boolean;
    final_stimulus?: string | null;
    context_note?: string | null;
    date?: string;
  },
): Promise<void> {
  if (!opts.completed) return;

  const date = opts.date ?? getTodayWarsaw();
  const kind = habit.is_positive === false ? 'unikać' : 'wzmacniać';
  const parts = [`[Nawyk/${habit.name}] (${kind}, ${date})`];
  if (opts.final_stimulus?.trim()) parts.push(`bodziec: ${opts.final_stimulus.trim()}`);
  if (opts.context_note?.trim()) parts.push(`kontekst: ${opts.context_note.trim()}`);

  const { error } = await supabase.from('vanguard_stream').insert({
    user_id: userId,
    content: parts.join(' · '),
    source: 'habit_log',
    category: habit.is_positive === false ? 'behavior' : 'habit',
    classification: 'habit_log',
    metadata: {
      habit_name: habit.name,
      is_positive: habit.is_positive !== false,
      date,
    },
  });
  if (error) throw error;
}
