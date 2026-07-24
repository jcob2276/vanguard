/**
 * @component OuraCircadianClockCard
 * @role 24-Godzinny Zegar Biologiczny (Circadian Rhythm) wyliczany na żywo z bazy nocy i chronotypu użytkownika.
 */
import { Sun, Coffee, Utensils, Moon } from 'lucide-react';
import type { OuraHealthHubData } from './types';

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

export function OuraCircadianClockCard({ ouraHistory }: OuraHealthHubData) {
  const allHistory = ouraHistory ?? [];
  const recent14 = allHistory.slice(-14);

  const midpoints: number[] = [];
  const bedtimes: number[] = [];
  const waketimes: number[] = [];

  for (const r of recent14) {
    if (!r.bedtime_timestamp || !r.bedtime_end_timestamp) continue;
    const s = toWarsawHM(r.bedtime_timestamp);
    const e = toWarsawHM(r.bedtime_end_timestamp);
    const bedDec = decHour(s.h, s.m, true);
    const wakeDec = decHour(e.h, e.m, false);
    const midDec = (bedDec + (bedDec > wakeDec ? wakeDec + 24 : wakeDec)) / 2;
    midpoints.push(midDec % 24);
    bedtimes.push(bedDec % 24);
    waketimes.push(wakeDec % 24);
  }

  const avgMid = midpoints.length > 0 ? midpoints.reduce((a, b) => a + b, 0) / midpoints.length : 4.5;
  const avgBed = bedtimes.length > 0 ? bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length : 23.5;
  const avgWake = waketimes.length > 0 ? waketimes.reduce((a, b) => a + b, 0) / waketimes.length : 7.5;

  const bedStr = decToHHMM(avgBed);
  const wakeStr = decToHHMM(avgWake);

  const getChronotypeLabel = (h: number) => {
    const v = h % 24;
    if (v < 3) return 'Skowronek (bardzo wczesny)';
    if (v < 3.5) return 'Skowronek';
    if (v < 4.5) return 'Neutralny / Zrównoważony';
    if (v < 5.5) return 'Nocna Sowa (późny)';
    return 'Nocna Sowa (bardzo późny)';
  };

  const chronotypeLabel = getChronotypeLabel(avgMid);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl text-white">
      <div className="flex items-center justify-between">
        <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">24H ZEGAR BIOLOGICZNY (CIRCADIAN RHYTHM)</h4>
        <span className="text-3xs font-bold text-sky-400">Chronotyp: {chronotypeLabel}</span>
      </div>

      {/* Circular 24h Dial Graphic */}
      <div className="relative my-2 flex items-center justify-center">
        <svg className="w-56 h-56" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
          {/* Light Window Arc */}
          <path d="M 100 20 A 80 80 0 0 1 156 44" fill="none" stroke="#f59e0b" strokeWidth="12" strokeLinecap="round" />
          {/* Coffee Cutoff Marker */}
          <circle cx="178" cy="115" r="7" fill="#ef4444" />
          {/* Meal Window Arc */}
          <path d="M 178 125 A 80 80 0 0 1 95 180" fill="none" stroke="#10b981" strokeWidth="12" strokeLinecap="round" />
          {/* Melatonin Window Arc */}
          <path d="M 45 156 A 80 80 0 0 1 100 20" fill="none" stroke="#6366f1" strokeWidth="12" strokeLinecap="round" />
        </svg>

        <div className="absolute text-center space-y-0.5">
          <Moon size={24} className="mx-auto text-indigo-400" />
          <span className="text-xs font-black text-white block">{bedStr} → {wakeStr}</span>
          <span className="text-3xs font-bold text-slate-400">Średnie Okno Snu</span>
        </div>
      </div>

      {/* Circadian Windows Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-amber-400 text-3xs uppercase">
            <Sun size={12} /> Światło Słoneczne
          </span>
          <p className="font-extrabold text-white">07:00 – 09:30</p>
          <p className="text-3xs text-slate-400">Pobudzenie kortyzolu</p>
        </div>

        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-rose-400 text-3xs uppercase">
            <Coffee size={12} /> Cutoff Kofeiny
          </span>
          <p className="font-extrabold text-white">Maks. 14:00</p>
          <p className="text-3xs text-slate-400">Ochrona fazy Deep</p>
        </div>

        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-emerald-400 text-3xs uppercase">
            <Utensils size={12} /> Okno Posiłków
          </span>
          <p className="font-extrabold text-white">Do 19:30</p>
          <p className="text-3xs text-slate-400">Koniec trawienia</p>
        </div>

        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="flex items-center gap-1.5 font-bold text-indigo-400 text-3xs uppercase">
            <Moon size={12} /> Melatonina
          </span>
          <p className="font-extrabold text-white">Od 22:30</p>
          <p className="text-3xs text-slate-400">Wyciszenie bio-witalne</p>
        </div>
      </div>
    </div>
  );
}
