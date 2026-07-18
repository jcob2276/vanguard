import { Check, Circle, Sunrise } from 'lucide-react';

interface Props {
  reflectionRequired: boolean;
  reflectionReady: boolean;
  filledCount: number;
}

function StepState({ complete }: { complete: boolean }) {
  return complete ? (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-on-accent">
      <Check size={12} strokeWidth={3} />
    </span>
  ) : <Circle size={20} className="text-border-strong" />;
}

export default function PowerListSetupHeader({ reflectionRequired, reflectionReady, filledCount }: Props) {
  const planReady = filledCount === 5;
  return (
    <header className="rounded-[var(--radius-lg)] border border-primary/10 bg-surface-tonal p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary shadow-[var(--shadow-inner)]">
          <Sunrise size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-2xs font-black uppercase tracking-widest text-primary">Rytuał startu</p>
          <h3 className="mt-1 font-display text-lg font-black leading-tight tracking-tight text-text-primary">
            Domknij wczoraj. Wybierz dzisiejszy kierunek.
          </h3>
          <p className="mt-1.5 text-xs font-medium leading-relaxed text-text-secondary">
            Dwa krótkie kroki, zanim dzień przejdzie w tryb działania.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2" aria-label="Postęp rytuału startu">
        <div className={`rounded-xl border p-3 transition-colors ${reflectionReady ? 'border-success/20 bg-success/[0.06]' : 'border-primary/20 bg-surface-solid'}`}>
          <div className="flex items-center gap-2">
            <StepState complete={reflectionReady} />
            <div className="min-w-0">
              <p className="text-2xs font-black uppercase tracking-wider text-text-muted">Krok 1</p>
              <p className="truncate text-xs font-bold text-text-primary">{reflectionRequired ? 'Domknij wczoraj' : 'Wczoraj domknięte'}</p>
            </div>
          </div>
        </div>
        <div className={`rounded-xl border p-3 transition-colors ${planReady ? 'border-success/20 bg-success/[0.06]' : 'border-border-custom bg-surface-solid'}`}>
          <div className="flex items-center gap-2">
            <StepState complete={planReady} />
            <div className="min-w-0">
              <p className="text-2xs font-black uppercase tracking-wider text-text-muted">Krok 2</p>
              <p className="text-xs font-bold text-text-primary">Plan dnia · {filledCount}/5</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
