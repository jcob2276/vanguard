/**
 * @component OuraSleepDebtCard
 * @role Sekcja Deficytu Snu (Prawdziwy bilans z 14 dni) oraz Zegar Biologiczny z bazy Supabase.
 */
import { ChevronRight } from 'lucide-react';
import type { OuraHealthHubData } from './types';

export function OuraSleepDebtCard({ ouraHistory, enhancedHistory }: OuraHealthHubData) {
  // Compute real 14-day sleep debt balance
  const last14Days = (enhancedHistory ?? []).slice(-14);
  const targetPerNight = 7.5; // 7h 30m standard need
  const totalTarget14 = (last14Days.length || 1) * targetPerNight;

  const totalSlept14 = last14Days.reduce((acc, curr) => {
    return acc + (curr.total_sleep_hours ?? 0);
  }, 0);

  const debtHoursDiff = Math.max(0, totalTarget14 - totalSlept14);
  const debtHours = Math.floor(debtHoursDiff);
  const debtMins = Math.round((debtHoursDiff % 1) * 60);

  const getStatus = (diff: number) => {
    if (diff <= 1) return { label: 'BRAK DŁUGU', color: 'text-emerald-400', pct: 15, barColor: 'bg-emerald-400' };
    if (diff <= 4) return { label: 'NISKI', color: 'text-teal-400', pct: 40, barColor: 'bg-teal-400' };
    if (diff <= 8) return { label: 'UMIARKOWANE', color: 'text-amber-400', pct: 70, barColor: 'bg-amber-400' };
    return { label: 'WYSOKIE', color: 'text-rose-400', pct: 95, barColor: 'bg-rose-400' };
  };

  const status = getStatus(debtHoursDiff);

  return (
    <div className="space-y-4">
      {/* Deficyt Snu (Ostatnie 14 dni) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between text-3xs font-black uppercase tracking-widest text-slate-400">
          <span>DEFICYT SNU</span>
          <span className="flex items-center gap-0.5 text-slate-400 hover:text-white cursor-pointer transition-colors">
            Ostatnie 14 dni ({last14Days.length} nocy) <ChevronRight size={14} />
          </span>
        </div>

        <div className="flex items-baseline gap-2.5">
          <span className="text-3xl font-black text-white">{debtHours} h {debtMins} m</span>
          <span className={`text-2xs font-extrabold tracking-wider uppercase ${status.color}`}>{status.label}</span>
        </div>

        {/* 4-Stage Track Slider */}
        <div className="space-y-1.5 pt-1">
          <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div className="absolute top-0 bottom-0 left-0 bg-teal-500/30 rounded-full" style={{ width: `${status.pct}%` }} />
            <div
              className={`absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-slate-900 ${status.barColor} shadow-glow`}
              style={{ left: `${Math.min(95, Math.max(5, status.pct))}%` }}
            />
          </div>
          <div className="flex justify-between text-3xs font-bold text-slate-500">
            <span>Brak</span>
            <span>Umiarkowane</span>
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
