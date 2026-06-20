import { Zap } from 'lucide-react';

interface IntroStepProps {
  onStart: () => void;
}

export default function IntroStep({ onStart }: IntroStepProps) {
  return (
    <div className="flex-1 flex flex-col justify-center text-center space-y-7 my-auto">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/[0.06] border border-primary/10 text-primary shadow-[0_12px_24px_rgba(79,70,229,0.08)]">
        <Zap size={32} className="text-primary" fill="currentColor" />
      </div>
      <div className="space-y-2.5">
        <h3 className="font-display text-2xl font-black tracking-tight leading-none text-text-primary">
          ZWYCIĘSKI PORANEK
        </h3>
        <p className="text-[13px] text-text-secondary leading-relaxed max-w-[280px] mx-auto">
          Pierwsze 10 minut dnia należy wyłącznie do Ciebie. Zaprogramuj tożsamość, stwórz intencję i wygraj ten dzień.
        </p>
      </div>
      <div className="rounded-2xl border border-border-custom bg-surface backdrop-blur-md p-4 max-w-xs mx-auto text-left space-y-1.5 text-xs text-text-secondary">
        <p className="font-bold uppercase text-[9px] tracking-widest text-text-muted mb-2">Instrukcja bloku:</p>
        <p className="flex gap-2">
          <span>1.</span> Wyskakujesz z łóżka (Pobudka)
        </p>
        <p className="flex gap-2">
          <span>2.</span> Deklaracja przed lustrem (Tożsamość)
        </p>
        <p className="flex gap-2">
          <span>3.</span> Medytacja & Obserwacja (15 min)
        </p>
        <p className="flex gap-2">
          <span>4.</span> Odczytanie deklaracji tożsamości
        </p>
        <p className="flex gap-2">
          <span>5.</span> Przepisanie intencji & Zmiana Świateł
        </p>
      </div>
      <button
        onClick={onStart}
        className="w-full py-4 rounded-full bg-primary text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/25 hover:bg-primary-hover active:scale-98 transition-all cursor-pointer"
      >
        Rozpocznij Rytuał ⚡
      </button>
    </div>
  );
}
