import { createServiceClient } from './supabase.ts';

/**
 * Atomically reserve a fact_id in vanguard_stream with status='processing'.
 * Oracle uses this to coordinate parallel sub-tasks sharing the same ID.
 */
export async function mintRecordFactId(userId: string): Promise<string> {
  const supabase = createServiceClient();
  const factId = crypto.randomUUID();

  await supabase.from('vanguard_stream').insert({
    id: factId,
    user_id: userId,
    content: '',
    source: 'oracle_mint',
    status: 'processing',
    date_text: new Date().toISOString().substring(0, 10),
  });

  return factId;
}
