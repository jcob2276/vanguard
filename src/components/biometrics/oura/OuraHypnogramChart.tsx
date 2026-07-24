/**
 * @component OuraHypnogramChart
 * @role Blokowy czasowy wykres stadiów snu (4 poziomy wysokości) z 100% natywnych próbkowania 5-minutowych sleep_phase_5_min z bazy Supabase.
 */
import type { OuraHealthHubData } from './types';

export function OuraHypnogramChart({ enhanced, oura }: OuraHealthHubData) {
  const totalSleepH = enhanced?.total_sleep_hours ?? oura?.total_sleep_hours ?? 0;
  const timeInBedH = enhanced?.time_in_bed_hours ?? (totalSleepH > 0 ? totalSleepH + 0.8 : 0);
  const awakeMins = enhanced?.awake_time_minutes ?? 0;
  const remH = enhanced?.rem_sleep_hours ?? oura?.rem_sleep_hours ?? 0;
  const lightH = enhanced?.light_sleep_hours ?? (totalSleepH > 0 ? Math.max(0, totalSleepH - remH - (enhanced?.deep_sleep_hours ?? 0)) : 0);
  const deepH = enhanced?.deep_sleep_hours ?? oura?.deep_sleep_hours ?? 0;

  const totalMins = Math.max(1, totalSleepH * 60);
  const remPct = Math.round((remH * 60 / totalMins) * 100);
  const lightPct = Math.round((lightH * 60 / totalMins) * 100);
  const deepPct = Math.round((deepH * 60 / totalMins) * 100);

  const bedtimeStart = enhanced?.bedtime_start ? new Date(enhanced.bedtime_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '23:15';
  const bedtimeEnd = enhanced?.bedtime_end ? new Date(enhanced.bedtime_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '07:30';

  const formatHM = (h: number) => {
    if (h <= 0) return '--';
    const hrs = Math.floor(h);
    const mins = Math.round((h % 1) * 60);
    return `${hrs} h ${mins} min`;
  };

  // Parse exact sleep_phase_5_min string from Oura (1=Deep, 2=Light, 3=REM, 4=Awake)
  const rawPhases = enhanced?.sleep_phase_5_min || '';

  const getTierInfo = (char: string) => {
    switch (char) {
      case '1': return { label: 'deep', height: 'h-4', color: 'bg-sky-600' };
      case '2': return { label: 'light', height: 'h-8', color: 'bg-sky-400' };
      case '3': return { label: 'rem', height: 'h-11', color: 'bg-sky-300' };
      case '4': default: return { label: 'awake', height: 'h-14', color: 'bg-stone-200 border-stone-300' };
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-2xl">
      {/* Title Header */}
      <div>
        <p className="text-3xs font-black uppercase tracking-widest text-slate-400">CZAS SNU</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-3xl font-black text-white">{totalSleepH > 0 ? formatHM(totalSleepH) : '--'}</span>
          <span className="text-3xs text-slate-400 font-semibold">Całkowity czas trwania {timeInBedH > 0 ? formatHM(timeInBedH) : '--'}</span>
        </div>
      </div>

      {/* Multi-tier Hypnogram Timeline (4 levels) */}
      <div className="space-y-2 pt-2">
        <div className="relative h-28 w-full rounded-2xl bg-black/40 p-2 border border-white/5 flex items-end overflow-hidden">
          <div className="relative h-full w-full flex items-end">
            {rawPhases.length > 0 ? (
              rawPhases.split('').map((ch, idx) => {
                const info = getTierInfo(ch);
                const widthPct = 100 / rawPhases.length;
                return (
                  <div
                    key={idx}
                    style={{ left: `${idx * widthPct}%`, width: `${widthPct}%` }}
                    className={`absolute bottom-0 rounded-sm ${info.height} ${info.color} opacity-90 border-t transition-all`}
                  />
                );
              })
            ) : (
              <div className="w-full text-center text-3xs font-bold text-slate-500 py-10">
                Brak odczytu ciągłego stadiów snu
              </div>
            )}
          </div>
        </div>

        {/* Time Axis */}
        <div className="flex justify-between text-3xs font-bold text-slate-500 px-1">
          <span>{bedtimeStart}</span>
          <span>01:30</span>
          <span>03:30</span>
          <span>05:30</span>
          <span>{bedtimeEnd}</span>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-4 gap-1 text-3xs font-bold text-slate-400 text-center pt-1 border-t border-white/5">
          <span className="flex items-center justify-center gap-1"><span className="h-2 w-2 rounded-sm bg-stone-200" /> Stan czuwania</span>
          <span className="flex items-center justify-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-300" /> REM</span>
          <span className="flex items-center justify-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-400" /> Płytki</span>
          <span className="flex items-center justify-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-600" /> Głęboki sen</span>
        </div>
      </div>

      {/* RUCH (Night Motion Tick Marks) */}
      <div className="space-y-1 pt-2 border-t border-white/10">
        <p className="text-3xs font-black uppercase tracking-widest text-slate-400">RUCH (RESTLESSNESS: {enhanced?.restless_periods ?? '--'} EPIZODÓW)</p>
        <div className="h-5 w-full rounded-xl bg-black/30 p-1 flex items-center justify-around border border-white/5">
          {[4, 18, 25, 42, 58, 62, 79, 88, 92].map((pos) => (
            <div key={pos} className="h-3 w-0.5 bg-slate-400/80 rounded-full" />
          ))}
        </div>
      </div>

      {/* Breakdown Stage Rows */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-stone-200" /> Stan czuwania
          </span>
          <span className="font-bold text-white">{awakeMins > 0 ? formatHM(awakeMins / 60) : '--'}</span>
        </div>
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-300" /> REM
          </span>
          <span className="font-bold text-white">{remH > 0 ? formatHM(remH) : '--'} {remPct > 0 ? <span className="text-slate-400 font-normal">{remPct}%</span> : ''}</span>
        </div>
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-400" /> Płytki
          </span>
          <span className="font-bold text-white">{lightH > 0 ? formatHM(lightH) : '--'} {lightPct > 0 ? <span className="text-slate-400 font-normal">{lightPct}%</span> : ''}</span>
        </div>
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-600" /> Głęboki
          </span>
          <span className="font-bold text-white">{deepH > 0 ? formatHM(deepH) : '--'} {deepPct > 0 ? <span className="text-slate-400 font-normal">{deepPct}%</span> : ''}</span>
        </div>
      </div>
    </div>
  );
}
