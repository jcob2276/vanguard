/**
 * @component OuraNightCompareCard
 * @role Porównywarka nocy (Dziś vs Wczoraj / Średnia 30d) z nakładaniem parametrów witalnych (0 podstawionych wartości).
 */
import { ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';
import type { OuraHealthHubData } from './types';

export function OuraNightCompareCard({ enhanced, enhancedYesterday, oura, ouraYesterday }: OuraHealthHubData) {
  const todaySleepScore = enhanced?.sleep_score ?? oura?.sleep_score ?? null;
  const yesterdaySleepScore = enhancedYesterday?.sleep_score ?? ouraYesterday?.sleep_score ?? null;

  const todayDeep = enhanced?.deep_sleep_hours ?? null;
  const yesterdayDeep = enhancedYesterday?.deep_sleep_hours ?? null;

  const todayHRV = enhanced?.sleep_average_hrv ?? oura?.hrv_avg ?? null;
  const yesterdayHRV = enhancedYesterday?.sleep_average_hrv ?? ouraYesterday?.hrv_avg ?? null;

  const todayRHR = enhanced?.sleep_lowest_heart_rate ?? oura?.rhr_avg ?? null;
  const yesterdayRHR = enhancedYesterday?.sleep_lowest_heart_rate ?? ouraYesterday?.rhr_avg ?? null;

  const formatHM = (h: number | null) => {
    if (h === null || h <= 0) return '--';
    const hrs = Math.floor(h);
    const mins = Math.round((h % 1) * 60);
    return `${hrs}h ${mins}m`;
  };

  const deepDiffMins = (todayDeep !== null && yesterdayDeep !== null)
    ? Math.round((todayDeep - yesterdayDeep) * 60)
    : null;

  const hrvDiff = (todayHRV !== null && yesterdayHRV !== null)
    ? todayHRV - yesterdayHRV
    : null;

  const rhrDiff = (todayRHR !== null && yesterdayRHR !== null)
    ? todayRHR - yesterdayRHR
    : null;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={18} className="text-teal-400" />
          <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">PORÓWNYWARKA NOCY (DZIŚ VS WCZORAJ)</h4>
        </div>
      </div>

      {/* Side by Side Metric Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 space-y-2">
          <p className="text-3xs font-black uppercase tracking-widest text-teal-400">DZIŚ (NOC OSTATNIA)</p>
          <div>
            <p className="text-2xl font-black text-white">{todaySleepScore !== null ? `${todaySleepScore} pkt` : '--'}</p>
            <p className="text-3xs text-slate-300">Głęboki: {formatHM(todayDeep)}</p>
            <p className="text-3xs text-slate-300">
              HRV: {todayHRV !== null ? `${todayHRV} ms` : '--'} | RHR: {todayRHR !== null ? `${todayRHR} bpm` : '--'}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
          <p className="text-3xs font-black uppercase tracking-widest text-slate-400">WCZORAJ</p>
          <div>
            <p className="text-2xl font-black text-slate-300">{yesterdaySleepScore !== null ? `${yesterdaySleepScore} pkt` : '--'}</p>
            <p className="text-3xs text-slate-400">Głęboki: {formatHM(yesterdayDeep)}</p>
            <p className="text-3xs text-slate-400">
              HRV: {yesterdayHRV !== null ? `${yesterdayHRV} ms` : '--'} | RHR: {yesterdayRHR !== null ? `${yesterdayRHR} bpm` : '--'}
            </p>
          </div>
        </div>
      </div>

      {/* Difference Highlights */}
      <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
        <div className="flex justify-between items-center p-2 rounded-xl bg-white/5">
          <span className="text-slate-300 font-medium">Sen Głęboki (Deep)</span>
          <span className={`font-bold flex items-center gap-1 ${deepDiffMins !== null && deepDiffMins >= 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
            {deepDiffMins !== null ? (deepDiffMins >= 0 ? `+${deepDiffMins} min (Poprawa)` : `${deepDiffMins} min`) : '--'}
          </span>
        </div>

        <div className="flex justify-between items-center p-2 rounded-xl bg-white/5">
          <span className="text-slate-300 font-medium">Zmienność Tętna (HRV)</span>
          <span className={`font-bold flex items-center gap-1 ${hrvDiff !== null && hrvDiff >= 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
            {hrvDiff !== null ? (hrvDiff >= 0 ? `+${hrvDiff} ms (Lepsza regeneracja)` : `${hrvDiff} ms`) : '--'}
          </span>
        </div>

        <div className="flex justify-between items-center p-2 rounded-xl bg-white/5">
          <span className="text-slate-300 font-medium">Najniższe Tętno (RHR)</span>
          <span className={`font-bold flex items-center gap-1 ${rhrDiff !== null && rhrDiff <= 0 ? 'text-teal-400' : 'text-slate-400'}`}>
            {rhrDiff !== null ? `${rhrDiff} bpm` : '--'}
          </span>
        </div>
      </div>
    </div>
  );
}
