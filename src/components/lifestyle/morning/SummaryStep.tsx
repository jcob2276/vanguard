import { Check, Flame } from 'lucide-react';

interface SummaryStepProps {
  mainIntention: string;
  currentStreak: number;
  onBack: () => void;
}

export default function SummaryStep({
  mainIntention,
  currentStreak,
  onBack,
}: SummaryStepProps) {
  return (
    <div className="flex-1 flex flex-col justify-center text-center space-y-7 my-auto">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 shadow-[0_12px_24px_rgba(16,185,129,0.12)]">
        <Check size={36} strokeWidth={3} />
      </div>
      <div className="space-y-2.5">
        <h3 className="font-display text-2xl font-black tracking-tight leading-none text-emerald-500">
          PORANEK WYGRANY!
        </h3>
        <p className="text-[13px] text-text-secondary leading-relaxed max-w-[280px] mx-auto">
          Wykonałeś pełny blok egoizmu. Ustawiłeś intencję główną i przełączyłeś neurologię w tryb tworzenia.
        </p>
      </div>

      <div className="rounded-2xl border border-border-custom bg-surface backdrop-blur-md p-5 max-w-sm mx-auto text-left space-y-3.5 shadow-sm">
        <div className="flex justify-between items-center border-b border-border-custom/50 pb-2">
          <span className="text-[10px] uppercase font-bold text-text-muted">Status Dnia:</span>
          <span className="text-[11px] font-black text-emerald-500 uppercase">AKTYWNY / TWÓRCZY</span>
        </div>
        <div>
          <p className="text-[9px] uppercase font-bold text-text-muted">Twoja intencja na dziś:</p>
          <p className="font-display text-[13px] font-bold text-text-primary mt-1">
            {mainIntention}
          </p>
        </div>
        {currentStreak > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-orange-500/10 border border-orange-500/10 p-2.5 text-orange-500 text-[11px] font-bold">
            <Flame size={14} fill="currentColor" />
            <span>Passa wygranych poranków: {currentStreak} dni z rzędu! 🔥</span>
          </div>
        )}
      </div>

      <button
        onClick={onBack}
        className="w-full py-4 rounded-full bg-primary text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/10 active:scale-98 transition-all cursor-pointer"
      >
        Powrót do Dashboardu
      </button>
    </div>
  );
}
