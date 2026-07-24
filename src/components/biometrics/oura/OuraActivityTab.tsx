/**
 * @component OuraActivityTab
 * @role Zakładka Aktywność (Activity & Strain) — Obciążenie dnia, kalorie aktywne, kroki i minuty w strefach.
 */
import { Activity, Flame, Footprints, Clock } from 'lucide-react';
import type { OuraHealthHubData } from './types';

export function OuraActivityTab({ oura, enhanced, strainRow }: OuraHealthHubData) {
  const strainScore = strainRow?.strain_score ?? 0;
  const activeCals = enhanced?.active_calories ?? oura?.active_calories ?? 262;
  const totalCals = enhanced?.total_calories ?? oura?.total_calories ?? 2484;
  const steps = enhanced?.steps ?? oura?.steps ?? 3541;
  const targetCals = enhanced?.target_calories ?? 550;
  const walkDistKm = enhanced?.equivalent_walking_distance ? (enhanced.equivalent_walking_distance / 1000).toFixed(1) : '2.8';

  const highMins = enhanced?.high_activity_minutes ?? 15;
  const medMins = enhanced?.medium_activity_minutes ?? 42;
  const lowMins = enhanced?.low_activity_minutes ?? 110;
  const sedMins = enhanced?.sedentary_minutes ?? 480;

  return (
    <div className="space-y-4 text-white animate-fadeIn">
      {/* Hero Strain & Calorie Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 p-5 text-center shadow-xl">
        <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />

        <p className="text-3xs font-black uppercase tracking-[0.25em] text-amber-400">OBCIĄŻENIE DNIA (STRAIN)</p>
        <div className="mt-2 flex items-baseline justify-center gap-1">
          <span className="font-display text-5xl font-black text-amber-500">{strainScore}</span>
          <span className="text-sm font-bold text-slate-400">/21</span>
        </div>
        <p className="mt-1 text-xs font-bold text-slate-300">Aktywne kalorie: <span className="text-white">{activeCals} kcal</span> (Całkowite: {totalCals} kcal)</p>

        {/* Calorie Target Bar */}
        <div className="mt-4 space-y-1 text-left">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-400">Cel spalania kalorii</span>
            <span className="font-bold text-white">{activeCals} / {targetCals} kcal</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400" style={{ width: `${Math.min(100, Math.round((activeCals / targetCals) * 100))}%` }} />
          </div>
        </div>
      </div>

      {/* Steps & Distance */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
          <p className="text-3xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Footprints size={12} className="text-amber-400" /> Kroki Dziś
          </p>
          <p className="mt-1 text-base font-black text-white">{steps.toLocaleString()}</p>
          <p className="text-3xs text-slate-400">Cel: 10 000 kroków</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
          <p className="text-3xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Activity size={12} className="text-emerald-400" /> Ekwiwalent Dystansu
          </p>
          <p className="mt-1 text-base font-black text-white">{walkDistKm} km</p>
          <p className="text-3xs text-slate-400">Spacer & Aktywność</p>
        </div>
      </div>

      {/* Zone Minutes Breakdown */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 space-y-3">
        <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Clock size={12} className="text-amber-400" /> Strefy Intensywności Aktywności
        </h4>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2.5 rounded-2xl border border-white/10 bg-white/5">
            <p className="text-3xs font-bold text-rose-400">Wysoka</p>
            <p className="text-sm font-black text-white">{highMins}m</p>
          </div>
          <div className="p-2.5 rounded-2xl border border-white/10 bg-white/5">
            <p className="text-3xs font-bold text-amber-400">Średnia</p>
            <p className="text-sm font-black text-white">{medMins}m</p>
          </div>
          <div className="p-2.5 rounded-2xl border border-white/10 bg-white/5">
            <p className="text-3xs font-bold text-blue-400">Niska</p>
            <p className="text-sm font-black text-white">{lowMins}m</p>
          </div>
          <div className="p-2.5 rounded-2xl border border-white/10 bg-white/5">
            <p className="text-3xs font-bold text-slate-400">Bezruch</p>
            <p className="text-sm font-black text-white">{Math.round(sedMins / 60)}h</p>
          </div>
        </div>
      </div>
    </div>
  );
}
