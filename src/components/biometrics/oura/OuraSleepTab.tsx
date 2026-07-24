/**
 * @component OuraSleepTab
 * @role Zakładka Sen (Sleep) — Wzorowana 1:1 na polskiej wersji oficjalnej Oura App.
 */
import { ChevronRight } from 'lucide-react';
import type { OuraHealthHubData } from './types';
import { OuraHypnogramChart } from './OuraHypnogramChart';
import { OuraSleepDebtCard } from './OuraSleepDebtCard';
import { OuraVitalsLinearCharts } from './OuraVitalsLinearCharts';

export function OuraSleepTab(dataProps: OuraHealthHubData) {
  const { oura, enhanced } = dataProps;
  const sleepScore = enhanced?.sleep_score ?? oura?.sleep_score ?? 81;
  const totalSleepH = enhanced?.total_sleep_hours ?? oura?.total_sleep_hours ?? 7.8;
  const totalInBedH = enhanced?.time_in_bed_hours ?? 9.3;
  const efficiencyPct = oura?.sleep_efficiency ?? 84;
  const lowestHR = enhanced?.sleep_lowest_heart_rate ?? oura?.rhr_avg ?? 47;
  const remH = enhanced?.rem_sleep_hours ?? 1.01;
  const deepH = enhanced?.deep_sleep_hours ?? 1.3;
  const latencyMins = oura?.latency_minutes ?? 14;

  const formatHM = (h: number) => {
    const hrs = Math.floor(h);
    const mins = Math.round((h % 1) * 60);
    return `${hrs} h ${mins} min`;
  };

  return (
    <div className="space-y-4 text-white animate-fadeIn">
      {/* Hero Sleep Score */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-5xl font-black text-white">{sleepScore}</span>
          <span className="text-xs font-extrabold uppercase tracking-widest text-teal-400">DOBRY</span>
        </div>

        <h3 className="text-xl font-serif font-bold text-white tracking-tight">Optymalny czas zasypiania</h3>
        <p className="text-2xs text-slate-400 leading-relaxed">
          Zasypianie zajęło ci wczoraj 0 h {latencyMins} min, co oznacza, że twój organizm był gotowy do snu.
        </p>
      </div>

      {/* Współczynniki Snu (Sleep Contributors) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl">
        <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">WSPÓŁCZYNNIKI SNU</h4>

        <div className="space-y-3">
          {[
            { label: 'Całkowity czas snu', val: formatHM(totalSleepH), pct: 85, color: 'bg-white' },
            { label: 'Wydajność', val: `${efficiencyPct}%`, pct: efficiencyPct, color: 'bg-white' },
            { label: 'Poziom wypoczęcia', val: 'Dobry', pct: 88, color: 'bg-white', textCol: 'text-white' },
            { label: 'Sen fazy REM', val: `${formatHM(remH)}, 13%`, pct: 60, color: 'bg-rose-400', textCol: 'text-rose-300' },
            { label: 'Głęboki sen', val: `${formatHM(deepH)}, 17%`, pct: 65, color: 'bg-white' },
            { label: 'Czas zasypiania', val: `${latencyMins} min`, pct: 90, color: 'bg-white' },
            { label: 'Pora snu', val: 'Optymalna', pct: 95, color: 'bg-teal-400', textCol: 'text-teal-400' },
          ].map((item) => (
            <div key={item.label} className="space-y-1 group cursor-pointer">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-300">{item.label}</span>
                <span className={`font-bold ${item.textCol ?? 'text-white'}`}>
                  {item.val}
                </span>
              </div>

              <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Kluczowe Dane Pomiarowe (4 Grid) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-3 shadow-xl">
        <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">KLUCZOWE DANE POMIAROWE</h4>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">CAŁKOWITY CZAS SNU</p>
            <p className="text-lg font-black text-white">{formatHM(totalSleepH)}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">CZAS SPĘDZONY W ŁÓŻKU</p>
            <p className="text-lg font-black text-white">{formatHM(totalInBedH)}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">WYDAJNOŚĆ SNU</p>
            <p className="text-lg font-black text-teal-400">{efficiencyPct}%</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">TĘTNO SPOCZYNKOWE</p>
            <p className="text-lg font-black text-rose-400">{lowestHR} bpm</p>
          </div>
        </div>
      </div>

      {/* Hypnogram Timeline Chart & Motion */}
      <OuraHypnogramChart {...dataProps} />

      {/* Sleep Debt Slider & Biological Clock */}
      <OuraSleepDebtCard {...dataProps} />

      {/* Linear Vitals Charts (RHR & HRV) */}
      <OuraVitalsLinearCharts {...dataProps} />
    </div>
  );
}
