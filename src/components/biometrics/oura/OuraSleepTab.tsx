/**
 * @component OuraSleepTab
 * @role Zakładka Sen (Sleep) — Wzorowana 1:1 na Oura Ring UI Redesign & NOOP Hypnogram (Wersja polska).
 */
import type { OuraHealthHubData, SleepStageBlock } from './types';

export function OuraSleepTab({ oura, enhanced }: OuraHealthHubData) {
  const sleepScore = enhanced?.sleep_score ?? oura?.sleep_score ?? 74;
  const totalSleepH = enhanced?.total_sleep_hours ?? oura?.total_sleep_hours ?? 6.4;
  const deepH = enhanced?.deep_sleep_hours ?? oura?.deep_sleep_hours ?? 1.0;
  const remH = enhanced?.rem_sleep_hours ?? oura?.rem_sleep_hours ?? 1.7;
  const latencyMins = oura?.latency_minutes ?? 8;
  const efficiencyPct = oura?.sleep_efficiency ?? 91;
  const totalInBedH = (enhanced?.time_in_bed_hours ?? (totalSleepH + 0.5));

  const formatHM = (h: number) => {
    const hrs = Math.floor(h);
    const mins = Math.round((h % 1) * 60);
    return `${hrs}h ${mins}m`;
  };

  return (
    <div className="space-y-4 text-white animate-fadeIn">
      {/* Oura Sleep Area Chart Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl">
        <div className="flex items-center justify-between text-3xs font-black uppercase tracking-widest text-slate-400">
          <span>WCZORAJ</span>
          <span className="text-teal-400 border-b border-teal-400 pb-0.5">DZIŚ</span>
        </div>

        {/* Hypnogram Area Stream */}
        <div className="my-4 space-y-2">
          <div className="relative h-24 w-full overflow-hidden rounded-2xl bg-black/40 p-2 border border-white/5">
            <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 40">
              <path
                d="M 0 35 Q 15 10 30 25 T 60 15 T 80 30 L 100 20 L 100 40 L 0 40 Z"
                fill="url(#hypnoGradient)"
                opacity="0.8"
              />
              <path
                d="M 0 35 Q 15 10 30 25 T 60 15 T 80 30 L 100 20"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
              />
              <defs>
                <linearGradient id="hypnoGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0.1" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="flex justify-between text-3xs font-bold text-slate-400 px-1">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" /> CZUWANIE</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-400" /> FAZA REM</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" /> SEN LEKKI</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-600" /> SEN GŁĘBOKI</span>
          </div>
        </div>

        {/* Top Summary Grid (Total Sleep / Time in Bed / Efficiency / RHR) */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-center">
          <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">CAŁKOWITY CZAS SNU</p>
            <p className="text-lg font-black text-white">{formatHM(totalSleepH)}</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">CZAS W ŁÓŻKU</p>
            <p className="text-lg font-black text-white">{formatHM(totalInBedH)}</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">EFEKTYWNOŚĆ SNU</p>
            <p className="text-lg font-black text-teal-400">{efficiencyPct}%</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">TĘTNO SPOCZYNKOWE</p>
            <p className="text-lg font-black text-rose-400">{enhanced?.sleep_lowest_heart_rate ?? oura?.rhr_avg ?? 54} bpm</p>
          </div>
        </div>
      </div>

      {/* Hero Sleep Score */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 text-center shadow-xl">
        <p className="text-3xs font-black uppercase tracking-[0.25em] text-slate-400">OCENA SNU</p>
        <span className="font-display text-5xl font-black text-white mt-1 block">{sleepScore}</span>
        <p className="text-3xs font-bold text-teal-400 uppercase tracking-widest mt-1">ZOBACZ TRENDY ›</p>
      </div>

      {/* Sleep Contributors */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 space-y-4">
        <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">SKŁADNIKI SNU (CONTRIBUTORS)</h4>

        <div className="space-y-3.5">
          {[
            { name: 'CAŁKOWITY SEN', val: formatHM(totalSleepH), pct: 85, color: 'bg-teal-400', labelColor: 'text-white' },
            { name: 'EFEKTYWNOŚĆ', val: `${efficiencyPct}%`, pct: efficiencyPct, color: 'bg-teal-400', labelColor: 'text-white' },
            { name: 'SPOKÓJ SNU', val: 'Dobry', pct: 88, color: 'bg-teal-400', labelColor: 'text-teal-400' },
            { name: 'SEN REM', val: `${formatHM(remH)}, 27%`, pct: 75, color: 'bg-sky-400', labelColor: 'text-white' },
            { name: 'SEN GŁĘBOKI', val: `${formatHM(deepH)}, 16%`, pct: 60, color: 'bg-indigo-500', labelColor: 'text-white' },
            { name: 'OPÓŹNIENIE ZASYPIANIA', val: `${latencyMins}m`, pct: 90, color: 'bg-teal-400', labelColor: 'text-white' },
            { name: 'PORA SNU', val: 'Optymalna', pct: 95, color: 'bg-teal-400', labelColor: 'text-teal-400' },
          ].map((item) => (
            <div key={item.name} className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300 font-bold tracking-wider text-3xs uppercase">{item.name}</span>
                <span className={`font-bold ${item.labelColor}`}>{item.val}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
