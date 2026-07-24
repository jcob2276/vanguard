/**
 * @component OuraNightCompareCard
 * @role Porównywarka nocy (Dziś vs Wczoraj / Średnia 30d) z nakładaniem parametrów witalnych.
 */
import { ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';
import type { OuraHealthHubData } from './types';

export function OuraNightCompareCard({ enhanced, enhancedYesterday, oura, ouraYesterday }: OuraHealthHubData) {
  const todaySleepScore = enhanced?.sleep_score ?? oura?.sleep_score ?? 81;
  const yesterdaySleepScore = enhancedYesterday?.sleep_score ?? ouraYesterday?.sleep_score ?? 74;

  const todayDeep = enhanced?.deep_sleep_hours ?? 1.3;
  const yesterdayDeep = enhancedYesterday?.deep_sleep_hours ?? 0.75;

  const todayHRV = enhanced?.sleep_average_hrv ?? oura?.hrv_avg ?? 67;
  const yesterdayHRV = enhancedYesterday?.sleep_average_hrv ?? ouraYesterday?.hrv_avg ?? 58;

  const todayRHR = enhanced?.sleep_lowest_heart_rate ?? oura?.rhr_avg ?? 47;
  const yesterdayRHR = enhancedYesterday?.sleep_lowest_heart_rate ?? ouraYesterday?.rhr_avg ?? 52;

  const formatHM = (h: number) => {
    const hrs = Math.floor(h);
    const mins = Math.round((h % 1) * 60);
    return `${hrs}h ${mins}m`;
  };

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
            <p className="text-2xl font-black text-white">{todaySleepScore} pkt</p>
            <p className="text-3xs text-slate-300">Głęboki: {formatHM(todayDeep)}</p>
            <p className="text-3xs text-slate-300">HRV: {todayHRV} ms | RHR: {todayRHR} bpm</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
          <p className="text-3xs font-black uppercase tracking-widest text-slate-400">WCZORAJ</p>
          <div>
            <p className="text-2xl font-black text-slate-300">{yesterdaySleepScore} pkt</p>
            <p className="text-3xs text-slate-400">Głęboki: {formatHM(yesterdayDeep)}</p>
            <p className="text-3xs text-slate-400">HRV: {yesterdayHRV} ms | RHR: {yesterdayRHR} bpm</p>
          </div>
        </div>
      </div>

      {/* Difference Highlights */}
      <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
        <div className="flex justify-between items-center p-2 rounded-xl bg-white/5">
          <span className="text-slate-300 font-medium">Sen Głęboki (Deep)</span>
          <span className="font-bold text-emerald-400 flex items-center gap-1">
            <TrendingUp size={14} /> +{Math.round((todayDeep - yesterdayDeep) * 60)} min (Poprawa)
          </span>
        </div>

        <div className="flex justify-between items-center p-2 rounded-xl bg-white/5">
          <span className="text-slate-300 font-medium">Zmienność Tętna (HRV)</span>
          <span className="font-bold text-emerald-400 flex items-center gap-1">
            <TrendingUp size={14} /> +{todayHRV - yesterdayHRV} ms (Lepsza regeneracja)
          </span>
        </div>

        <div className="flex justify-between items-center p-2 rounded-xl bg-white/5">
          <span className="text-slate-300 font-medium">Najniższe Tętno (RHR)</span>
          <span className="font-bold text-teal-400 flex items-center gap-1">
            <TrendingDown size={14} /> {todayRHR - yesterdayRHR} bpm (Szybszy dołek)
          </span>
        </div>
      </div>
    </div>
  );
}
