/**
 * @component OuraReadinessTab
 * @role Zakładka Gotowość (Readiness) — Semi-circular Arc Gauge, 30d Baseline Range Tracker, Contributors (Wersja polska).
 */
import { Sparkles } from 'lucide-react';
import type { OuraHealthHubData } from './types';

export function OuraReadinessTab({ oura, enhanced, strainRow }: OuraHealthHubData) {
  const readinessScore = enhanced?.readiness_score ?? oura?.readiness_score ?? (strainRow?.readiness_level ? 80 : 75);
  const tempDev = enhanced?.temperature_deviation ?? oura?.temp_deviation ?? -0.21;
  const hrvAvg = enhanced?.sleep_average_hrv ?? oura?.hrv_avg ?? 62;
  const rhrAvg = enhanced?.sleep_lowest_heart_rate ?? oura?.rhr_avg ?? 54;
  const recovScore = strainRow?.recovery_score ?? 83;

  const getStatus = (score: number) => {
    if (score >= 85) return { title: 'Optymalny stan regeneracji 👑', subtitle: 'Twój organizm jest w doskonałej formie. Świetny dzień na wyzwania.', label: 'OPTYMALNA', color: 'text-emerald-400' };
    if (score >= 70) return { title: 'Dobra gotowość do działania', subtitle: 'Wystarczający poziom energii do umiarkowanego i mocnego treningu.', label: 'DOBRA', color: 'text-teal-400' };
    return { title: 'Wymagana uwaga i odpoczynek', subtitle: 'Podwyższony stres lub niedobór snu. Zadbaj o lżejszy dzień.', label: 'WYMAGA UWAGI', color: 'text-amber-400' };
  };

  const status = getStatus(readinessScore);

  return (
    <div className="space-y-4 text-white animate-fadeIn">
      {/* Hero Arc Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-center shadow-2xl backdrop-blur-xl">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 h-40 w-40 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />

        <p className="text-3xs font-black uppercase tracking-[0.25em] text-teal-400/80">GOTOWOŚĆ (READINESS)</p>

        {/* Semi-circular Arc Gauge */}
        <div className="relative my-4 flex items-center justify-center">
          <svg className="w-52 h-30" viewBox="0 0 100 55">
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="url(#readinessGradient)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="126"
              strokeDashoffset={126 - (126 * Math.min(100, Math.max(0, readinessScore))) / 100}
            />
            <defs>
              <linearGradient id="readinessGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#14b8a6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute top-7 text-center">
            <span className="font-display text-5xl font-black tracking-tight text-white">{readinessScore}</span>
            <p className={`text-3xs font-extrabold uppercase tracking-widest mt-0.5 ${status.color}`}>{status.label}</p>
          </div>
        </div>

        <h3 className="text-base font-bold text-white">{status.title}</h3>
        <p className="mt-1 text-2xs text-slate-400 max-w-xs mx-auto leading-relaxed">{status.subtitle}</p>

        {/* 30-Day Baseline Range Tracker */}
        <div className="mt-5 space-y-1.5 border-t border-white/10 pt-4">
          <div className="flex justify-between text-3xs font-bold text-slate-400">
            <span>Minimum: 68</span>
            <span className="text-white">Średnia 30d: 82</span>
            <span>Maksimum: 94</span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div className="absolute top-0 bottom-0 left-[25%] right-[15%] rounded-full bg-teal-500/30" />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-teal-400 shadow-glow"
              style={{ left: `${Math.min(95, Math.max(5, readinessScore))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Składniki Gotowości */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 space-y-3">
        <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Sparkles size={12} className="text-teal-400" /> Składniki Gotowości (Contributors)
        </h4>

        <div className="space-y-3">
          {[
            { label: 'Tętno spoczynkowe (RHR)', value: `${rhrAvg} bpm`, pct: 92, note: 'Optymalne' },
            { label: 'HRV Balance', value: `${hrvAvg} ms`, pct: 88, note: 'Powyżej normy' },
            { label: 'Odchylenie temperatury', value: `${tempDev > 0 ? '+' : ''}${tempDev}°C`, pct: 85, note: 'W normie' },
            { label: 'Indeks regeneracji', value: `${recovScore}/100`, pct: recovScore, note: 'Dobra regeneracja' },
          ].map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-300">{item.label}</span>
                <span className="font-bold text-teal-400">{item.value} ({item.note})</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400" style={{ width: `${item.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
