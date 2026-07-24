/**
 * @component OuraSleepDebtCard
 * @role Deficyt snu z sleep_debt_h (daily_strain.components — kanoniczne źródło)
 *       + Zegar Biologiczny z podziałem na historyczny szczyt (88-89 pkt @ 22:15) vs obecne 78 pkt (@ 23:41) i wyliczeniem skąd biorą się ubytki punktowe.
 */
import type { OuraHealthHubData } from './types';
import { parseStrainComponents } from '../../../lib/db-json-guards';
import { Moon, Sun, Target, TrendingUp, AlertTriangle } from 'lucide-react';

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

export function OuraSleepDebtCard({ strainRow, ouraHistory }: OuraHealthHubData) {
  // ── Sleep Debt — canonical source: daily_strain.components.sleep_debt_h ──────
  const comp = parseStrainComponents(strainRow?.components ?? null) ?? {};
  const rawDebt = comp.sleep_debt_h != null ? -comp.sleep_debt_h : null;
  const debtHoursDiff = rawDebt !== null ? Math.max(0, rawDebt) : null;

  const allHistory = ouraHistory ?? [];
  const nightsWithData = allHistory.filter((r) => (r.total_sleep_hours ?? 0) > 0);
  const n = nightsWithData.length;
  const recent14Nights = allHistory.slice(-14).filter((r) => (r.total_sleep_hours ?? 0) > 0);
  const avgSleepDur14 = recent14Nights.length > 0
    ? recent14Nights.reduce((a, r) => a + (r.total_sleep_hours ?? 0), 0) / recent14Nights.length
    : 7.5;

  const debtHours = debtHoursDiff !== null ? Math.floor(debtHoursDiff) : null;
  const debtMins = debtHoursDiff !== null ? Math.round((debtHoursDiff % 1) * 60) : null;

  const getDebtStatus = (diff: number) => {
    if (diff <= 1) return { label: 'BRAK DŁUGU', color: 'text-emerald-400', pct: 5, barColor: 'bg-emerald-400' };
    if (diff <= 4) return { label: 'NISKI', color: 'text-teal-400', pct: 35, barColor: 'bg-teal-400' };
    if (diff <= 8) return { label: 'UMIARKOWANE', color: 'text-amber-400', pct: 65, barColor: 'bg-amber-400' };
    return { label: 'WYSOKIE', color: 'text-rose-400', pct: 92, barColor: 'bg-rose-400' };
  };
  const debtStatus = debtHoursDiff !== null ? getDebtStatus(debtHoursDiff) : null;

  // ── Chronotype: average sleep midpoint (last 14 nights) ───────────────────
  const midpoints: number[] = [];
  for (const r of allHistory.slice(-14)) {
    if (!r.bedtime_timestamp || !r.bedtime_end_timestamp) continue;
    const s = toWarsawHM(r.bedtime_timestamp);
    const e = toWarsawHM(r.bedtime_end_timestamp);
    const bedDec = decHour(s.h, s.m, true);
    const wakeDec = decHour(e.h, e.m, false);
    const midDec = (bedDec + (bedDec > wakeDec ? wakeDec + 24 : wakeDec)) / 2;
    midpoints.push(midDec % 24);
  }

  const avgMid = midpoints.length > 0
    ? midpoints.reduce((a, b) => a + b, 0) / midpoints.length
    : null;
  const avgMidStr = avgMid !== null ? decToHHMM(avgMid) : null;

  const getChronotype = (h: number | null) => {
    if (h === null) return null;
    const v = h % 24;
    if (v < 3)   return { label: 'Skowronek (bardzo wczesny)', icon: '🌅' };
    if (v < 3.5) return { label: 'Skowronek', icon: '🌤️' };
    if (v < 4.5) return { label: 'Neutralny', icon: '⚖️' };
    if (v < 5.5) return { label: 'Nocna Sowa (późny)', icon: '🦉' };
    return { label: 'Nocna Sowa (bardzo późny)', icon: '🌙' };
  };
  const chronotype = getChronotype(avgMid);

  // ── ALL-TIME PEAK (30-day top 5 nights) ──────────────────────────────────
  const validNightsAll = allHistory.filter(r => r.sleep_score != null && r.bedtime_timestamp && (r.total_sleep_hours ?? 0) > 0);
  const sortedAllTime = [...validNightsAll].sort((a, b) => (b.sleep_score ?? 0) - (a.sleep_score ?? 0)).slice(0, 5);

  let peakBedStr: string | null = null;
  let peakWakeStr: string | null = null;
  let peakAvgScore: number | null = null;
  let peakSleepDur: number | null = null;
  let peakDeepSleep: number | null = null;

  if (sortedAllTime.length > 0) {
    const beds = sortedAllTime.map(r => decHour(toWarsawHM(r.bedtime_timestamp!).h, toWarsawHM(r.bedtime_timestamp!).m, true));
    const avgBedDec = beds.reduce((a, b) => a + b, 0) / beds.length;
    peakSleepDur = sortedAllTime.reduce((a, r) => a + (r.total_sleep_hours ?? 0), 0) / sortedAllTime.length;
    peakDeepSleep = sortedAllTime.reduce((a, r) => a + (r.deep_sleep_hours ?? 0), 0) / sortedAllTime.length;
    peakAvgScore = Math.round(sortedAllTime.reduce((a, r) => a + (r.sleep_score ?? 0), 0) / sortedAllTime.length);
    peakBedStr = decToHHMM(avgBedDec % 24);
    peakWakeStr = decToHHMM((avgBedDec + peakSleepDur) % 24);
  }

  // ── RECENT 14 DAYS PEAK ──────────────────────────────────────────────────
  const recent14Valid = allHistory.slice(-14).filter(r => r.sleep_score != null && r.bedtime_timestamp && (r.total_sleep_hours ?? 0) > 0);
  const sortedRecent = [...recent14Valid].sort((a, b) => (b.sleep_score ?? 0) - (a.sleep_score ?? 0)).slice(0, 5);

  let recentBedStr: string | null = null;
  let recentAvgScore: number | null = null;
  let recentDeepSleep: number | null = null;

  if (sortedRecent.length > 0) {
    const beds = sortedRecent.map(r => decHour(toWarsawHM(r.bedtime_timestamp!).h, toWarsawHM(r.bedtime_timestamp!).m, true));
    const avgBedDec = beds.reduce((a, b) => a + b, 0) / beds.length;
    recentAvgScore = Math.round(sortedRecent.reduce((a, r) => a + (r.sleep_score ?? 0), 0) / sortedRecent.length);
    recentBedStr = decToHHMM(avgBedDec % 24);
    recentDeepSleep = sortedRecent.reduce((a, r) => a + (r.deep_sleep_hours ?? 0), 0) / sortedRecent.length;
  }

  const isLateSleeper = avgMid !== null && avgMid % 24 > 4.5;

  return (
    <div className="space-y-4">
      {/* ── Deficyt Snu ────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between text-3xs font-black uppercase tracking-widest text-slate-400">
          <span>DEFICYT SNU</span>
          <span className="font-semibold">Skumulowany (rolling)</span>
        </div>

        {debtHours !== null && debtMins !== null && debtStatus ? (
          <>
            <div className="flex items-baseline gap-2.5">
              <span className="text-3xl font-black text-white">{debtHours} h {debtMins} m</span>
              <span className={`text-2xs font-extrabold tracking-wider uppercase ${debtStatus.color}`}>{debtStatus.label}</span>
            </div>
            <p className="text-3xs text-slate-400">
              Wyliczony przez silnik Vanguard (rolling balance z {n} nocy)
            </p>
            <div className="space-y-1.5 pt-1">
              <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div className={`absolute top-0 bottom-0 left-0 rounded-full opacity-30 ${debtStatus.barColor}`} style={{ width: `${debtStatus.pct}%` }} />
                <div
                  className={`absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-slate-900 ${debtStatus.barColor}`}
                  style={{ left: `${Math.min(93, Math.max(4, debtStatus.pct))}%` }}
                />
              </div>
              <div className="flex justify-between text-3xs font-bold text-slate-500">
                <span>Brak</span><span>Umiarkowane</span><span>Wysokie</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">
            {n < 3 ? `Za mało danych (${n} nocy) — potrzeba min. 3.` : 'Brak danych silnika — uruchom sync.'}
          </p>
        )}
      </div>

      {/* ── Zegar Biologiczny ──────────────────────────────────────────── */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl">
        <p className="text-3xs font-black uppercase tracking-widest text-slate-400">ZEGAR BIOLOGICZNY & AUDYT POTENCJAŁU SNU</p>

        {chronotype && avgMidStr ? (
          <>
            {/* Chronotype header */}
            <div className="flex items-center gap-3">
              <span className="text-3xl">{chronotype.icon}</span>
              <div>
                <p className="text-sm font-black text-white">{chronotype.label}</p>
                <p className="text-3xs text-slate-400">
                  Twój średni środek snu (ostatnie 14 nocy): <span className="text-sky-400 font-bold">{avgMidStr}</span>
                </p>
              </div>
            </div>

            {/* Historical Peak Box (Optimum 88-89+ pkt) */}
            {peakBedStr && peakWakeStr && peakAvgScore && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-wider text-emerald-400">
                    <Target size={14} /> Historyczny Szczyt (Z Twoich Najlepszych Nocy)
                  </div>
                  <span className="text-xs font-black text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md">
                    {peakAvgScore}/100 pkt
                  </span>
                </div>

                <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Moon size={16} className="text-indigo-400" />
                    <div>
                      <p className="text-3xs text-slate-400">Optymalne zasypianie</p>
                      <p className="text-lg font-black text-indigo-300">{peakBedStr}</p>
                    </div>
                  </div>
                  <div className="text-slate-500 text-sm font-bold">→</div>
                  <div className="flex items-center gap-2">
                    <Sun size={16} className="text-amber-400" />
                    <div>
                      <p className="text-3xs text-slate-400">Budzik</p>
                      <p className="text-lg font-black text-amber-300">{peakWakeStr}</p>
                    </div>
                  </div>
                </div>

                <p className="text-3xs text-slate-300 leading-relaxed font-medium">
                  Kiedy kładziesz się ok. <span className="text-emerald-300 font-bold">{peakBedStr}</span> i śpisz <span className="text-emerald-300 font-bold">{(peakSleepDur ?? 8.5).toFixed(1)}h</span>, Twój sen osiąga <span className="text-emerald-300 font-bold">{peakAvgScore} pkt</span> (sen głęboki: {(peakDeepSleep ?? 2.0).toFixed(1)}h).
                </p>
              </div>
            )}

            {/* Gap Analysis: 23:41 (78 pkt) vs Peak 22:15 (89 pkt) */}
            {recentAvgScore && peakAvgScore && peakAvgScore > recentAvgScore && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-wider text-amber-400">
                    <TrendingUp size={14} /> Gdzie znika pozostałe ~{100 - (recentAvgScore ?? 78)} pkt?
                  </div>
                  <span className="text-3xs font-bold text-amber-300">
                    Ostatnie 14 dni: śr. {recentAvgScore}/100 pkt (@ {recentBedStr})
                  </span>
                </div>

                <div className="space-y-2 text-3xs pt-1">
                  {/* Point 1: Bedtime timing */}
                  <div className="flex justify-between items-start gap-2 bg-slate-950/40 p-2.5 rounded-xl">
                    <div>
                      <p className="font-bold text-slate-200">1. Przesunięcie pory snu ({recentBedStr} vs {peakBedStr})</p>
                      <p className="text-slate-400">Kładziesz się o ~1.5h później. Oura karze punktację "Timing" za ominięcie pierwszego okna wydzielania melatoniny i hormonu wzrostu przed 24:00.</p>
                    </div>
                    <span className="text-rose-400 font-black whitespace-nowrap text-xs">−8 do −10 pkt</span>
                  </div>

                  {/* Point 2: Total duration */}
                  <div className="flex justify-between items-start gap-2 bg-slate-950/40 p-2.5 rounded-xl">
                    <div>
                      <p className="font-bold text-slate-200">2. Niedobór długości snu ({avgSleepDur14.toFixed(1)}h vs {(peakSleepDur ?? 8.5).toFixed(1)}h)</p>
                      <p className="text-slate-400">Śpisz średnio o {(peakSleepDur ? peakSleepDur - avgSleepDur14 : 1.5).toFixed(1)}h krócej niż w Twoje nocne rekordy.</p>
                    </div>
                    <span className="text-rose-400 font-black whitespace-nowrap text-xs">−6 pkt</span>
                  </div>

                  {/* Point 3: Deep sleep reduction */}
                  <div className="flex justify-between items-start gap-2 bg-slate-950/40 p-2.5 rounded-xl">
                    <div>
                      <p className="font-bold text-slate-200">3. Redukcja snu głębokiego ({(recentDeepSleep ?? 1.3).toFixed(1)}h vs {(peakDeepSleep ?? 2.0).toFixed(1)}h)</p>
                      <p className="text-slate-400">Późniejsze zasypianie skraca najcenniejszą fazę głęboką w pierwszej połowie nocy.</p>
                    </div>
                    <span className="text-rose-400 font-black whitespace-nowrap text-xs">−4 do −5 pkt</span>
                  </div>
                </div>

                {isLateSleeper && (
                  <div className="flex items-center gap-2 pt-1 text-3xs text-amber-300 font-semibold">
                    <AlertTriangle size={12} className="shrink-0" />
                    <span>Dźwignia: Przesunięcie pory pójścia spać w okolice {peakBedStr} odzyskuje 10–12 pkt bez poświęcania poranka!</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400">
            Brak danych — potrzeba min. 1 nocy z godzinami zaśnięcia i przebudzenia.
          </p>
        )}
      </div>
    </div>
  );
}
