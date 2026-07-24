/**
 * @component OuraHypnogramChart
 * @role Ciągły, wygładzony czasowy wykres stadiów snu (grupowanie ciągłych segmentów bez przerw i pigułek).
 */
import type { OuraHealthHubData } from './types';

interface GroupedSegment {
  type: '1' | '2' | '3' | '4';
  startIdx: number;
  count: number;
}

export function OuraHypnogramChart({ enhanced, oura }: OuraHealthHubData) {
  const totalSleepH = enhanced?.total_sleep_hours ?? oura?.total_sleep_hours ?? 7.8;
  const timeInBedH = enhanced?.time_in_bed_hours ?? (totalSleepH > 0 ? totalSleepH + 1.5 : 9.3);
  const awakeMins = enhanced?.awake_time_minutes ?? 91;
  const remH = enhanced?.rem_sleep_hours ?? oura?.rem_sleep_hours ?? 1.01;
  const lightH = enhanced?.light_sleep_hours ?? (totalSleepH > 0 ? Math.max(0, totalSleepH - remH - (enhanced?.deep_sleep_hours ?? 1.3)) : 5.46);
  const deepH = enhanced?.deep_sleep_hours ?? oura?.deep_sleep_hours ?? 1.3;

  const totalMins = Math.max(1, totalSleepH * 60);
  const remPct = Math.round((remH * 60 / totalMins) * 100);
  const lightPct = Math.round((lightH * 60 / totalMins) * 100);
  const deepPct = Math.round((deepH * 60 / totalMins) * 100);

  const bedtimeStart = enhanced?.bedtime_start ? new Date(enhanced.bedtime_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '23:26';
  const bedtimeEnd = enhanced?.bedtime_end ? new Date(enhanced.bedtime_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:45';

  const formatHM = (h: number) => {
    if (h <= 0) return '--';
    const hrs = Math.floor(h);
    const mins = Math.round((h % 1) * 60);
    return `${hrs} h ${mins} min`;
  };

  // Raw continuous 5-min string from Oura or proportioned architecture fallback
  let rawPhases = enhanced?.sleep_phase_5_min || '';

  if (!rawPhases || rawPhases.length === 0) {
    const totalBlocks = 80;
    const awakeBlocks = Math.max(2, Math.round((awakeMins / 60 / timeInBedH) * totalBlocks));
    const deepBlocks = Math.max(4, Math.round((deepH / timeInBedH) * totalBlocks));
    const remBlocks = Math.max(4, Math.round((remH / timeInBedH) * totalBlocks));
    const lightBlocks = Math.max(10, totalBlocks - awakeBlocks - deepBlocks - remBlocks);

    const partAwake = Math.max(1, Math.floor(awakeBlocks / 4));

    const arr: string[] = [];
    arr.push(...Array(partAwake).fill('4'));
    arr.push(...Array(Math.floor(lightBlocks / 3)).fill('2'));
    arr.push(...Array(Math.floor(deepBlocks * 0.6)).fill('1'));
    arr.push(...Array(partAwake).fill('4')); // Wybudzenie w nocy 1
    arr.push(...Array(Math.floor(remBlocks * 0.4)).fill('3'));
    arr.push(...Array(Math.floor(lightBlocks / 3)).fill('2'));
    arr.push(...Array(Math.ceil(deepBlocks * 0.4)).fill('1'));
    arr.push(...Array(partAwake).fill('4')); // Wybudzenie w nocy 2
    arr.push(...Array(Math.ceil(remBlocks * 0.6)).fill('3'));
    arr.push(...Array(Math.ceil(lightBlocks / 3)).fill('2'));
    arr.push(...Array(awakeBlocks - 3 * partAwake).fill('4'));

    rawPhases = arr.join('');
  }

  // Group consecutive identical stage characters into continuous segments (NO GAPS / NO PILLS)
  const segments: GroupedSegment[] = [];
  if (rawPhases.length > 0) {
    let currentType = rawPhases[0] as '1' | '2' | '3' | '4';
    let startIdx = 0;
    let count = 1;

    for (let i = 1; i < rawPhases.length; i++) {
      const ch = rawPhases[i] as '1' | '2' | '3' | '4';
      if (ch === currentType) {
        count++;
      } else {
        segments.push({ type: currentType, startIdx, count });
        currentType = ch;
        startIdx = i;
        count = 1;
      }
    }
    segments.push({ type: currentType, startIdx, count });
  }

  const getTierDetails = (type: '1' | '2' | '3' | '4') => {
    switch (type) {
      case '4': return { label: 'Stan czuwania', heightPct: '100%', bg: 'bg-stone-200', border: 'border-stone-300' };
      case '3': return { label: 'REM', heightPct: '75%', bg: 'bg-sky-300', border: 'border-sky-200' };
      case '2': return { label: 'Płytki', heightPct: '50%', bg: 'bg-sky-500', border: 'border-sky-400' };
      case '1': default: return { label: 'Głęboki sen', heightPct: '25%', bg: 'bg-indigo-600', border: 'border-indigo-500' };
    }
  };

  const totalLen = rawPhases.length || 1;

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

      {/* Multi-tier Hypnogram Timeline (Continuous Solid Blocks) */}
      <div className="space-y-2 pt-2">
        <div className="relative h-32 w-full rounded-2xl bg-black/50 p-2 border border-white/5 overflow-hidden">
          <div className="relative h-full w-full">
            {segments.map((seg, idx) => {
              const details = getTierDetails(seg.type);
              const leftPct = (seg.startIdx / totalLen) * 100;
              const widthPct = (seg.count / totalLen) * 100;

              return (
                <div
                  key={idx}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    height: details.heightPct,
                  }}
                  className={`absolute bottom-0 ${details.bg} border-t-2 ${details.border} transition-all`}
                  title={`${details.label}`}
                />
              );
            })}
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
          <span className="flex items-center justify-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-stone-200" /> Stan czuwania</span>
          <span className="flex items-center justify-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sky-300" /> REM</span>
          <span className="flex items-center justify-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> Płytki</span>
          <span className="flex items-center justify-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" /> Głęboki sen</span>
        </div>
      </div>

      {/* RUCH (Night Motion Tick Marks) */}
      <div className="space-y-1 pt-2 border-t border-white/10">
        <p className="text-3xs font-black uppercase tracking-widest text-slate-400">RUCH (RESTLESSNESS: {enhanced?.restless_periods ?? 266} EPIZODÓW)</p>
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
            <span className="h-2.5 w-2.5 rounded-sm bg-stone-200" /> Stan czuwania (Wybudzenia w nocy)
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
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> Płytki
          </span>
          <span className="font-bold text-white">{lightH > 0 ? formatHM(lightH) : '--'} {lightPct > 0 ? <span className="text-slate-400 font-normal">{lightPct}%</span> : ''}</span>
        </div>
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" /> Głęboki
          </span>
          <span className="font-bold text-white">{deepH > 0 ? formatHM(deepH) : '--'} {deepPct > 0 ? <span className="text-slate-400 font-normal">{deepPct}%</span> : ''}</span>
        </div>
      </div>
    </div>
  );
}
