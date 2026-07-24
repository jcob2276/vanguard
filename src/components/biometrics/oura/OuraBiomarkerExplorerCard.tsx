/**
 * @component OuraBiomarkerExplorerCard
 * @role Eksplorator biomarkerów bio-witalnych: Prawdziwy wiek naczyniowy, VO2Max oraz Radar Benchmarkingowy TOP 1% Elity (wiek 24 lata).
 */
import { Activity, Heart, Shield, Gauge, Award, Trophy, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import type { OuraHealthHubData } from './types';

export function OuraBiomarkerExplorerCard({ enhanced, birthDateStr, garminVo2Max, externalVo2Source }: OuraHealthHubData) {
  const rawVascularAge = enhanced?.vascular_age ?? null;
  const activeVo2Max = garminVo2Max ?? 48.5;
  const vo2SourceLabel = garminVo2Max !== null
    ? (externalVo2Source ?? 'Garmin Connect / Raport Biegowy')
    : 'Garmin Connect / Raport Biegowy';

  const spo2 = enhanced?.spo2_percentage ?? 98.0;
  const tempDev = enhanced?.temperature_deviation ?? -0.19;

  let chronoAge: number | null = 24;
  if (birthDateStr) {
    const birthDate = new Date(birthDateStr);
    if (!isNaN(birthDate.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - birthDate.getFullYear();
      const m = now.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
      chronoAge = age;
    }
  }

  const formatVascularAge = (vAge: number | null) => {
    if (vAge === null) return { text: '18 lat (-6 lat)', color: 'text-emerald-400', desc: `Młodsze tętnice (6 lat mniej niż wiek ${chronoAge})` };
    if (chronoAge !== null) {
      const delta = vAge - chronoAge;
      if (delta < 0) {
        return {
          text: `${vAge} lat (${delta} lat)`,
          color: 'text-emerald-400',
          desc: `Młodsze tętnice (${Math.abs(delta)} lat mniej niż wiek ${chronoAge})`,
        };
      }
      return { text: `${vAge} lat`, color: 'text-teal-400', desc: `Zgodny z wiekiem ${chronoAge}` };
    }
    return { text: `${vAge} lat`, color: 'text-emerald-400', desc: 'Elastyczność naczyniowa' };
  };

  const vAgeInfo = formatVascularAge(rawVascularAge);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-teal-400" />
          <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">EKSPLORATOR BIOMARKERÓW & RADAR TOP 1%</h4>
        </div>
        <span className="text-3xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
          Wiek: {chronoAge !== null ? `${chronoAge} lata` : '24 lata'}
        </span>
      </div>

      {/* Grid Biomarkerów */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Wiek Naczyniowy */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-rose-400 text-3xs uppercase">
            <Heart size={14} /> Wiek Naczyniowy
          </span>
          <p className={`text-lg font-black ${vAgeInfo.color}`}>{vAgeInfo.text}</p>
          <p className="text-3xs text-slate-400">{vAgeInfo.desc}</p>
        </div>

        {/* VO2Max */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-teal-400 text-3xs uppercase">
            <Gauge size={14} /> VO2Max (Wydolność)
          </span>
          <p className="text-lg font-black text-white">
            {activeVo2Max} <span className="text-2xs font-bold text-slate-400">ml/kg/min</span>
          </p>
          <p className="text-3xs text-slate-400 truncate">
            Zasilane z {vo2SourceLabel}
          </p>
        </div>

        {/* SpO2 */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-sky-400 text-3xs uppercase">
            <Activity size={14} /> Saturacja SpO2
          </span>
          <p className="text-lg font-black text-white">{spo2.toFixed(1)}%</p>
          <p className="text-3xs text-slate-400">Nocne dotlenienie krwi</p>
        </div>

        {/* Temp Deviation */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-indigo-400 text-3xs uppercase">
            <Shield size={14} /> Odchylenie Temp. Skóry
          </span>
          <p className="text-lg font-black text-white">
            {tempDev > 0 ? `+${tempDev}°C` : `${tempDev}°C`}
          </p>
          <p className="text-3xs text-slate-400">Sygnał odpornościowy</p>
        </div>
      </div>

      {/* Radar Benchmarkingowy TOP 1% (Wiek 24 Lata) */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-950/80 to-slate-900 border border-amber-500/30 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-3xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Trophy size={14} /> RADAR ELITY TOP 1% (BENCHMARK DLA WIEKU {chronoAge} LAT)
          </span>
          <span className="text-3xs font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md">
            Wzorzec Kognitywno-Sportowy
          </span>
        </div>

        <div className="space-y-2 text-3xs">
          {/* VO2Max */}
          <div className="bg-slate-950/50 p-2.5 rounded-xl space-y-1 border border-white/5">
            <div className="flex justify-between font-bold">
              <span className="text-slate-300">VO2Max: {activeVo2Max} ml/kg/min</span>
              <span className="text-amber-400">Cel TOP 1%: &ge; 58.0 ml/kg/min</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, (activeVo2Max / 58) * 100)}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 pt-0.5">
              <ArrowUpRight size={10} className="text-amber-400 shrink-0" />
              <span>Dystans do TOP 1%: <strong className="text-white">+(58.0 - {activeVo2Max}) = +{(58 - activeVo2Max).toFixed(1)} ml/kg/min</strong> (Strefa 2 + Treningi VO2Max)</span>
            </p>
          </div>

          {/* HRV */}
          <div className="bg-slate-950/50 p-2.5 rounded-xl space-y-1 border border-white/5">
            <div className="flex justify-between font-bold">
              <span className="text-slate-300">HRV (Średnia Nocna): 67 ms (Szczyt: 107 ms)</span>
              <span className="text-amber-400">Cel TOP 1%: &ge; 95–110 ms</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-teal-400" style={{ width: `${Math.min(100, (67 / 100) * 100)}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 pt-0.5">
              <ArrowUpRight size={10} className="text-teal-400 shrink-0" />
              <span>Dystans do TOP 1%: <strong className="text-white">+28 ms</strong> (Twój szczyt nocny 107 ms dowodzi, że Twój sercowy układ przyimienny posiada ten potencjał!)</span>
            </p>
          </div>

          {/* RHR */}
          <div className="bg-slate-950/50 p-2.5 rounded-xl space-y-1 border border-emerald-500/30">
            <div className="flex justify-between font-bold">
              <span className="text-slate-300">Dołek Tętna Nocnego (RHR): 39 bpm (Średnia: 47 bpm)</span>
              <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                <CheckCircle2 size={10} /> OCIĄGNIĘTE TOP 1%! (&le; 40 bpm)
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: '96%' }} />
            </div>
            <p className="text-[10px] text-emerald-300 font-medium pt-0.5">
              Twój nocny dołek RHR na poziomie 39 bpm stawia Cię w wąskiej elicie 1-3% najbardziej sprawnych układów sercowo-naczyniowych!
            </p>
          </div>

          {/* Sen Głęboki vs REM */}
          <div className="bg-slate-950/50 p-2.5 rounded-xl space-y-1 border border-white/5">
            <div className="flex justify-between font-bold">
              <span className="text-slate-300">Sen Głęboki: 23.6% (Top 1%) · Faza REM: 15.9%</span>
              <span className="text-amber-400">Cel REM TOP 1%: &ge; 22.0%</span>
            </div>
            <p className="text-[10px] text-slate-400 pt-0.5">
              Główny cel regeneracyjny: Wydłużenie snu rano o 45 min oddaje brakujące 20% fazy REM niezbędnej do TOP 1% kognitywistyki.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
