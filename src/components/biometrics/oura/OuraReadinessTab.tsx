/**
 * @component OuraReadinessTab
 * @role Zakładka Gotowość (Readiness) — Odzwierciedla zrzut 1 z polskiej Oura App (Więcej niż myślisz, zakres 0-100).
 */
import { Sparkles } from 'lucide-react';
import type { OuraHealthHubData } from './types';

export function OuraReadinessTab({ oura, enhanced, strainRow }: OuraHealthHubData) {
  const readinessScore = enhanced?.readiness_score ?? oura?.readiness_score ?? (strainRow?.readiness_level ? 89 : 85);
  const tempDev = enhanced?.temperature_deviation ?? oura?.temp_deviation ?? -0.19;
  const hrvAvg = enhanced?.sleep_average_hrv ?? oura?.hrv_avg ?? 67;
  const rhrAvg = enhanced?.sleep_lowest_heart_rate ?? oura?.rhr_avg ?? 47;
  const recovScore = strainRow?.recovery_score ?? 89;

  return (
    <div className="space-y-4 text-white animate-fadeIn">
      {/* Hero Arc Card with Mountain Background */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-center shadow-2xl backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-b from-teal-900/30 via-slate-900/80 to-slate-950 pointer-events-none" />

        <p className="relative z-10 text-3xs font-black uppercase tracking-[0.25em] text-teal-400">GOTOWOŚĆ</p>

        {/* Semi-circular Arc Gauge */}
        <div className="relative my-4 flex items-center justify-center z-10">
          <svg className="w-56 h-32" viewBox="0 0 100 55">
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="url(#readinessGradient)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="126"
              strokeDashoffset={126 - (126 * Math.min(100, Math.max(0, readinessScore))) / 100}
            />
            <defs>
              <linearGradient id="readinessGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute top-8 text-center">
            <span className="font-display text-5xl font-black tracking-tight text-white">{readinessScore}</span>
            <p className="text-3xs font-extrabold uppercase tracking-widest mt-0.5 text-teal-400">GOTOWOŚĆ</p>
          </div>
        </div>

        {/* Polish Advice Quote from Official Oura Screenshot */}
        <div className="relative z-10 space-y-2 mt-2">
          <h3 className="text-2xl font-serif font-bold text-white">Więcej niż myślisz</h3>
          <p className="text-2xs text-slate-300 max-w-sm mx-auto leading-relaxed">
            Mamy świetną wiadomość — Wynik gotowości jest powyżej twojego typowego zakresu. Dzięki temu jesteś w doskonałej formie, aby stawić czoła dniowi z zasobem energii i koncentracji.
          </p>
          <p className="text-3xs font-extrabold text-teal-400 tracking-wide uppercase pt-1">
            Wynik gotowości jest powyżej twojego typowego zakresu
          </p>
        </div>

        {/* Baseline Range Tracker (0, 68, 86, 100) */}
        <div className="relative z-10 mt-5 space-y-1.5 border-t border-white/10 pt-4">
          <div className="flex justify-between text-3xs font-bold text-slate-400">
            <span>0</span>
            <span>68</span>
            <span className="text-white font-black">86</span>
            <span>100</span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div className="absolute top-0 bottom-0 left-[68%] right-[14%] rounded-full bg-teal-500/40" />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-teal-300 shadow-glow"
              style={{ left: `${Math.min(95, Math.max(5, readinessScore))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Składniki Gotowości */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 space-y-3 shadow-xl">
        <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Sparkles size={12} className="text-teal-400" /> Składniki Gotowości (Contributors)
        </h4>

        <div className="space-y-3">
          {[
            { label: 'Tętno spoczynkowe (RHR)', value: `${rhrAvg} bpm`, pct: 94, note: 'Optymalne' },
            { label: 'HRV Balance', value: `${hrvAvg} ms`, pct: 90, note: 'Powyżej normy' },
            { label: 'Odchylenie temperatury', value: `${tempDev > 0 ? '+' : ''}${tempDev}°C`, pct: 88, note: 'W normie' },
            { label: 'Indeks regeneracji', value: `${recovScore}/100`, pct: recovScore, note: 'Dobra regeneracja' },
          ].map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-300">{item.label}</span>
                <span className="font-bold text-teal-400">{item.value} ({item.note})</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-sky-400" style={{ width: `${item.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
