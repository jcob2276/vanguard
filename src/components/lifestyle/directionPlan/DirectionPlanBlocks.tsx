import Spinner from '../../ui/Spinner';

type Phase1Recap = { narrative: string; longterm_motif: string | null; question: string };

function Divider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-border-custom" />
      <span className="text-2xs uppercase tracking-widest text-text-muted font-black">{title}</span>
      <div className="h-px flex-1 bg-border-custom" />
    </div>
  );
}

export function Block1Narrative({ phase1, phase1Loading }: { phase1: Phase1Recap | null; phase1Loading: boolean }) {
  return (
    <div className="space-y-3">
      <Divider title="Jak wyglądał twój tydzień" />
      {phase1Loading && (
        <div className="flex items-center gap-2 py-3 text-text-muted text-sm">
          <Spinner size="sm" />
          AI analizuje tydzień…
        </div>
      )}
      {phase1 && (
        <div className="space-y-3">
          <p className="text-sm text-text-primary leading-relaxed">{phase1.narrative}</p>
          {phase1.longterm_motif && (
            <div className="border-l-2 border-warning pl-3 py-1">
              <p className="text-xs text-warning font-bold uppercase tracking-wider mb-1">Długoterminowy motyw</p>
              <p className="text-sm text-text-primary leading-relaxed">{phase1.longterm_motif}</p>
            </div>
          )}
          {phase1.question && (
            <div className="bg-surface border border-border-custom rounded-xl px-3 py-2.5">
              <p className="text-xs text-text-muted font-bold uppercase tracking-wider mb-1">Pytanie otwierające</p>
              <p className="text-sm text-text-secondary italic">„{phase1.question}"</p>
            </div>
          )}
        </div>
      )}
      {!phase1Loading && !phase1 && (
        <p className="text-sm text-text-muted italic">AI podsumowanie pojawi się za chwilę…</p>
      )}
    </div>
  );
}
