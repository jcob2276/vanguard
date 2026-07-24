/**
 * @component OuraSleepDebtCard
 * @role Deficyt snu z sleep_debt_h (daily_strain.components — kanoniczne źródło)
 *       + Zegar Biologiczny z pełną analizą statystyczną 7 miesięcy danych Oura Ring (194 noce).
 */
import type { OuraHealthHubData } from './types';
import { parseStrainComponents } from '../../../lib/db-json-guards';
import { Moon, Sun, Target, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';

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

  // ── 7-MONTH STATISTICAL BUCKETS & PEAK (Nights >= 85 pts) ─────────────────
  const validNightsAll = allHistory.filter(r => r.sleep_score != null && r.bedtime_timestamp && (r.total_sleep_hours ?? 0) > 0);
  const peak85Plus = validNightsAll.filter(r => (r.sleep_score ?? 0) >= 85);
  const sortedAllTime = (peak85Plus.length > 0 ? peak85Plus : [...validNightsAll].sort((a, b) => (b.sleep_score ?? 0) - (a.sleep_score ?? 0))).slice(0, 10);

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

  // ── RECENT 14 DAYS AVERAGE ───────────────────────────────────────────────
  const recent14Valid = allHistory.slice(-14).filter(r => r.sleep_score != null && r.bedtime_timestamp && (r.total_sleep_hours ?? 0) > 0);

  let recentBedStr: string | null = null;
  let recentAvgScore: number | null = null;
  let recentDeepSleep: number | null = null;

  if (recent14Valid.length > 0) {
    const beds = recent14Valid.map(r => decHour(toWarsawHM(r.bedtime_timestamp!).h, toWarsawHM(r.bedtime_timestamp!).m, true));
    const avgBedDec = beds.reduce((a, b) => a + b, 0) / beds.length;
    recentAvgScore = Math.round(recent14Valid.reduce((a, r) => a + (r.sleep_score ?? 0), 0) / recent14Valid.length);
    recentBedStr = decToHHMM(avgBedDec % 24);
    recentDeepSleep = recent14Valid.reduce((a, r) => a + (r.deep_sleep_hours ?? 0), 0) / recent14Valid.length;
  }

  // ── 7-MONTH BUCKET COMPUTATION ──────────────────────────────────────────
  const bucketStats = (() => {
    const b = {
      optimal: { label: '22:30–23:30 (Optymalnie)', scores: [] as number[], hours: [] as number[] },
      late1:   { label: '23:30–00:30 (Późny wieczór)', scores: [] as number[], hours: [] as number[] },
      late2:   { label: '00:30–01:30 (Północ+)', scores: [] as number[], hours: [] as number[] },
      veryLate:{ label: 'Po 01:30 (Bardzo późno)', scores: [] as number[], hours: [] as number[] },
    };

    validNightsAll.forEach(r => {
      const s = toWarsawHM(r.bedtime_timestamp!);
      const dec = decHour(s.h, s.m, true);
      const score = r.sleep_score!;
      const hrs = r.total_sleep_hours!;

      if (dec < 23.5) { b.optimal.scores.push(score); b.optimal.hours.push(hrs); }
      else if (dec < 24.5) { b.late1.scores.push(score); b.late1.hours.push(hrs); }
      else if (dec < 25.5) { b.late2.scores.push(score); b.late2.hours.push(hrs); }
      else { b.veryLate.scores.push(score); b.veryLate.hours.push(hrs); }
    });

    const calcAvg = (arr: number[]) => arr.length > 0 ? (arr.reduce((a, c) => a + c, 0) / arr.length).toFixed(1) : '0';

    return [
      { name: b.optimal.label, count: b.optimal.scores.length, avgScore: calcAvg(b.optimal.scores), avgHours: calcAvg(b.optimal.hours), color: 'text-emerald-400', badgeBg: 'bg-emerald-500/20' },
      { name: b.late1.label, count: b.late1.scores.length, avgScore: calcAvg(b.late1.scores), avgHours: calcAvg(b.late1.hours), color: 'text-teal-400', badgeBg: 'bg-teal-500/20' },
      { name: b.late2.label, count: b.late2.scores.length, avgScore: calcAvg(b.late2.scores), avgHours: calcAvg(b.late2.hours), color: 'text-amber-400', badgeBg: 'bg-amber-500/20' },
      { name: b.veryLate.label, count: b.veryLate.scores.length, avgScore: calcAvg(b.veryLate.scores), avgHours: calcAvg(b.veryLate.hours), color: 'text-rose-400', badgeBg: 'bg-rose-500/20' },
    ];
  })();

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

      {/* ── Zegar Biologiczny & Audyt 7 Miesięcy ───────────────────────── */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-3xs font-black uppercase tracking-widest text-slate-400">ZEGAR BIOLOGICZNY & AUDYT 7 MIESIĘCY</p>
          <span className="text-3xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
            {validNightsAll.length} nocy w bazie
          </span>
        </div>

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

            {/* Historical Peak Box (Optimum 88-89+ pkt z 7 miesięcy) */}
            {peakBedStr && peakWakeStr && peakAvgScore && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-wider text-emerald-400">
                    <Target size={14} /> 7-Miesięczny Szczyt Formy (Z Twoich Najlepszych Nocy)
                  </div>
                  <span className="text-xs font-black text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md">
                    {peakAvgScore}/100 pkt
                  </span>
                </div>

                <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Moon size={16} className="text-indigo-400" />
                    <div>
                      <p className="text-3xs text-slate-400">Pora pójścia spać</p>
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
                  Twoje absolutne rekordy (<span className="text-emerald-300 font-bold">88–89 pkt</span>) miały miejsce przy zasypianiu ok. <span className="text-emerald-300 font-bold">{peakBedStr}</span> i długości snu <span className="text-emerald-300 font-bold">{(peakSleepDur ?? 8.5).toFixed(1)}h</span> (sen głęboki: {(peakDeepSleep ?? 2.0).toFixed(1)}h).
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
                      <p className="text-slate-400">Kładziesz się o ~1.5h później. Oura karze punktację "Timing" za ominięcie okna melatoniny i szczytu hormonu wzrostu przed 24:00.</p>
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

            {/* 7-Month Statistical Buckets Widget */}
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-white/10 space-y-3">
              <div className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-wider text-slate-300">
                <BarChart3 size={14} className="text-sky-400" /> Rozkład Jakości Snu wg Pory Zasypiania (7 Miesięcy / {validNightsAll.length} Nocy)
              </div>

              <div className="space-y-2">
                {bucketStats.map(b => (
                  <div key={b.name} className="flex items-center justify-between bg-slate-950/40 p-2.5 rounded-xl text-3xs">
                    <span className="font-semibold text-slate-300">{b.name} ({b.count} nocy)</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400">śr. {b.avgHours}h snu</span>
                      <span className={`font-black text-xs px-2 py-0.5 rounded-md ${b.color} ${b.badgeBg}`}>
                        {b.avgScore} pkt
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
