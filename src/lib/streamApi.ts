import { supabase } from './supabase';
import type { Json } from './database.types';

export async function appendStreamEntry(input: {
  userId: string;
  source: string;
  content: string;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await supabase.from('vanguard_stream').insert({
    user_id: input.userId,
    source: input.source,
    content: input.content,
    metadata: (input.metadata ?? null) as Json | null,
  });
  if (error) throw error;
}
