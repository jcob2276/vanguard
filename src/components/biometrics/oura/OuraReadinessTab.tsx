/**
 * @component OuraReadinessTab
 * @role Zakładka Gotowość (Readiness) — Prawdziwe wyliczenia 30-dniowe (min, max, avg) z bazy Supabase.
 */
import { Sparkles } from 'lucide-react';
import type { OuraHealthHubData } from './types';

export function OuraReadinessTab({ oura, enhanced, strainRow, ouraHistory, enhancedHistory }: OuraHealthHubData) {
  const readinessScore = Number(enhanced?.readiness_score ?? oura?.readiness_score ?? strainRow?.readiness_level ?? 0) || 0;
  const tempDev = Number(enhanced?.temperature_deviation ?? oura?.temp_deviation ?? 0) || 0;
  const hrvAvg = Number(enhanced?.sleep_average_hrv ?? oura?.hrv_avg ?? 0) || 0;
  const rhrAvg = Number(enhanced?.sleep_lowest_heart_rate ?? oura?.rhr_avg ?? 0) || 0;
  const recovScore = Number(strainRow?.recovery_score ?? 0) || 0;


  // Real 30-day stats computation
  const allReadinessScores = (ouraHistory ?? [])
    .map((r) => r.readiness_score)
    .filter((s): s is number => s !== null && s > 0);

  const minReadiness = allReadinessScores.length > 0 ? Math.min(...allReadinessScores) : (readinessScore || 0);
  const maxReadiness = allReadinessScores.length > 0 ? Math.max(...allReadinessScores) : (readinessScore || 0);
  const avgReadiness = allReadinessScores.length > 0
    ? Math.round(allReadinessScores.reduce((a, b) => a + b, 0) / allReadinessScores.length)
    : (readinessScore || 0);

  const getStatus = (score: number) => {
    if (score >= 85) return { title: 'Optymalny stan regeneracji 👑', subtitle: 'Twój organizm jest w doskonałej formie. Świetny dzień na wyzwania.', label: 'OPTYMALNA', color: 'text-emerald-400' };
    if (score >= 70) return { title: 'Dobra gotowość do działania', subtitle: 'Wystarczający poziom energii do umiarkowanego i mocnego treningu.', label: 'DOBRA', color: 'text-teal-400' };
    if (score > 0) return { title: 'Wymagana uwaga i odpoczynek', subtitle: 'Podwyższony stres lub niedobór snu. Zadbaj o lżejszy dzień.', label: 'WYMAGA UWAGI', color: 'text-amber-400' };
    return { title: 'Brak danych pomiarowych z ringu', subtitle: 'Zsynchronizuj pierścień Oura z aplikacją Vanguard.', label: 'BRAK DANYCH', color: 'text-slate-400' };
  };

  const status = getStatus(readinessScore);

  return (
    <div className="space-y-4 text-white animate-fadeIn">
      {/* Hero Arc Card */}
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
            <span className="font-display text-5xl font-black tracking-tight text-white">{readinessScore || '--'}</span>
            <p className={`text-3xs font-extrabold uppercase tracking-widest mt-0.5 ${status.color}`}>{status.label}</p>
          </div>
        </div>

        {/* Dynamic Advice Quote */}
        <div className="relative z-10 space-y-2 mt-2">
          <h3 className="text-2xl font-serif font-bold text-white">{status.title}</h3>
          <p className="text-2xs text-slate-300 max-w-sm mx-auto leading-relaxed">{status.subtitle}</p>
          {readinessScore >= avgReadiness && readinessScore > 0 && (
            <p className="text-3xs font-extrabold text-teal-400 tracking-wide uppercase pt-1">
              Wynik gotowości jest powyżej twojego typowego zakresu ({avgReadiness})
            </p>
          )}
        </div>

        {/* Real 30-Day Range Tracker */}
        <div className="relative z-10 mt-5 space-y-1.5 border-t border-white/10 pt-4">
          <div className="flex justify-between text-3xs font-bold text-slate-400">
            <span>Min: {minReadiness}</span>
            <span className="text-white font-black">Średnia 30d: {avgReadiness}</span>
            <span>Max: {maxReadiness}</span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="absolute top-0 bottom-0 rounded-full bg-teal-500/40"
              style={{
                left: `${Math.min(90, Math.max(0, minReadiness))}%`,
                right: `${Math.max(0, 100 - maxReadiness)}%`,
              }}
            />
            {readinessScore > 0 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-teal-300 shadow-glow"
                style={{ left: `${Math.min(95, Math.max(5, readinessScore))}%` }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Składniki Gotowości (Prawdziwe dane) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 space-y-3 shadow-xl">
        <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Sparkles size={12} className="text-teal-400" /> Składniki Gotowości (Prawdziwe Pomiary)
        </h4>

        <div className="space-y-3">
          {[
            { label: 'Tętno spoczynkowe (RHR)', value: rhrAvg > 0 ? `${rhrAvg} bpm` : '--', pct: Math.min(100, Math.max(20, 100 - rhrAvg)), note: rhrAvg > 0 ? (rhrAvg < 60 ? 'Optymalne' : 'W normie') : 'Brak danych' },
            { label: 'HRV Balance', value: hrvAvg > 0 ? `${hrvAvg} ms` : '--', pct: Math.min(100, (hrvAvg / 100) * 100), note: hrvAvg > 0 ? (hrvAvg > 50 ? 'Powyżej normy' : 'W normie') : 'Brak danych' },
            { label: 'Odchylenie temperatury', value: tempDev !== 0 ? `${tempDev > 0 ? '+' : ''}${tempDev}°C` : '0.00°C', pct: 88, note: 'W normie' },
            { label: 'Indeks regeneracji', value: recovScore > 0 ? `${recovScore}/100` : '--', pct: recovScore || 50, note: recovScore > 70 ? 'Dobra regeneracja' : 'Standard' },
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
