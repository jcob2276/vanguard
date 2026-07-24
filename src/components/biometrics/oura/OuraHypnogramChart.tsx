/**
 * @component OuraHypnogramChart
 * @role Blokowy czasowy wykres stadiów snu (4 poziomy wysokości) & seria ruchów w nocy według Oura App.
 */
import { SlidersHorizontal, ChevronRight } from 'lucide-react';
import type { OuraHealthHubData } from './types';

export function OuraHypnogramChart({ enhanced, oura }: OuraHealthHubData) {
  const totalSleepH = enhanced?.total_sleep_hours ?? oura?.total_sleep_hours ?? 7.8;
  const timeInBedH = enhanced?.time_in_bed_hours ?? 9.3;
  const awakeMins = enhanced?.awake_time_minutes ?? 91;
  const remH = enhanced?.rem_sleep_hours ?? 1.01;
  const lightH = enhanced?.light_sleep_hours ?? 5.46;
  const deepH = enhanced?.deep_sleep_hours ?? 1.3;

  const totalMins = totalSleepH * 60;
  const remPct = Math.round((remH * 60 / totalMins) * 100);
  const lightPct = Math.round((lightH * 60 / totalMins) * 100);
  const deepPct = Math.round((deepH * 60 / totalMins) * 100);

  const formatHM = (h: number) => {
    const hrs = Math.floor(h);
    const mins = Math.round((h % 1) * 60);
    return `${hrs} h ${mins} min`;
  };

  // Hypnogram tiers data (Awake, REM, Light, Deep)
  const timelineTiers = [
    { type: 'awake', start: 0, width: 6, height: 'h-14', color: 'bg-stone-200 border-stone-300' },
    { type: 'light', start: 6, width: 12, height: 'h-8', color: 'bg-sky-400' },
    { type: 'deep', start: 18, width: 16, height: 'h-4', color: 'bg-sky-600' },
    { type: 'rem', start: 34, width: 10, height: 'h-11', color: 'bg-sky-300' },
    { type: 'light', start: 44, width: 8, height: 'h-8', color: 'bg-sky-400' },
    { type: 'awake', start: 52, width: 4, height: 'h-14', color: 'bg-stone-200 border-stone-300' },
    { type: 'rem', start: 56, width: 8, height: 'h-11', color: 'bg-sky-300' },
    { type: 'light', start: 64, width: 14, height: 'h-8', color: 'bg-sky-400' },
    { type: 'deep', start: 78, width: 12, height: 'h-4', color: 'bg-sky-600' },
    { type: 'light', start: 90, width: 10, height: 'h-8', color: 'bg-sky-400' },
  ];

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-2xl">
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xs font-black uppercase tracking-widest text-slate-400">CZAS SNU</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-3xl font-black text-white">{formatHM(totalSleepH)}</span>
            <span className="text-3xs text-slate-400">Całkowity czas trwania {formatHM(timeInBedH)}</span>
          </div>
        </div>
        <button className="p-2 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer">
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {/* Multi-tier Hypnogram Timeline (4 levels) */}
      <div className="space-y-2 pt-2">
        <div className="relative h-28 w-full rounded-2xl bg-black/40 p-2 border border-white/5 flex items-end overflow-hidden">
          <div className="relative h-full w-full flex items-end">
            {timelineTiers.map((t, idx) => (
              <div
                key={idx}
                style={{ left: `${t.start}%`, width: `${t.width}%` }}
                className={`absolute bottom-0 rounded-sm ${t.height} ${t.color} opacity-90 border-t transition-all`}
              />
            ))}
          </div>
        </div>

        {/* Time Axis */}
        <div className="flex justify-between text-3xs font-bold text-slate-500 px-1">
          <span>23:26</span>
          <span>0</span>
          <span>2</span>
          <span>4</span>
          <span>6</span>
          <span>8</span>
          <span>8:45</span>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-4 gap-1 text-3xs font-bold text-slate-400 text-center pt-1 border-t border-white/5">
          <span className="flex items-center justify-center gap-1"><span className="h-2 w-2 rounded-sm bg-stone-200" /> Stan czuwania</span>
          <span className="flex items-center justify-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-300" /> REM</span>
          <span className="flex items-center justify-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-400" /> Płytki</span>
          <span className="flex items-center justify-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-600" /> Głęboki sen</span>
        </div>
      </div>

      {/* RUCH (Night Motion Tick Marks) */}
      <div className="space-y-1 pt-2 border-t border-white/10">
        <p className="text-3xs font-black uppercase tracking-widest text-slate-400">RUCH</p>
        <div className="h-5 w-full rounded-xl bg-black/30 p-1 flex items-center justify-around border border-white/5">
          {[4, 18, 25, 42, 58, 62, 79, 88, 92].map((pos) => (
            <div key={pos} className="h-3 w-0.5 bg-slate-400/80 rounded-full" />
          ))}
        </div>
      </div>

      {/* Breakdown Stage Rows */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-stone-200" /> Stan czuwania
          </span>
          <span className="font-bold text-white">{formatHM(awakeMins / 60)}</span>
        </div>
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-300" /> REM
          </span>
          <span className="font-bold text-white">{formatHM(remH)} <span className="text-slate-400 font-normal">{remPct}%</span></span>
        </div>
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-400" /> Płytki
          </span>
          <span className="font-bold text-white">{formatHM(lightH)} <span className="text-slate-400 font-normal">{lightPct}%</span></span>
        </div>
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-600" /> Głęboki
          </span>
          <span className="font-bold text-white">{formatHM(deepH)} <span className="text-slate-400 font-normal">{deepPct}%</span></span>
        </div>
      </div>
    </div>
  );
}
