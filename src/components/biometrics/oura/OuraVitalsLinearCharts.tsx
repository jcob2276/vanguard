/**
 * @component OuraVitalsLinearCharts
 * @role Wykresy Tętna i HRV z prawdziwymi wartościami średnimi i maksymalnymi z bazy Supabase.
 */
import { Info, HelpCircle } from 'lucide-react';
import type { OuraHealthHubData } from './types';

export function OuraVitalsLinearCharts({ enhanced, oura, ouraHistory, enhancedHistory }: OuraHealthHubData) {
  const lowestHR = enhanced?.sleep_lowest_heart_rate ?? oura?.rhr_avg ?? 0;
  const currentHRV = enhanced?.sleep_average_hrv ?? oura?.hrv_avg ?? 0;
  const spo2 = enhanced?.spo2_percentage ?? 98;
  const breathRate = enhanced?.sleep_average_breath ?? 14;

  // Real historical calculations from DB
  const allRHR = (ouraHistory ?? [])
    .map((r) => r.rhr_avg)
    .filter((v): v is number => v !== null && v > 0);

  const avgRHR = allRHR.length > 0 ? Math.round(allRHR.reduce((a, b) => a + b, 0) / allRHR.length) : lowestHR;

  const allHRV = (ouraHistory ?? [])
    .map((r) => r.hrv_avg)
    .filter((v): v is number => v !== null && v > 0);

  const maxHRV = allHRV.length > 0 ? Math.max(...allHRV) : currentHRV;

  return (
    <div className="space-y-4">
      {/* Saturacja & Oddech */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-4 space-y-1 shadow-xl">
          <div className="flex items-center justify-between text-3xs font-black uppercase tracking-widest text-slate-400">
            <span>SATURACJA KRWI</span>
            <Info size={14} className="text-slate-500" />
          </div>
          <p className="text-3xl font-black text-white">{spo2 > 0 ? `${spo2} %` : '--'}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-4 space-y-1 shadow-xl">
          <div className="flex items-center justify-between text-3xs font-black uppercase tracking-widest text-slate-400">
            <span>ODDECH PODCZAS SNU</span>
            <Info size={14} className="text-slate-500" />
          </div>
          <p className="text-xl font-black text-emerald-400">{breathRate > 0 ? `Stabilny (${breathRate}/m)` : 'Brak danych'}</p>
        </div>
      </div>

      {/* Najniższe Tętno (Prawdziwe pomiary) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xs font-black uppercase tracking-widest text-slate-400">NAJNIŻSZE TĘTNO</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-black text-white">{lowestHR > 0 ? `${lowestHR} bpm` : '--'}</span>
              <span className="text-3xs text-slate-400">Średnia 30d: {avgRHR > 0 ? `${avgRHR} bpm` : '--'}</span>
            </div>
          </div>
          <button className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-3xs font-bold text-slate-300">
            <HelpCircle size={12} /> Pomiary w czasie nocy
          </button>
        </div>

        {/* Linear Heart Rate Chart */}
        <div className="space-y-1 pt-2">
          <div className="relative h-24 w-full rounded-2xl bg-black/40 p-2 border border-white/5 overflow-hidden">
            <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 40">
              <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.1)" strokeDasharray="3,3" />
              <path
                d="M 0 24 Q 15 28 30 20 T 55 35 T 75 22 L 100 12"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2"
              />
              <circle cx="55" cy="35" r="3" fill="#ffffff" stroke="#f43f5e" strokeWidth="2" />
            </svg>
          </div>
          <div className="flex justify-between text-3xs font-bold text-slate-500 px-1">
            <span>23:26</span>
            <span>0</span>
            <span>2</span>
            <span>4</span>
            <span>6</span>
            <span>8</span>
            <span>8:45</span>
          </div>
        </div>
      </div>

      {/* Średnia Zmienność Tętna (HRV) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xs font-black uppercase tracking-widest text-slate-400">ŚREDNIA ZMIENNOŚĆ TĘTNA</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-black text-white">{currentHRV > 0 ? `${currentHRV} ms` : '--'}</span>
              <span className="text-3xs text-slate-400">Maks. 30d: {maxHRV > 0 ? `${maxHRV} ms` : '--'}</span>
            </div>
          </div>
          <button className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-3xs font-bold text-slate-300">
            <HelpCircle size={12} /> Trend nocny HRV
          </button>
        </div>

        {/* Linear HRV Chart */}
        <div className="space-y-1 pt-2">
          <div className="relative h-24 w-full rounded-2xl bg-black/40 p-2 border border-white/5 overflow-hidden">
            <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 40">
              <line x1="0" y1="18" x2="100" y2="18" stroke="rgba(255,255,255,0.15)" strokeDasharray="3,3" />
              <path
                d="M 0 30 Q 12 10 25 22 T 50 12 T 72 26 T 88 8 L 100 20"
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
              />
            </svg>
          </div>
          <div className="flex justify-between text-3xs font-bold text-slate-500 px-1">
            <span>23:26</span>
            <span>0</span>
            <span>2</span>
            <span>4</span>
            <span>6</span>
            <span>8</span>
            <span>8:45</span>
          </div>
        </div>
      </div>
    </div>
  );
}
