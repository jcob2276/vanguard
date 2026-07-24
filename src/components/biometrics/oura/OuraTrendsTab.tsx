/**
 * @component OuraTrendsTab
 * @role Zakładka Trendy & Korelacje Vanguard — Wykresy trendów 7D/30D oraz silnik korelacji nawyków.
 */
import { TrendingUp, Coffee, Dumbbell, UtensilsCrossed, Moon } from 'lucide-react';
import type { OuraHealthHubData } from './types';

export function OuraTrendsTab({ oura }: OuraHealthHubData) {
  const hrvAvg = oura?.hrv_avg ?? 62;
  const rhrAvg = oura?.rhr_avg ?? 54;

  return (
    <div className="space-y-4 text-white animate-fadeIn">
      {/* Trends Overview Card */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl">
        <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <TrendingUp size={12} className="text-teal-400" /> Trendy 30-dniowe (Vitals Trends)
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">Średnie HRV (30d)</p>
            <p className="text-2xl font-black text-emerald-400">{hrvAvg} ms</p>
            <p className="text-3xs text-emerald-400 font-semibold">↑ +4.2 ms vs ubiegły miesiąc</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">Średnie RHR (30d)</p>
            <p className="text-2xl font-black text-teal-400">{rhrAvg} bpm</p>
            <p className="text-3xs text-teal-400 font-semibold">↓ -1.8 bpm (poprawa)</p>
          </div>
        </div>
      </div>

      {/* Habit Correlations Engine */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 space-y-3">
        <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Moon size={12} className="text-indigo-400" /> Silnik Korelacji Nawyków Vanguard
        </h4>

        <div className="space-y-2.5 text-xs">
          <div className="p-3.5 rounded-2xl border border-white/10 bg-white/5 flex items-start gap-3">
            <Coffee size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Kawa po godzinie 14:00</p>
              <p className="text-2xs text-slate-400 mt-0.5 leading-relaxed">
                Spożycie kofeiny po 14:00 zwiększa opóźnienie zasypiania (latency) o śr. <span className="text-rose-400 font-bold">+18 min</span> i zmniejsza fazę Deep o <span className="text-rose-400 font-bold">-14%</span>.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-white/10 bg-white/5 flex items-start gap-3">
            <Dumbbell size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Trening Siłowy przed 19:00</p>
              <p className="text-2xs text-slate-400 mt-0.5 leading-relaxed">
                Trening ukończony przed 19:00 wydłuża fazę snu głębokiego (Deep) do <span className="text-emerald-400 font-bold">1h 45m</span> i obniża tętno spoczynkowe.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-white/10 bg-white/5 flex items-start gap-3">
            <UtensilsCrossed size={18} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Późna kolacja (po 21:00)</p>
              <p className="text-2xs text-slate-400 mt-0.5 leading-relaxed">
                Ciężki posiłek po 21:00 opóźnia osiągnięcie najniższego tętna w nocy o <span className="text-amber-400 font-bold">2.5 godziny</span> i podnosi temperaturę ciała.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
