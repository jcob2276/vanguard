/**
 * @component OuraSleepDebtCard
 * @role Deficyt snu z sleep_debt_h (daily_strain.components — kanoniczne źródło)
 *       + Zegar Biologiczny z optymalnym oknem opartym na najlepszych nocach (nie chronotypie).
 */
import type { OuraHealthHubData } from './types';
import { parseStrainComponents } from '../../../lib/db-json-guards';
import { Moon, Sun, Target } from 'lucide-react';

const TZ = 'Europe/Warsaw';

function toWarsawHM(iso: string): { h: number; m: number } {
  const [h, m] = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso)).split(':').map(Number);
  return { h, m };
}

/** Decimal hour, wrapping pre-noon hours into "next calendar day" for night math */
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
  // sleep_debt_h < 0 = deficit, > 0 = surplus (engine convention)
  const rawDebt = comp.sleep_debt_h != null ? -comp.sleep_debt_h : null;
  const debtHoursDiff = rawDebt !== null ? Math.max(0, rawDebt) : null;

  const nightsWithData = (ouraHistory ?? []).filter((r) => (r.total_sleep_hours ?? 0) > 0);
  const n = nightsWithData.length;
  const avgSleepDur = n > 0
    ? nightsWithData.reduce((a, r) => a + (r.total_sleep_hours ?? 0), 0) / n
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

  // ── Chronotype: average sleep midpoint (informational) ────────────────────
  const allRows = (ouraHistory ?? []).slice(-14);
  const midpoints: number[] = [];
  const bedtimes: number[] = [];

  for (const r of allRows) {
    if (!r.bedtime_timestamp || !r.bedtime_end_timestamp) continue;
    const s = toWarsawHM(r.bedtime_timestamp);
    const e = toWarsawHM(r.bedtime_end_timestamp);
    const bedDec = decHour(s.h, s.m, true);
    const wakeDec = decHour(e.h, e.m, false);
    const midDec = (bedDec + (bedDec > wakeDec ? wakeDec + 24 : wakeDec)) / 2;
    midpoints.push(midDec % 24);
    bedtimes.push(bedDec % 24);
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

  // ── Best bedtime: avg from top-5 sleep-score nights (prescriptive) ────────
  const sortedBySleep = [...allRows]
    .filter(r => r.sleep_score != null && r.bedtime_timestamp)
    .sort((a, b) => (b.sleep_score ?? 0) - (a.sleep_score ?? 0))
    .slice(0, 5);

  let bestBedStr: string | null = null;
  let bestWakeStr: string | null = null;
  let avgTopScore: number | null = null;
  if (sortedBySleep.length > 0) {
    const bestBeds = sortedBySleep.map(r => {
      const s = toWarsawHM(r.bedtime_timestamp!);
      return decHour(s.h, s.m, true);
    });
    const avgBestBed = bestBeds.reduce((a, b) => a + b, 0) / bestBeds.length;
    bestBedStr = decToHHMM(avgBestBed % 24);
    bestWakeStr = decToHHMM((avgBestBed + avgSleepDur) % 24);
    avgTopScore = Math.round(
      sortedBySleep.reduce((a, r) => a + (r.sleep_score ?? 0), 0) / sortedBySleep.length
    );
  }

  // Gap factors: components that limit sleep score beyond bedtime
  const latencyAvg = nightsWithData.length > 0
    ? nightsWithData.reduce((a, r) => a + (r.latency_minutes ?? 0), 0) / nightsWithData.length
    : null;
  const effAvg = nightsWithData.length > 0
    ? nightsWithData.reduce((a, r) => a + (r.sleep_efficiency ?? 0), 0) / nightsWithData.length
    : null;
  const deepAvg = nightsWithData.length > 0
    ? nightsWithData.reduce((a, r) => a + (r.deep_sleep_hours ?? 0), 0) / nightsWithData.length
    : null;

  // Is late sleeper? midpoint past 04:30 = outside peak regeneration window
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
        <p className="text-3xs font-black uppercase tracking-widest text-slate-400">ZEGAR BIOLOGICZNY</p>

        {chronotype && avgMidStr ? (
          <>
            {/* Chronotype — informacyjny (co robisz), nie normatywny */}
            <div className="flex items-center gap-3">
              <span className="text-3xl">{chronotype.icon}</span>
              <div>
                <p className="text-sm font-black text-white">{chronotype.label}</p>
                <p className="text-3xs text-slate-400">
                  Twój średni środek snu: <span className="text-sky-400 font-bold">{avgMidStr}</span> (z {midpoints.length} nocy)
                </p>
              </div>
            </div>

            {/* Twój aktualny sufit — z najlepszych nocy (co działa), nie z chronotypu */}
            {bestBedStr && bestWakeStr && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-wider text-emerald-400">
                    <Target size={12} /> Twój aktualny sufit (top 5 nocy)
                  </div>
                  {avgTopScore !== null && (
                    <span className="text-3xs font-black text-emerald-300">
                      śr. {avgTopScore}/100 pkt
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Moon size={14} className="text-indigo-400" />
                    <div>
                      <p className="text-3xs text-slate-400">Połóż się spać</p>
                      <p className="text-xl font-black text-indigo-300">{bestBedStr}</p>
                    </div>
                  </div>
                  <div className="text-slate-500 text-lg font-bold">→</div>
                  <div className="flex items-center gap-2">
                    <Sun size={14} className="text-amber-400" />
                    <div>
                      <p className="text-3xs text-slate-400">Wstań</p>
                      <p className="text-xl font-black text-amber-300">{bestWakeStr}</p>
                    </div>
                  </div>
                </div>

                {/* Gap analysis: skąd brakujące ~20 pkt */}
                {avgTopScore !== null && avgTopScore < 90 && (
                  <div className="pt-2 border-t border-white/10 space-y-1.5">
                    <p className="text-3xs font-black text-slate-300 uppercase tracking-wider">
                      Skąd brakujące ~{100 - avgTopScore} pkt do 100:
                    </p>
                    {latencyAvg !== null && latencyAvg > 20 && (
                      <div className="flex justify-between text-3xs">
                        <span className="text-slate-400">⏱ Zasypianie ({latencyAvg.toFixed(0)} min śr.) — cel: &lt;20 min</span>
                        <span className="text-rose-400 font-bold">−pkt</span>
                      </div>
                    )}
                    {effAvg !== null && effAvg < 85 && (
                      <div className="flex justify-between text-3xs">
                        <span className="text-slate-400">📊 Wydajność ({effAvg.toFixed(0)}% śr.) — cel: &gt;85%</span>
                        <span className="text-rose-400 font-bold">−pkt</span>
                      </div>
                    )}
                    {deepAvg !== null && deepAvg < 1.5 && (
                      <div className="flex justify-between text-3xs">
                        <span className="text-slate-400">🌊 Sen głęboki ({deepAvg.toFixed(1)}h śr.) — cel: &gt;1.5h</span>
                        <span className="text-rose-400 font-bold">−pkt</span>
                      </div>
                    )}
                    {isLateSleeper && (
                      <div className="flex justify-between text-3xs">
                        <span className="text-slate-400">🕐 Timing snu (środek {avgMidStr}) — cel: przed 04:00</span>
                        <span className="text-amber-400 font-bold">−pkt</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Ostrzeżenie biologiczne */}
                {isLateSleeper && (
                  <div className="pt-1.5 border-t border-white/10">
                    <p className="text-3xs text-amber-400 font-semibold leading-relaxed">
                      ⚠️ Okno regeneracji 22:00–02:00 — wtedy dominuje sen głęboki i GH. Wcześniejsze kładzenie się spać to największa dźwignia.
                    </p>
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
