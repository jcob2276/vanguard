import { createServiceClient } from './supabase.ts';
import { insertStreamRecord } from './repos/streamRepo.ts';

/**
 * Atomically reserve a fact_id in vanguard_stream (a placeholder row).
 * Oracle uses this to coordinate parallel sub-tasks sharing the same ID.
 *
 * Previously inserted `status`/`date_text` fields that don't exist on this table
 * (verified against live schema) — the insert was silently failing (error swallowed,
 * caller only wraps this in try/catch for network-level throws) and the "reservation"
 * never actually landed. Fixed by dropping those fields and checking the real error.
 */
export async function mintRecordFactId(userId: string): Promise<string> {
  const supabase = createServiceClient();
  const factId = crypto.randomUUID();

  await insertStreamRecord(supabase, {
    id: factId,
    user_id: userId,
    content: '',
    source: 'oracle_mint',
  });

  return factId;
}
