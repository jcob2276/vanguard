import { supabase } from './supabase';

export type SystemProposal = {
  id: string;
  proposal_type: 'friction_cluster' | 'clarification' | 'schedule_edit';
  status: 'pending' | 'confirmed' | 'dismissed';
  title: string;
  body: string;
  payload: {
    friction_type?: string;
    count?: number;
    window_days?: number;
    event_ids?: string[];
    snippets?: string[];
  };
  created_at: string;
};

export async function syncFrictionProposals(userId: string): Promise<void> {
  const { error } = await supabase.rpc('sync_friction_proposals', { p_user_id: userId });
  if (error) console.warn('[systemProposals] sync failed:', error.message);
}

export async function fetchPendingProposals(userId: string): Promise<SystemProposal[]> {
  const { data, error } = await supabase
    .from('system_proposals')
    .select('id, proposal_type, status, title, body, payload, created_at')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[systemProposals] fetch failed:', error.message);
    return [];
  }
  return (data ?? []) as SystemProposal[];
}

export async function resolveProposal(
  id: string,
  status: 'confirmed' | 'dismissed',
): Promise<void> {
  const { error } = await supabase
    .from('system_proposals')
    .update({ status, resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
