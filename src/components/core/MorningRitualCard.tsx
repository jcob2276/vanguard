import { Check, Flame, Play, Zap } from 'lucide-react';

interface MorningRitualCardProps {
  isCompleted: boolean;
  streak: number;
  focusIntention: string | null;
  onClick: () => void;
}

export default function MorningRitualCard({
  isCompleted,
  streak,
  focusIntention,
  onClick,
}: MorningRitualCardProps) {
  return (
    <section className="rounded-[24px] border border-border-custom bg-surface backdrop-blur-md p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-text-muted">
            <Zap size={10} className="text-amber-400" fill="currentColor" /> OŚWIECONY EGOIZM
          </p>
          <h3 className="mt-1 font-display text-[15px] font-black tracking-tight text-text-primary leading-tight">
            Zwycięski Poranek
          </h3>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-0.5 rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-500 text-[10px] font-black">
            <Flame size={11} fill="currentColor" />
            <span>{streak} d</span>
          </div>
        )}
      </div>

      <div className="my-4 border-t border-border-custom" />

      {isCompleted ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-500">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10">
              <Check size={11} strokeWidth={3} />
            </div>
            <span className="text-xs font-black uppercase tracking-wider">Poranek wygrany! 🏆</span>
          </div>
          {focusIntention && (
            <div className="rounded-xl bg-text-primary/[0.02] border border-border-custom/50 p-3">
              <p className="text-[9px] uppercase font-bold text-text-muted">Główna intencja na dziś:</p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-text-primary">
                "{focusIntention}"
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-text-secondary leading-relaxed">
            Zacznij dzień od zaprogramowania głowy. 5-10 minut, które zmienią Twój dzień.
          </p>
          <button
            onClick={onClick}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all cursor-pointer"
          >
            <Play size={10} fill="currentColor" className="ml-0.5 shrink-0" /> Rozpocznij Rytuał ⚡
          </button>
        </div>
      )}
    </section>
  );
}
