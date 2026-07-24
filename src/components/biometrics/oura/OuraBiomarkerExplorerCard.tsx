/**
 * @component OuraBiomarkerExplorerCard
 * @role Eksplorator biomarkerów bio-witalnych: Wiek Naczyniowy, VO2Max, SpO2 i Odchylenie Temp. Skóry.
 */
import { Activity, Heart, Shield, Gauge } from 'lucide-react';
import type { OuraHealthHubData } from './types';

export function OuraBiomarkerExplorerCard({ enhanced }: OuraHealthHubData) {
  const vascularAge = enhanced?.vascular_age ?? -2;
  const vo2Max = enhanced?.vo2_max ?? 48.5;
  const spo2 = enhanced?.spo2_percentage ?? 98.5;
  const tempDev = enhanced?.temperature_deviation ?? -0.2;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-teal-400" />
          <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">EKSPLORATOR BIOMARKERÓW BIO-WITALNYCH</h4>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Wiek Naczyniowy */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-rose-400 text-3xs uppercase">
            <Heart size={14} /> Wiek Naczyniowy
          </span>
          <p className="text-xl font-black text-white">{vascularAge <= 0 ? `${vascularAge} lat` : `+${vascularAge} lat`}</p>
          <p className="text-3xs text-slate-400">Stan elastyczności tętnic</p>
        </div>

        {/* VO2Max */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-teal-400 text-3xs uppercase">
            <Gauge size={14} /> VO2Max (Wydolność)
          </span>
          <p className="text-xl font-black text-white">{vo2Max} <span className="text-2xs font-bold text-slate-400">ml/kg/min</span></p>
          <p className="text-3xs text-slate-400">Pułap tlenowy organizmu</p>
        </div>

        {/* SpO2 */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-sky-400 text-3xs uppercase">
            <Activity size={14} /> Saturacja SpO2
          </span>
          <p className="text-xl font-black text-white">{spo2}%</p>
          <p className="text-3xs text-slate-400">Nocne dotlenienie krwi</p>
        </div>

        {/* Temp Deviation */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-indigo-400 text-3xs uppercase">
            <Shield size={14} /> Odchylenie Temp. Skóry
          </span>
          <p className="text-xl font-black text-white">{tempDev > 0 ? `+${tempDev}°C` : `${tempDev}°C`}</p>
          <p className="text-3xs text-slate-400">Sygnał odpornościowy</p>
        </div>
      </div>
    </div>
  );
}
