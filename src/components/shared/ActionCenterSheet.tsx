import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { HelpCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ClarificationRequestCard } from '../ai/ClarificationRequestCard';
import { SystemProposalCard } from './SystemProposalCard';
import {
  fetchPendingProposals,
  resolveProposal,
  syncFrictionProposals,
} from '../../lib/systemProposals';

interface PendingClarification {
  id: string;
  question: string;
  response_type: string;
  options: Array<{ id: string; label: string; value: string }>;
  proposed_memory?: string | null;
  confidence?: number | null;
}

const actionCenterKeys = {
  all: ['action-center'] as const,
  count: (userId: string) => [...actionCenterKeys.all, 'count', userId] as const,
  data: (userId: string) => [...actionCenterKeys.all, 'data', userId] as const,
};

// eslint-disable-next-line react-refresh/only-export-components
export function usePendingActionCount(session: Session) {
  const userId = session?.user?.id ?? '';
  const queryClient = useQueryClient();

  const countQuery = useQuery({
    queryKey: actionCenterKeys.count(userId),
    queryFn: async () => {
      if (!userId) return 0;
      await syncFrictionProposals(userId);
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
      return (clarRes.count ?? 0) + (propRes.count ?? 0);
    },
    enabled: !!userId,
    refetchInterval: 60_000,
  });

  const reload = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: actionCenterKeys.count(userId) });
  }, [queryClient, userId]);

  return { count: countQuery.data ?? 0, reload };
}

export function ActionCenterSheet({
  session,
  open,
  onClose,
  onUpdated,
}: {
  session: Session;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const queryClient = useQueryClient();
  const userId = session.user.id;

  const dataQuery = useQuery({
    queryKey: actionCenterKeys.data(userId),
    queryFn: async () => {
      await syncFrictionProposals(userId);
      const [clarRes, props] = await Promise.all([
        supabase
          .from('oracle_clarification_requests')
          .select('id, question, response_type, options, proposed_memory, confidence')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        fetchPendingProposals(userId),
      ]);
      return {
        clarifications: (clarRes.data ?? []) as PendingClarification[],
        proposals: props,
      };
    },
    enabled: open && !!userId,
  });

  const clarifications = dataQuery.data?.clarifications ?? [];
  const proposals = dataQuery.data?.proposals ?? [];
  const loading = dataQuery.isLoading;

  const handleProposalResolved = async (id: string, status: 'confirmed' | 'dismissed') => {
    await resolveProposal(id, status);
    void queryClient.invalidateQueries({ queryKey: actionCenterKeys.data(userId) });
    void queryClient.invalidateQueries({ queryKey: actionCenterKeys.count(userId) });
    onUpdated?.();
  };

  const empty = !loading && clarifications.length === 0 && proposals.length === 0;

  if (!open) return null;

  return (
    // NOTE: custom overlay — ActionCenterSheet is a bottom-anchored slide-up sheet (items-end). ui/Modal
    // renders a centered dialog and cannot produce this bottom-sheet layout with a full-width rounded-top panel.
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-[24px] border border-border-custom bg-surface-solid p-5 pb-8 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-text-muted">
            <HelpCircle size={14} /> Oczekujące
          </p>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-text-muted hover:bg-surface/80">
            <X size={16} />
          </button>
        </div>

        {loading && <p className="text-center text-[12px] text-text-muted py-6">Ładuję…</p>}

        {empty && (
          <p className="text-center text-[12px] text-text-tertiary py-8">Brak propozycji ani pytań.</p>
        )}

        <div className="space-y-4">
          {proposals.map((p) => (
            <SystemProposalCard key={p.id} proposal={p} onResolved={handleProposalResolved} />
          ))}

          {clarifications.map((item) => (
            <ClarificationRequestCard
              key={item.id}
              request={{
                id: item.id,
                question: item.question,
                response_type: item.response_type as 'confirm' | 'single_choice' | 'multi_choice' | 'short_text',
                options: item.options ?? [],
                proposed_memory: item.proposed_memory ?? undefined,
                confidence: item.confidence ?? undefined,
              }}
              onAnswered={() => {
                void queryClient.invalidateQueries({ queryKey: actionCenterKeys.data(userId) });
                void queryClient.invalidateQueries({ queryKey: actionCenterKeys.count(userId) });
                onUpdated?.();
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
