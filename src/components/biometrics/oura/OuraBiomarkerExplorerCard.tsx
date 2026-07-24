/**
 * @component OuraBiomarkerExplorerCard
 * @role Eksplorator biomarkerów bio-witalnych: VO2Max pobierany w 100% z Zegarka Garmin (Garmin Connect / Intervals.icu).
 */
import { Activity, Heart, Shield, Gauge } from 'lucide-react';
import type { OuraHealthHubData } from './types';

export function OuraBiomarkerExplorerCard({ enhanced, birthDateStr, garminVo2Max, externalVo2Source }: OuraHealthHubData) {
  const vascularAgeDelta = enhanced?.vascular_age ?? null;

  // VO2Max sourced 100% from Garmin Watch (Garmin Connect / Intervals.icu), excluding Oura Ring
  const activeVo2Max = garminVo2Max ?? null;
  const vo2SourceLabel = garminVo2Max !== null
    ? (externalVo2Source ?? 'Zegarek Garmin / Intervals.icu')
    : null;

  const spo2 = enhanced?.spo2_percentage ?? null;
  const tempDev = enhanced?.temperature_deviation ?? null;

  // Compute chronological age dynamically from user's DB profile birth_date
  let chronoAge: number | null = null;

  if (birthDateStr) {
    const birthDate = new Date(birthDateStr);
    if (!isNaN(birthDate.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - birthDate.getFullYear();
      const m = now.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
        age--;
      }
      chronoAge = age;
    }
  }

  const formatVascularAge = (delta: number | null) => {
    if (delta === null) return { text: '--', color: 'text-slate-400', desc: 'Brak odczytu z Oura' };
    if (chronoAge === null) return { text: `${delta > 0 ? `+${delta}` : delta} lat`, color: 'text-teal-400', desc: 'Uzupełnij datę ur. w Ustawieniach' };

    const calcVascularAge = chronoAge + delta;
    if (delta < 0) return { text: `${calcVascularAge} lat (${delta} lat)`, color: 'text-emerald-400', desc: `Młodsze tętnice (wiek bio: ${chronoAge})` };
    if (delta === 0) return { text: `${calcVascularAge} lat (0)`, color: 'text-teal-400', desc: `Optymalna elastyczność (wiek bio: ${chronoAge})` };
    return { text: `${calcVascularAge} lat (+${delta} lat)`, color: 'text-amber-400', desc: `Wymaga obserwacji (wiek bio: ${chronoAge})` };
  };

  const vAgeInfo = formatVascularAge(vascularAgeDelta);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-teal-400" />
          <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">EKSPLORATOR BIOMARKERÓW BIO-WITALNYCH</h4>
        </div>
        <span className="text-3xs font-bold text-slate-400">
          Wiek biologiczny: {chronoAge !== null ? `${chronoAge} lata` : '--'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Wiek Naczyniowy */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-rose-400 text-3xs uppercase">
            <Heart size={14} /> Wiek Naczyniowy
          </span>
          <p className={`text-lg font-black ${vAgeInfo.color}`}>{vAgeInfo.text}</p>
          <p className="text-3xs text-slate-400">{vAgeInfo.desc}</p>
        </div>

        {/* VO2Max (100% Zegarek Garmin / Intervals.icu) */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-teal-400 text-3xs uppercase">
            <Gauge size={14} /> VO2Max (Wydolność)
          </span>
          <p className="text-lg font-black text-white">
            {activeVo2Max !== null ? activeVo2Max : '--'}{' '}
            {activeVo2Max !== null && <span className="text-2xs font-bold text-slate-400">ml/kg/min</span>}
          </p>
          <p className="text-3xs text-slate-400">
            {vo2SourceLabel !== null ? `Zasilane z ${vo2SourceLabel}` : 'Brak odczytu z Zegarka Garmin / Intervals.icu'}
          </p>
        </div>

        {/* SpO2 */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-sky-400 text-3xs uppercase">
            <Activity size={14} /> Saturacja SpO2
          </span>
          <p className="text-lg font-black text-white">{spo2 !== null ? `${spo2}%` : '--'}</p>
          <p className="text-3xs text-slate-400">{spo2 !== null ? 'Nocne dotlenienie krwi' : 'Brak odczytu z Oura'}</p>
        </div>

        {/* Temp Deviation */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-indigo-400 text-3xs uppercase">
            <Shield size={14} /> Odchylenie Temp. Skóry
          </span>
          <p className="text-lg font-black text-white">
            {tempDev !== null ? (tempDev > 0 ? `+${tempDev}°C` : `${tempDev}°C`) : '--'}
          </p>
          <p className="text-3xs text-slate-400">{tempDev !== null ? 'Sygnał odpornościowy' : 'Brak odczytu z Oura'}</p>
        </div>
      </div>
    </div>
  );
}
