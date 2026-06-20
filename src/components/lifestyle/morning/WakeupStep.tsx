import { Flame } from 'lucide-react';

interface WakeupStepProps {
  onNext: () => void;
}

export default function WakeupStep({ onNext }: WakeupStepProps) {
  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="flex-1 flex flex-col justify-center text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
          <Flame size={24} fill="currentColor" />
        </div>
        <div className="space-y-3">
          <h3 className="font-display text-xl font-black tracking-tight uppercase font-display">
            KROK 1: POBUDKA
          </h3>
          <p className="text-[20px] font-black text-text-primary leading-tight font-display max-w-[280px] mx-auto">
            Entuzjastycznie wyskakujesz z łóżka!
          </p>
          <p className="text-xs text-text-muted leading-relaxed max-w-[260px] mx-auto">
            Nie analizuj. Nie sprawdzaj telefonu. Poczuj natychmiastową decyzję o działaniu. Twoja fizjologia dyktuje Twój stan.
          </p>
        </div>
      </div>
      <button
        onClick={onNext}
        className="w-full py-4 rounded-full bg-primary text-white font-black text-sm uppercase tracking-widest active:scale-98 transition-all cursor-pointer"
      >
        Wyskoczyłem! ⚡
      </button>
    </div>
  );
}
