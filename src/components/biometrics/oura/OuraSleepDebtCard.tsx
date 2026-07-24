/**
 * @component OuraSleepDebtCard
 * @role Deficyt snu z sleep_debt_h (daily_strain.components — kanoniczne źródło) + Zegar Biologiczny z optymalnym oknem snu.
 */
import type { OuraHealthHubData } from './types';
import { parseStrainComponents } from '../../../lib/db-json-guards';
import { Moon, Sun, Target } from 'lucide-react';

const TZ = 'Europe/Warsaw';

function toWarsawHHMM(iso: string): { h: number; m: number; str: string } {
  const d = new Date(iso);
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(d).split(':').map(Number);
  return { h, m, str: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}

function decimalHour(h: number, m: number, wrapNight = true): number {
  const dec = h + m / 60;
  // Normalize: hours < 12 (0–11) count as "next calendar day" for night chronotype
  return wrapNight && dec < 12 ? dec + 24 : dec;
}

function decimalToHHMM(dec: number): string {
  const wrapped = dec % 24;
  const h = Math.floor(wrapped);
  const m = Math.round((wrapped - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m === 60 ? 0 : m).padStart(2, '0')}`;
}

export function OuraSleepDebtCard({ strainRow, ouraHistory }: OuraHealthHubData) {
  // ── Sleep Debt — z daily_strain.components.sleep_debt_h (kanoniczne źródło, to samo co DailyStrainCard) ──
  const comp = parseStrainComponents(strainRow?.components ?? null) ?? {};
  // sleep_debt_h < 0 oznacza dług (konwencja: ujemny = niedobór), > 0 = nadwyżka
  const rawDebt = comp.sleep_debt_h != null ? -comp.sleep_debt_h : null; // konwersja na dodatni dług
  const debtHoursDiff = rawDebt !== null ? Math.max(0, rawDebt) : null;

  const nightsWithData = (ouraHistory ?? []).filter((r) => (r.total_sleep_hours ?? 0) > 0);
  const n = nightsWithData.length;

  const debtHours = debtHoursDiff !== null ? Math.floor(debtHoursDiff) : null;
  const debtMins = debtHoursDiff !== null ? Math.round((debtHoursDiff % 1) * 60) : null;

  const getDebtStatus = (diff: number) => {
    if (diff <= 1) return { label: 'BRAK DŁUGU', color: 'text-emerald-400', pct: 5, barColor: 'bg-emerald-400' };
    if (diff <= 4) return { label: 'NISKI', color: 'text-teal-400', pct: 35, barColor: 'bg-teal-400' };
    if (diff <= 8) return { label: 'UMIARKOWANE', color: 'text-amber-400', pct: 65, barColor: 'bg-amber-400' };
    return { label: 'WYSOKIE', color: 'text-rose-400', pct: 92, barColor: 'bg-rose-400' };
  };

  const debtStatus = debtHoursDiff !== null ? getDebtStatus(debtHoursDiff) : null;

  // ── Chronotype: Midpoint of Sleep ──────────────────────────────────────────
  const allRows = (ouraHistory ?? []).slice(-14);
  const midpoints: number[] = [];
  const bedtimes: number[] = [];
  const waketimes: number[] = [];

  for (const r of allRows) {
    const start = r.bedtime_timestamp ? new Date(r.bedtime_timestamp).getTime() : null;
    const end = r.bedtime_end_timestamp ? new Date(r.bedtime_end_timestamp).getTime() : null;
    if (!start || !end || end <= start) continue;

    const sw = toWarsawHHMM(r.bedtime_timestamp!);
    const ew = toWarsawHHMM(r.bedtime_end_timestamp!);

    const bedDec = decimalHour(sw.h, sw.m, true);
    const wakeDec = decimalHour(ew.h, ew.m, false);
    const midDec = (bedDec + (bedDec > wakeDec ? wakeDec + 24 : wakeDec)) / 2;

    midpoints.push(midDec % 24);
    bedtimes.push(bedDec % 24);
    waketimes.push(wakeDec);
  }

  const avgMid = midpoints.length > 0 ? midpoints.reduce((a, b) => a + b, 0) / midpoints.length : null;
  const avgBed = bedtimes.length > 0 ? bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length : null;
  const avgWake = waketimes.length > 0 ? waketimes.reduce((a, b) => a + b, 0) / waketimes.length : null;

  const avgMidStr = avgMid !== null ? decimalToHHMM(avgMid) : null;

  // Optimal sleep window = midpoint ± half of avg sleep duration
  const avgSleepDur = n > 0 ? nightsWithData.reduce((a, r) => a + (r.total_sleep_hours ?? 0), 0) / n : 7.5;
  const half = avgSleepDur / 2;

  const optBedDecimal = avgMid !== null ? ((avgMid - half + 24) % 24) : null;
  const optWakeDecimal = avgMid !== null ? ((avgMid + half) % 24) : null;
  const optBedStr = optBedDecimal !== null ? decimalToHHMM(optBedDecimal) : null;
  const optWakeStr = optWakeDecimal !== null ? decimalToHHMM(optWakeDecimal) : null;

  // Best nights: top 5 by sleep score → what bedtime they had
  const sortedBySleep = [...allRows]
    .filter(r => r.sleep_score != null && r.bedtime_timestamp)
    .sort((a, b) => (b.sleep_score ?? 0) - (a.sleep_score ?? 0))
    .slice(0, 5);

  let bestBedStr: string | null = null;
  if (sortedBySleep.length > 0) {
    const bestBeds = sortedBySleep.map(r => {
      const sw = toWarsawHHMM(r.bedtime_timestamp!);
      return decimalHour(sw.h, sw.m, true);
    });
    const avgBestBed = bestBeds.reduce((a, b) => a + b, 0) / bestBeds.length;
    bestBedStr = decimalToHHMM(avgBestBed % 24);
  }

  const getChronotype = (h: number | null) => {
    if (h === null) return null;
    const n = h % 24;
    if (n < 3) return { label: 'Skowronek (bardzo wczesny)', icon: '🌅' };
    if (n < 3.5) return { label: 'Skowronek', icon: '🌤️' };
    if (n < 4.5) return { label: 'Neutralny', icon: '⚖️' };
    if (n < 5.5) return { label: 'Nocna Sowa (późny)', icon: '🦉' };
    return { label: 'Nocna Sowa (bardzo późny)', icon: '🌙' };
  };

  const chronotype = getChronotype(avgMid);

  return (
    <div className="space-y-4">
      {/* Deficyt Snu */}
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
          <p className="text-sm text-slate-400">{n < 3 ? `Za mało danych (${n} nocy) — potrzeba min. 3.` : '--'}</p>
        )}
      </div>

      {/* Zegar Biologiczny */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl">
        <p className="text-3xs font-black uppercase tracking-widest text-slate-400">ZEGAR BIOLOGICZNY</p>

        {chronotype && avgMidStr ? (
          <>
            {/* Chronotype */}
            <div className="flex items-center gap-3">
              <span className="text-3xl">{chronotype.icon}</span>
              <div>
                <p className="text-sm font-black text-white">{chronotype.label}</p>
                <p className="text-3xs text-slate-400">Środek snu: <span className="text-sky-400 font-bold">{avgMidStr}</span> (z {midpoints.length} nocy)</p>
              </div>
            </div>

            {/* Optimal Sleep Window — computed from chronotype */}
            {optBedStr && optWakeStr && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                <div className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-wider text-emerald-400">
                  <Target size={12} /> Optymalne Okno Snu (wyliczone z Twojego chronotypu)
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-white">
                    <Moon size={14} className="text-indigo-400" />
                    <div>
                      <p className="text-3xs text-slate-400">Połóż się spać</p>
                      <p className="text-xl font-black text-indigo-300">{optBedStr}</p>
                    </div>
                  </div>
                  <div className="text-slate-500 text-lg font-bold">→</div>
                  <div className="flex items-center gap-2 text-white">
                    <Sun size={14} className="text-amber-400" />
                    <div>
                      <p className="text-3xs text-slate-400">Wstań</p>
                      <p className="text-xl font-black text-amber-300">{optWakeStr}</p>
                    </div>
                  </div>
                </div>
                <p className="text-3xs text-slate-400 leading-relaxed">
                  Oparte na środku snu {avgMidStr} ± {(avgSleepDur / 2).toFixed(1)}h (śr. {avgSleepDur.toFixed(1)}h snu z {n} nocy)
                </p>
              </div>
            )}

            {/* Best bedtime from actual high-score nights */}
            {bestBedStr && (
              <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20">
                <p className="text-3xs font-black uppercase tracking-wider text-sky-400 mb-1">Najlepsza pora (z Twoich 5 najlepszych nocy)</p>
                <p className="text-sm font-black text-white">Kłaść się spać ok. <span className="text-sky-300">{bestBedStr}</span></p>
                <p className="text-3xs text-slate-400 mt-0.5">
                  Top 5 nocy z najwyższym sleep score miało średnio tę porę zasypiania.
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400">Brak danych — potrzeba min. 1 nocy z godzinami zaśnięcia i przebudzenia.</p>
        )}
      </div>
    </div>
  );
}
