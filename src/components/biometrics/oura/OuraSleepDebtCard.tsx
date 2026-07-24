/**
 * @component OuraSleepDebtCard
 * @role Sekcja Deficytu Snu (14 dni, suwak 4-stopniowy) oraz Zegar Biologiczny (Chronotyp).
 */
import { ChevronRight } from 'lucide-react';
import type { OuraHealthHubData } from './types';

export function OuraSleepDebtCard({ oura, enhanced }: OuraHealthHubData) {
  const debtHours = 4;
  const debtMins = 20;
  const statusLabel = 'UMIARKOWANE';

  return (
    <div className="space-y-4">
      {/* Deficyt Snu (Ostatnie 14 dni) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between text-3xs font-black uppercase tracking-widest text-slate-400">
          <span>DEFICYT SNU</span>
          <span className="flex items-center gap-0.5 text-slate-400 hover:text-white cursor-pointer transition-colors">
            Ostatnie 14 dni <ChevronRight size={14} />
          </span>
        </div>

        <div className="flex items-baseline gap-2.5">
          <span className="text-3xl font-black text-white">{debtHours} h {debtMins} m</span>
          <span className="text-2xs font-extrabold tracking-wider text-amber-400 uppercase">{statusLabel}</span>
        </div>

        {/* 4-Stage Track Slider */}
        <div className="space-y-1.5 pt-1">
          <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div className="absolute top-0 bottom-0 left-[35%] right-[20%] bg-amber-400/40 rounded-full" />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-amber-300 shadow-glow"
              style={{ left: '62%' }}
            />
          </div>
          <div className="flex justify-between text-3xs font-bold text-slate-500">
            <span>Brak</span>
            <span>Wysokie</span>
          </div>
        </div>
      </div>

      {/* Zegar Biologiczny (Chronotyp) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between text-3xs font-black uppercase tracking-widest text-slate-400">
          <span>ZEGAR BIOLOGICZNY</span>
          <ChevronRight size={16} className="text-slate-400" />
        </div>

        {/* Chronotyp Arc Graphic */}
        <div className="relative my-2 h-16 w-full flex items-center justify-center">
          <svg className="w-full h-full" viewBox="0 0 200 50">
            <path d="M 10 40 Q 100 5 190 40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
            <path d="M 40 32 Q 100 10 160 32" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
            <circle cx="100" cy="18" r="4" fill="#ffffff" />
            <circle cx="108" cy="22" r="4" fill="#38bdf8" />
          </svg>
        </div>

        <p className="text-2xs text-slate-300 leading-relaxed font-medium">
          Środek twojego snu był zgodny z sugerowanym przez chronotyp.
        </p>
      </div>
    </div>
  );
}
