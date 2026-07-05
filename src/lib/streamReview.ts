import { supabase } from './supabase';
import { getDaysAgoWarsaw, warsawDayBoundsISO } from './date';

export interface StreamEntry {
  id: string;
  content: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Telegram-sourced stream entries from the last 7 days — the exact window
 * vanguard-weekly-synthesis reads, so what gets reviewed/corrected here is
 * what the AI synthesis (and any pattern detection) will actually see.
 */
export async function listRecentStreamEntries(userId: string): Promise<StreamEntry[]> {
  const { fromISO } = warsawDayBoundsISO(getDaysAgoWarsaw(7));
  const { data, error } = await supabase
    .from('vanguard_stream')
    .select('id, content, created_at, metadata')
    .eq('user_id', userId)
    .eq('source', 'telegram')
    .gte('created_at', fromISO)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as StreamEntry[]) || [];
}

export async function updateStreamEntryContent(id: string, content: string): Promise<void> {
  const { error } = await supabase.from('vanguard_stream').update({ content }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteStreamEntry(id: string): Promise<void> {
  const { error } = await supabase.from('vanguard_stream').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** True if the entry came from a transcribed Telegram voice note (see interceptors.ts's TranscriptionInterceptor). */
export function isVoiceEntry(entry: StreamEntry): boolean {
  const meta = entry.metadata as { voice_duration_seconds?: number; emotion?: { from_voice?: boolean } } | null;
  return !!(meta?.voice_duration_seconds || meta?.emotion?.from_voice);
}
