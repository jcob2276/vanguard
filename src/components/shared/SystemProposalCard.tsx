import { useState } from 'react';
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { SystemProposal } from '../../lib/systemProposals';
import { Card } from '../ui/Card';
import Button from '../ui/Button';

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
    <Card className="space-y-3" padding="1rem">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
          {proposal.proposal_type === 'friction_cluster' ? 'Tarcie — N×' : proposal.proposal_type}
        </p>
        <h3 className="mt-1 text-[14px] font-bold text-text-primary">{proposal.title}</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">{proposal.body}</p>
      </div>

      {snippets.length > 0 && (
        <div>
          <Button
            type="button"
            onClick={() => setOpen((v) => !v)}
            variant="ghost"
            size="sm"
            icon={open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            className="!px-0 text-primary"
          >
            {open ? 'Ukryj przykłady' : 'Pokaż przykłady ze streamu'}
          </Button>
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
        <Button
          type="button"
          disabled={busy}
          onClick={() => void act('confirmed')}
          variant="primary"
          size="sm"
          icon={<Check size={14} />}
          className="flex-1"
        >
          Istotne
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => void act('dismissed')}
          variant="outline"
          size="sm"
          icon={<X size={14} />}
        >
          Olej
        </Button>
      </div>
    </Card>
  );
}
