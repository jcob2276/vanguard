/**
 * @component OuraDeepAnalyticsLabCard
 * @role Głębokie Laboratorium Snu (Deep Sleep Analytics Lab) z 7 miesięcy (220 nocy) danych Oura Ring.
 *       Analizuje Social Jetlag, ranking dni tygodnia oraz architekturę faz (Deep / REM ratio).
 */
import type { OuraHealthHubData } from './types';
import { Sparkles, Calendar, Zap, Layers, AlertCircle, CheckCircle2 } from 'lucide-react';

const TZ = 'Europe/Warsaw';

function toWarsawHM(iso: string): { h: number; m: number } {
  const [h, m] = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso)).split(':').map(Number);
  return { h, m };
}

function decHour(h: number, m: number, wrapNight = true): number {
  const d = h + m / 60;
  return wrapNight && d < 12 ? d + 24 : d;
}

function decToHHMM(dec: number): string {
  const w = dec % 24;
  const h = Math.floor(w);
  const m = Math.round((w - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m === 60 ? 0 : m).padStart(2, '0')}`;
}

export function OuraDeepAnalyticsLabCard({ ouraHistory }: OuraHealthHubData) {
  const allHistory = ouraHistory ?? [];
  const validNights = allHistory.filter((r) => r.sleep_score != null && r.bedtime_timestamp && (r.total_sleep_hours ?? 0) > 0);

  if (validNights.length === 0) return null;

  // 1. Social Jetlag (Weekday Nd-Cz vs Weekend Pt-Sob)
  const weekdayMids: number[] = [];
  const weekendMids: number[] = [];
  const dayScores: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const dayHours: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

  for (const r of validNights) {
    if (!r.bedtime_timestamp || !r.bedtime_end_timestamp || !r.date) continue;
    const day = new Date(r.date).getDay();
    if (r.sleep_score != null) dayScores[day].push(r.sleep_score);
    if (r.total_sleep_hours != null) dayHours[day].push(r.total_sleep_hours);

    const s = toWarsawHM(r.bedtime_timestamp);
    const e = toWarsawHM(r.bedtime_end_timestamp);
    const bedDec = decHour(s.h, s.m, true);
    const wakeDec = decHour(e.h, e.m, false);
    const midDec = (bedDec + (bedDec > wakeDec ? wakeDec + 24 : wakeDec)) / 2;

    if (day === 5 || day === 6) weekendMids.push(midDec % 24);
    else weekdayMids.push(midDec % 24);
  }

  const avgWkdayDec = weekdayMids.length ? weekdayMids.reduce((a, b) => a + b, 0) / weekdayMids.length : 0;
  const avgWkendDec = weekendMids.length ? weekendMids.reduce((a, b) => a + b, 0) / weekendMids.length : 0;
  const jetlagMins = Math.round(Math.abs(avgWkendDec - avgWkdayDec) * 60);

  // 2. Days of week ranking
  const daysMap = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
  const dayStats = Object.keys(dayScores).map((dStr) => {
    const d = Number(dStr);
    const scores = dayScores[d];
    const hours = dayHours[d];
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const avgHrs = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;
    return { day: d, name: daysMap[d], count: scores.length, avgScore, avgHrs };
  }).filter((x) => x.count > 0);

  const sortedDays = [...dayStats].sort((a, b) => b.avgScore - a.avgScore);
  const bestDay = sortedDays[0];
  const worstDay = sortedDays[sortedDays.length - 1];

  // 3. Sleep Architecture (Deep vs REM ratios)
  const validEnh = validNights.filter((r) => r.deep_sleep_hours != null && (r.total_sleep_hours ?? 0) > 0);
  const deepPcts = validEnh.map((r) => (r.deep_sleep_hours! / r.total_sleep_hours!) * 100);
  const remPcts = validEnh.filter((r) => r.rem_sleep_hours != null).map((r) => (r.rem_sleep_hours! / r.total_sleep_hours!) * 100);

  const avgDeepPct = deepPcts.length ? Math.round(deepPcts.reduce((a, b) => a + b, 0) / deepPcts.length) : 0;
  const avgRemPct = remPcts.length ? Math.round(remPcts.reduce((a, b) => a + b, 0) / remPcts.length) : 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-2xl text-white">
      <div className="flex items-center justify-between">
        <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Sparkles size={14} className="text-indigo-400 animate-pulse" /> GŁĘBOKIE LABORATORIUM SNU (7 MIESIĘCY)
        </h4>
        <span className="text-3xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 rounded-full">
          {validNights.length} nocy w bazie
        </span>
      </div>

      {/* 1. Social Jetlag Widget */}
      <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-3xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1">
            <Zap size={12} className="text-amber-400" /> Social Jetlag (Przesunięcie Rytmu Nocnego)
          </span>
          <span className={`text-3xs font-bold px-2 py-0.5 rounded-md ${jetlagMins <= 30 ? 'text-emerald-400 bg-emerald-500/20' : 'text-amber-400 bg-amber-500/20'}`}>
            {jetlagMins <= 30 ? 'Doskonały Rytm' : 'Przesunięcie'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 space-y-0.5">
            <p className="text-3xs text-slate-400">Tydzień (Nd–Cz)</p>
            <p className="text-sm font-black text-white">{decToHHMM(avgWkdayDec)} <span className="text-3xs font-normal text-slate-400">(środek)</span></p>
          </div>
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 space-y-0.5">
            <p className="text-3xs text-slate-400">Weekend (Pt–Sob)</p>
            <p className="text-sm font-black text-white">{decToHHMM(avgWkendDec)} <span className="text-3xs font-normal text-slate-400">(środek)</span></p>
          </div>
        </div>

        <p className="text-3xs text-slate-400 leading-relaxed pt-0.5">
          {jetlagMins <= 15 ? (
            <span className="text-emerald-300 font-medium">
              Twój Social Jetlag wynosi zaledwie <strong className="text-white">{jetlagMins} minut</strong> — utrzymujesz wręcz wzorową stabilność dobową w weekendy.
            </span>
          ) : (
            <span className="text-amber-300 font-medium">
              Różnica środka snu w weekend to <strong className="text-white">{jetlagMins} minut</strong>. Warto utrzymać pory zasypiania w weekendy zbliżone do tygodnia.
            </span>
          )}
        </p>
      </div>

      {/* 2. Day-of-Week Ranking Grid */}
      <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-3xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1">
            <Calendar size={12} className="text-sky-400" /> Ranking Nocy wg Dni Tygodnia
          </span>
          {bestDay && worstDay && (
            <span className="text-3xs text-slate-400">
              Szczyt: <strong className="text-emerald-400">{bestDay.name}</strong> · Dołek: <strong className="text-rose-400">{worstDay.name}</strong>
            </span>
          )}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {dayStats.map((item) => {
            const isBest = bestDay && item.day === bestDay.day;
            const isWorst = worstDay && item.day === worstDay.day;
            return (
              <div
                key={item.day}
                className={`p-2 rounded-xl text-center space-y-1 border ${
                  isBest
                    ? 'bg-emerald-500/20 border-emerald-500/40'
                    : isWorst
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-white/5 border-white/5'
                }`}
              >
                <p className="text-3xs font-bold text-slate-400 truncate">{item.name.slice(0, 3)}</p>
                <p className={`text-xs font-black ${isBest ? 'text-emerald-300' : isWorst ? 'text-rose-300' : 'text-white'}`}>
                  {item.avgScore.toFixed(0)}
                </p>
                <p className="text-[9px] text-slate-500">{item.avgHrs.toFixed(1)}h</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Sleep Architecture (Deep vs REM) */}
      <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3">
        <span className="text-3xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1">
          <Layers size={12} className="text-purple-400" /> Architektura Faz Snu (Udział % z 7 Miesięcy)
        </span>

        <div className="grid grid-cols-2 gap-3 text-xs">
          {/* Deep Sleep */}
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
            <div className="flex items-center justify-between text-3xs">
              <span className="font-bold text-emerald-400">Sen Głęboki (Deep)</span>
              <span className="text-emerald-300 font-black">{avgDeepPct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, (avgDeepPct / 25) * 100)}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 leading-normal flex items-center gap-1">
              <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
              <span>Cel: 15–25% · Świetna regeneracja fizyczna</span>
            </p>
          </div>

          {/* REM Sleep */}
          <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-1.5">
            <div className="flex items-center justify-between text-3xs">
              <span className="font-bold text-purple-400">Faza REM</span>
              <span className="text-purple-300 font-black">{avgRemPct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-purple-400" style={{ width: `${Math.min(100, (avgRemPct / 25) * 100)}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 leading-normal flex items-center gap-1">
              <AlertCircle size={10} className="text-amber-400 shrink-0" />
              <span>Cel: 20–25% · Potrzebuje dłuższego porannego snu</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
