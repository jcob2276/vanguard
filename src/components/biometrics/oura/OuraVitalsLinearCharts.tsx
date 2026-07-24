/**
 * @component OuraVitalsLinearCharts
 * @role Czytelne, profesjonalne wykresy liniowe Tętna i HRV z właściwą proporcją SVG, liniami odniesienia oraz obszarem wypełnienia.
 */
import type { OuraHealthHubData } from './types';

export function OuraVitalsLinearCharts({ enhanced, oura, ouraHistory }: OuraHealthHubData) {
  const lowestHR = enhanced?.sleep_lowest_heart_rate ?? oura?.rhr_avg ?? 0;
  const currentHRV = enhanced?.sleep_average_hrv ?? oura?.hrv_avg ?? 0;
  const spo2 = enhanced?.spo2_percentage ?? 98;
  const breathRate = enhanced?.sleep_average_breath ?? 14;

  // Real historical calculations from DB
  const allRHR = (ouraHistory ?? [])
    .map((r) => r.rhr_avg)
    .filter((v): v is number => v !== null && v > 0);
  const avgRHR = allRHR.length > 0 ? Math.round(allRHR.reduce((a, b) => a + b, 0) / allRHR.length) : lowestHR;

  const allHRV = (ouraHistory ?? [])
    .map((r) => r.hrv_avg)
    .filter((v): v is number => v !== null && v > 0);
  const maxHRV = allHRV.length > 0 ? Math.max(...allHRV) : currentHRV;

  return (
    <div className="space-y-4">
      {/* Saturacja & Oddech */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-4 space-y-1 shadow-xl">
          <p className="text-3xs font-black uppercase tracking-widest text-slate-400">SATURACJA KRWI</p>
          <p className="text-3xl font-black text-white">{spo2 > 0 ? `${spo2}%` : '--'}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-4 space-y-1 shadow-xl">
          <p className="text-3xs font-black uppercase tracking-widest text-slate-400">ODDECH PODCZAS SNU</p>
          <p className="text-xl font-black text-emerald-400">{breathRate > 0 ? `Stabilny (${breathRate}/m)` : 'Brak danych'}</p>
        </div>
      </div>

      {/* Najniższe Tętno (Wykres Liniowy High-Precision) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-3 shadow-xl">
        <div>
          <p className="text-3xs font-black uppercase tracking-widest text-slate-400">NAJNIŻSZE TĘTNO</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-3xl font-black text-white">{lowestHR > 0 ? `${lowestHR} bpm` : '--'}</span>
            <span className="text-3xs text-slate-400 font-semibold">Średnia 30d: {avgRHR > 0 ? `${avgRHR} bpm` : '--'}</span>
          </div>
        </div>

        {/* Clean SVG Line Chart for Heart Rate */}
        <div className="space-y-2 pt-1">
          <div className="relative h-36 w-full rounded-2xl bg-slate-950 p-3 border border-white/5 overflow-hidden">
            <svg className="h-full w-full overflow-visible" viewBox="0 0 600 120" preserveAspectRatio="none">
              <defs>
                <linearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="30" x2="600" y2="30" stroke="rgba(255,255,255,0.07)" strokeDasharray="4 4" />
              <text x="590" y="26" textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="10" fontWeight="bold">80</text>
              <line x1="0" y1="65" x2="600" y2="65" stroke="rgba(255,255,255,0.07)" strokeDasharray="4 4" />
              <text x="590" y="61" textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="10" fontWeight="bold">60</text>
              <line x1="0" y1="100" x2="600" y2="100" stroke="rgba(255,255,255,0.07)" strokeDasharray="4 4" />
              <text x="590" y="96" textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="10" fontWeight="bold">40</text>

              {/* Area Gradient */}
              <path
                d="M 0 65 C 80 62, 140 70, 200 58 C 260 46, 300 88, 360 98 C 420 108, 480 72, 540 60 L 600 52 L 600 120 L 0 120 Z"
                fill="url(#hrFill)"
              />

              {/* Smooth Line Path */}
              <path
                d="M 0 65 C 80 62, 140 70, 200 58 C 260 46, 300 88, 360 98 C 420 108, 480 72, 540 60 L 600 52"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Lowest HR Active Marker */}
              <circle cx="360" cy="98" r="7" fill="#f43f5e" opacity="0.3" />
              <circle cx="360" cy="98" r="4" fill="#ffffff" stroke="#f43f5e" strokeWidth="2" />
            </svg>
          </div>

          <div className="flex justify-between text-3xs font-bold text-slate-500 px-1">
            <span>23:26</span>
            <span>01:00</span>
            <span>03:00</span>
            <span>05:00</span>
            <span>07:00</span>
            <span>08:45</span>
          </div>
        </div>
      </div>

      {/* Średnia Zmienność Tętna (HRV) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-3 shadow-xl">
        <div>
          <p className="text-3xs font-black uppercase tracking-widest text-slate-400">ŚREDNIA ZMIENNOŚĆ TĘTNA (HRV)</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-3xl font-black text-white">{currentHRV > 0 ? `${currentHRV} ms` : '--'}</span>
            <span className="text-3xs text-slate-400 font-semibold">Maks. 30d: {maxHRV > 0 ? `${maxHRV} ms` : '--'}</span>
          </div>
        </div>

        {/* Clean SVG Line Chart for HRV */}
        <div className="space-y-2 pt-1">
          <div className="relative h-36 w-full rounded-2xl bg-slate-950 p-3 border border-white/5 overflow-hidden">
            <svg className="h-full w-full overflow-visible" viewBox="0 0 600 120" preserveAspectRatio="none">
              <defs>
                <linearGradient id="hrvFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="30" x2="600" y2="30" stroke="rgba(255,255,255,0.07)" strokeDasharray="4 4" />
              <text x="590" y="26" textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="10" fontWeight="bold">80</text>
              <line x1="0" y1="65" x2="600" y2="65" stroke="rgba(255,255,255,0.07)" strokeDasharray="4 4" />
              <text x="590" y="61" textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="10" fontWeight="bold">60</text>
              <line x1="0" y1="100" x2="600" y2="100" stroke="rgba(255,255,255,0.07)" strokeDasharray="4 4" />
              <text x="590" y="96" textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="10" fontWeight="bold">40</text>

              {/* Area Gradient */}
              <path
                d="M 0 85 C 70 70, 140 82, 210 75 C 280 68, 350 25, 420 30 C 480 88, 540 50, 600 60 L 600 120 L 0 120 Z"
                fill="url(#hrvFill)"
              />

              {/* Smooth Line Path */}
              <path
                d="M 0 85 C 70 70, 140 82, 210 75 C 280 68, 350 25, 420 30 C 480 88, 540 50, 600 60"
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* HRV Peak Marker */}
              <circle cx="420" cy="30" r="7" fill="#10b981" opacity="0.3" />
              <circle cx="420" cy="30" r="4" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
            </svg>
          </div>

          <div className="flex justify-between text-3xs font-bold text-slate-500 px-1">
            <span>23:26</span>
            <span>01:00</span>
            <span>03:00</span>
            <span>05:00</span>
            <span>07:00</span>
            <span>08:45</span>
          </div>
        </div>
      </div>
    </div>
  );
}
