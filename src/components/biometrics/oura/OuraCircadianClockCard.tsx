/**
 * @component OuraCircadianClockCard
 * @role 24-Godzinny Zegar Biologiczny (Circadian Clock) z okno-światła, cutoff kofeiny i syntezą melatoniny.
 */
import { Sun, Coffee, Utensils, Moon } from 'lucide-react';

export function OuraCircadianClockCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl text-white">
      <div className="flex items-center justify-between">
        <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">24H ZEGAR BIOLOGICZNY (CIRCADIAN RHYTHM)</h4>
        <span className="text-3xs font-bold text-sky-400">Chronotyp: Ranny Ptaszek / Zrównoważony</span>
      </div>

      {/* Circular 24h Dial Graphic */}
      <div className="relative my-2 flex items-center justify-center">
        <svg className="w-56 h-56" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
          {/* Light Window Arc (07:00 - 09:30) */}
          <path d="M 100 20 A 80 80 0 0 1 156 44" fill="none" stroke="#f59e0b" strokeWidth="12" strokeLinecap="round" />
          {/* Coffee Cutoff Marker (14:00) */}
          <circle cx="178" cy="115" r="7" fill="#ef4444" />
          {/* Meal Window Arc (12:00 - 19:30) */}
          <path d="M 178 125 A 80 80 0 0 1 95 180" fill="none" stroke="#10b981" strokeWidth="12" strokeLinecap="round" />
          {/* Melatonin Window Arc (22:30 - 07:00) */}
          <path d="M 45 156 A 80 80 0 0 1 100 20" fill="none" stroke="#6366f1" strokeWidth="12" strokeLinecap="round" />
        </svg>

        <div className="absolute text-center space-y-0.5">
          <Moon size={24} className="mx-auto text-indigo-400" />
          <span className="text-xs font-black text-white block">23:15 → 07:15</span>
          <span className="text-3xs font-bold text-slate-400">Okno Zasypiania</span>
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
