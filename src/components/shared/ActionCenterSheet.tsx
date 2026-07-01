import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { HelpCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ClarificationRequestCard } from '../ai/ClarificationRequestCard';
import { SystemProposalCard } from './SystemProposalCard';
import {
  fetchPendingProposals,
  resolveProposal,
  syncFrictionProposals,
  type SystemProposal,
} from '../../lib/systemProposals';

interface PendingClarification {
  id: string;
  question: string;
  response_type: string;
  options: Array<{ id: string; label: string; value: string }>;
  proposed_memory?: string | null;
  confidence?: number | null;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePendingActionCount(session: Session | null) {
  const [count, setCount] = useState(0);

  const reload = useCallback(async () => {
    if (!session?.user?.id) {
      setCount(0);
      return;
    }
    const userId = session.user.id;
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
    setCount((clarRes.count ?? 0) + (propRes.count ?? 0));
  }, [session?.user?.id]);

  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), 60_000);
    return () => clearInterval(t);
  }, [reload]);

  return { count, reload };
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
  const [clarifications, setClarifications] = useState<PendingClarification[]>([]);
  const [proposals, setProposals] = useState<SystemProposal[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    await syncFrictionProposals(session.user.id);
    const [clarRes, props] = await Promise.all([
      supabase
        .from('oracle_clarification_requests')
        .select('id, question, response_type, options, proposed_memory, confidence')
        .eq('user_id', session.user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      fetchPendingProposals(session.user.id),
    ]);
    setClarifications((clarRes.data ?? []) as PendingClarification[]);
    setProposals(props);
    setLoading(false);
  }, [session.user.id]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const handleProposalResolved = async (id: string, status: 'confirmed' | 'dismissed') => {
    await resolveProposal(id, status);
    await load();
    onUpdated?.();
  };

  const empty = !loading && clarifications.length === 0 && proposals.length === 0;

  if (!open) return null;

  return (
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
                void load();
                onUpdated?.();
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
