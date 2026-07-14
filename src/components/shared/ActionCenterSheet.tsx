import Button from '../ui/Button';
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, X } from 'lucide-react';
import Modal from '../ui/Modal';
import { fetchActionCenterCount, fetchPendingClarificationRequests } from '../../lib/actionCenterApi';
import { useUserId } from '../../store/useStore';
import { actionCenterKeys } from '../../lib/queryKeys';
import { ClarificationRequestCard } from '../ai/ClarificationRequestCard';
import { SystemProposalCard } from './SystemProposalCard';
import {
  fetchPendingProposals,
  resolveProposal,
  syncFrictionProposals,
} from '../../lib/systemProposals';



// eslint-disable-next-line react-refresh/only-export-components
export function usePendingActionCount() {
  const userId = useUserId() ?? '';
  const queryClient = useQueryClient();

  const countQuery = useQuery({
    queryKey: actionCenterKeys.count(userId),
    queryFn: async () => {
      if (!userId) return 0;
      await syncFrictionProposals(userId);
      return fetchActionCenterCount(userId);
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
  open,
  onClose,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const queryClient = useQueryClient();
  const userId = useUserId() ?? '';

  const dataQuery = useQuery({
    queryKey: actionCenterKeys.data(userId),
    queryFn: async () => {
      await syncFrictionProposals(userId);
      const [clarData, props] = await Promise.all([
        fetchPendingClarificationRequests(userId),
        fetchPendingProposals(userId),
      ]);
      return {
        clarifications: clarData,
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

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      showCloseButton={false}
      padding="p-5 pb-8"
      overflowY={true}
      size="lg"
      overlayClassName="p-0 items-end justify-center sm:p-4"
      className="bg-surface-solid border border-border-custom rounded-t-[var(--legacy-arbitrary-051)] sm:rounded-b-[var(--legacy-arbitrary-054)] max-h-[var(--legacy-h-045)]"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-muted">
          <HelpCircle size={14} /> Oczekujące
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="rounded-full p-2 text-text-muted hover:bg-surface/80"
        >
          <X size={16} />
        </Button>
      </div>

      {loading && <p className="text-center text-sm text-text-muted py-6">Ładuję…</p>}

      {empty && (
        <p className="text-center text-sm text-text-tertiary py-8">Brak propozycji ani pytań.</p>
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
    </Modal>
  );
}
