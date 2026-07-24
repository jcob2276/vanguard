/**
 * @component OuraSleepDebtCard
 * @role Sekcja Deficytu Snu (prawdziwy bilans z 14 dni z oura_daily_summary) i Zegar Biologiczny (środek snu z real bedtime data).
 */
import type { OuraHealthHubData } from './types';

export function OuraSleepDebtCard({ ouraHistory, enhancedHistory }: OuraHealthHubData) {
  // Use oura_daily_summary (ouraHistory) — has reliable total_sleep_hours
  const all14 = (ouraHistory ?? []).slice(-14);
  const targetPerNight = 8; // recommended 8h/night

  // Only count nights with actual data to avoid inflating debt when data is missing
  const nightsWithData = all14.filter((r) => (r.total_sleep_hours ?? 0) > 0);
  const n = nightsWithData.length;

  let debtHoursDiff: number | null = null;
  if (n >= 3) {
    const totalSlept = nightsWithData.reduce((acc, r) => acc + (r.total_sleep_hours ?? 0), 0);
    const totalTarget = n * targetPerNight;
    debtHoursDiff = Math.max(0, totalTarget - totalSlept);
  }

  const debtHours = debtHoursDiff !== null ? Math.floor(debtHoursDiff) : null;
  const debtMins = debtHoursDiff !== null ? Math.round((debtHoursDiff % 1) * 60) : null;

  const getStatus = (diff: number) => {
    if (diff <= 1) return { label: 'BRAK DŁUGU', color: 'text-emerald-400', pct: 5, barColor: 'bg-emerald-400' };
    if (diff <= 4) return { label: 'NISKI', color: 'text-teal-400', pct: 35, barColor: 'bg-teal-400' };
    if (diff <= 8) return { label: 'UMIARKOWANE', color: 'text-amber-400', pct: 65, barColor: 'bg-amber-400' };
    return { label: 'WYSOKIE', color: 'text-rose-400', pct: 92, barColor: 'bg-rose-400' };
  };

  const status = debtHoursDiff !== null ? getStatus(debtHoursDiff) : null;

  // Compute real midpoint of sleep from bedtime_start + bedtime_end timestamps
  const enhanced14 = (enhancedHistory ?? []).slice(-14);
  const midpoints: number[] = [];
  for (const r of enhanced14) {
    const start = r.bedtime_start ? new Date(r.bedtime_start).getTime() : null;
    const end = r.bedtime_end ? new Date(r.bedtime_end).getTime() : null;
    if (start && end && end > start) {
      const midMs = (start + end) / 2;
      const midHour = new Date(midMs).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw', hour12: false });
      // Convert to decimal hour (normalize midnight wrap)
      const [h, m] = midHour.split(':').map(Number);
      const decimal = h + m / 60;
      // Normalize night hours: after midnight counts as next day
      midpoints.push(decimal < 12 ? decimal + 24 : decimal);
    }
  }

  const avgMidDecimal = midpoints.length > 0
    ? midpoints.reduce((a, b) => a + b, 0) / midpoints.length
    : null;

  const avgMidStr = avgMidDecimal !== null
    ? `${String(Math.floor(avgMidDecimal % 24)).padStart(2, '0')}:${String(Math.round((avgMidDecimal % 1) * 60)).padStart(2, '0')}`
    : null;

  // Classify chronotype from average midpoint
  const getChronotype = (decHour: number | null) => {
    if (decHour === null) return null;
    const h = decHour % 24;
    if (h < 3) return { label: 'Skowronek (bardzo wczesny)', icon: '🌅', note: 'Środek snu przed 03:00 — silny chronotyp poranny.' };
    if (h < 3.5) return { label: 'Skowronek (wczesny)', icon: '🌤️', note: 'Środek snu 03:00–03:30 — chronotyp poranny.' };
    if (h < 4.5) return { label: 'Neutralny', icon: '⚖️', note: `Środek snu ok. ${avgMidStr} — optymalny zakres chronotypu.` };
    if (h < 5.5) return { label: 'Nocna Sowa (późny)', icon: '🦉', note: `Środek snu ${avgMidStr} — tendencja do późnych godzin.` };
    return { label: 'Nocna Sowa (bardzo późny)', icon: '🌙', note: `Środek snu ${avgMidStr} — opóźniony rytm dobowy. Ogranicz ekspozycję na niebieskie światło po 21:00.` };
  };

  const chronotype = getChronotype(avgMidDecimal);

  return (
    <div className="space-y-4">
      {/* Deficyt Snu (Ostatnie 14 dni) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between text-3xs font-black uppercase tracking-widest text-slate-400">
          <span>DEFICYT SNU</span>
          <span className="text-slate-400 font-semibold">
            Ostatnie 14 dni ({n} nocy z danymi)
          </span>
        </div>

        {debtHours !== null && debtMins !== null && status ? (
          <>
            <div className="flex items-baseline gap-2.5">
              <span className="text-3xl font-black text-white">{debtHours} h {debtMins} m</span>
              <span className={`text-2xs font-extrabold tracking-wider uppercase ${status.color}`}>{status.label}</span>
            </div>
            <p className="text-3xs text-slate-400">
              {nightsWithData.length} nocy × {targetPerNight}h cel = {nightsWithData.length * targetPerNight}h celu, spałeś {(nightsWithData.reduce((a, r) => a + (r.total_sleep_hours ?? 0), 0)).toFixed(1)}h łącznie
            </p>

            {/* 4-Stage Track Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="absolute top-0 bottom-0 left-0 bg-teal-500/30 rounded-full" style={{ width: `${status.pct}%` }} />
                <div
                  className={`absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-slate-900 ${status.barColor} shadow-glow`}
                  style={{ left: `${Math.min(93, Math.max(4, status.pct))}%` }}
                />
              </div>
              <div className="flex justify-between text-3xs font-bold text-slate-500">
                <span>Brak</span>
                <span>Umiarkowane</span>
                <span>Wysokie</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">
            {n < 3 ? `Za mało danych (${n} nocy) — potrzeba min. 3 nocy z odczytem.` : '--'}
          </p>
        )}
      </div>

      {/* Zegar Biologiczny (realny chronotyp z danych) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-3 shadow-xl">
        <p className="text-3xs font-black uppercase tracking-widest text-slate-400">ZEGAR BIOLOGICZNY</p>

        {chronotype !== null && avgMidStr !== null ? (
          <>
            <div className="flex items-center gap-3 py-1">
              <span className="text-3xl">{chronotype.icon}</span>
              <div>
                <p className="text-sm font-black text-white">{chronotype.label}</p>
                <p className="text-3xs text-slate-400">Średni środek snu: <span className="text-sky-400 font-bold">{avgMidStr}</span> (z {midpoints.length} nocy)</p>
              </div>
            </div>
            <p className="text-2xs text-slate-300 leading-relaxed font-medium">
              {chronotype.note}
            </p>
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
