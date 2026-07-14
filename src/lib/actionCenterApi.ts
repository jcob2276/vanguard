import { supabase } from './supabase';

export interface PendingClarification {
  id: string;
  question: string;
  response_type: string;
  options: Array<{ id: string; label: string; value: string }>;
  proposed_memory?: string | null;
  confidence?: number | null;
}

export async function fetchActionCenterCount(userId: string): Promise<number> {
  const [clarRes, propRes] = await Promise.all([
    supabase
      .from('oracle_clarification_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending'),
    supabase
      .from('system_proposals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending'),
  ]);

  if (clarRes.error) throw clarRes.error;
  if (propRes.error) throw propRes.error;

  return (clarRes.count ?? 0) + (propRes.count ?? 0);
}

export async function fetchPendingClarificationRequests(userId: string): Promise<PendingClarification[]> {
  const { data, error } = await supabase
    .from('oracle_clarification_requests')
    .select('id, question, response_type, options, proposed_memory, confidence')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as PendingClarification[];
}
