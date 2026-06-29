import { useState } from 'react';
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { SystemProposal } from '../../lib/systemProposals';

export function SystemProposalCard({
  proposal,
  onResolved,
}: {
  proposal: SystemProposal;
  onResolved: (id: string, status: 'confirmed' | 'dismissed') => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const snippets = proposal.payload.snippets ?? [];

  const act = async (status: 'confirmed' | 'dismissed') => {
    if (busy) return;
    setBusy(true);
    try {
      await onResolved(proposal.id, status);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-2xl border border-border-custom bg-surface/60 p-4 space-y-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
          {proposal.proposal_type === 'friction_cluster' ? 'Tarcie — N×' : proposal.proposal_type}
        </p>
        <h3 className="mt-1 text-[14px] font-bold text-text-primary">{proposal.title}</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">{proposal.body}</p>
      </div>

      {snippets.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-semibold text-primary"
          >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {open ? 'Ukryj przykłady' : 'Pokaż przykłady ze streamu'}
          </button>
          {open && (
            <ul className="mt-2 space-y-1.5">
              {snippets.map((s, i) => (
                <li key={i} className="text-[11px] text-text-tertiary border-l-2 border-primary/30 pl-2">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void act('confirmed')}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-[12px] font-bold text-white disabled:opacity-60"
        >
          <Check size={14} /> Istotne
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void act('dismissed')}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border-custom px-4 py-2 text-[12px] font-semibold text-text-secondary disabled:opacity-60"
        >
          <X size={14} /> Olej
        </button>
      </div>
    </article>
  );
}
