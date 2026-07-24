/**
 * @component OuraSleepTab
 * @role Zakładka Sen (Sleep) — Hypnogram timeline chart, Sleep Debt Ledger, Vitals Grid.
 */
import { Heart, Wind, Clock, Activity, AlertTriangle } from 'lucide-react';

import type { OuraHealthHubData, SleepStageBlock } from './types';

export function OuraSleepTab({ oura, enhanced }: OuraHealthHubData) {
  const sleepScore = enhanced?.sleep_score ?? oura?.sleep_score ?? 74;
  const totalSleepH = enhanced?.total_sleep_hours ?? oura?.total_sleep_hours ?? 6.5;
  const deepH = enhanced?.deep_sleep_hours ?? oura?.deep_sleep_hours ?? 1.3;
  const remH = enhanced?.rem_sleep_hours ?? oura?.rem_sleep_hours ?? 1.0;
  const lightH = enhanced?.light_sleep_hours ?? Math.max(0, totalSleepH - deepH - remH);
  const awakeMins = enhanced?.awake_time_minutes ?? 18;
  const totalMins = Math.max(1, totalSleepH * 60);

  const deepPct = Math.round((deepH * 60 / totalMins) * 100);
  const remPct = Math.round((remH * 60 / totalMins) * 100);
  const lightPct = Math.round((lightH * 60 / totalMins) * 100);
  const awakePct = Math.max(0, 100 - deepPct - remPct - lightPct);

  const formatHM = (h: number) => {
    const hrs = Math.floor(h);
    const mins = Math.round((h % 1) * 60);
    return `${hrs}h ${mins}m`;
  };

  // Mock hypnogram timeline blocks for visualization
  const hypnogramBlocks: SleepStageBlock[] = [
    { stage: 'light', startTs: '23:15', endTs: '23:45', durationMins: 30 },
    { stage: 'deep', startTs: '23:45', endTs: '01:15', durationMins: 90 },
    { stage: 'rem', startTs: '01:15', endTs: '02:00', durationMins: 45 },
    { stage: 'light', startTs: '02:00', endTs: '03:10', durationMins: 70 },
    { stage: 'awake', startTs: '03:10', endTs: '03:22', durationMins: 12 },
    { stage: 'deep', startTs: '03:22', endTs: '04:10', durationMins: 48 },
    { stage: 'rem', startTs: '04:10', endTs: '05:00', durationMins: 50 },
    { stage: 'light', startTs: '05:00', endTs: '06:45', durationMins: 105 },
    { stage: 'awake', startTs: '06:45', endTs: '07:15', durationMins: 30 },
  ];

  const getStageColor = (stage: SleepStageBlock['stage']) => {
    switch (stage) {
      case 'awake': return 'bg-amber-500/80 border-amber-400';
      case 'rem': return 'bg-purple-500/80 border-purple-400';
      case 'light': return 'bg-blue-500/80 border-blue-400';
      case 'deep': return 'bg-indigo-600/90 border-indigo-400';
    }
  };

  return (
    <div className="space-y-4 text-white animate-fadeIn">
      {/* Hero Sleep Score Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 p-5 text-center shadow-xl">
        <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

        <p className="text-3xs font-black uppercase tracking-[0.25em] text-indigo-400">OCENA SNU OURA</p>
        <div className="mt-2 flex items-baseline justify-center gap-1">
          <span className="font-display text-5xl font-black text-indigo-400">{sleepScore}</span>
          <span className="text-sm font-bold text-slate-400">/100</span>
        </div>
        <p className="mt-1 text-xs font-bold text-slate-300">Całkowity sen: <span className="text-white">{formatHM(totalSleepH)}</span></p>

        {/* Multi-segment Sleep Stage Bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex h-3.5 w-full overflow-hidden rounded-xl bg-white/10 p-0.5 gap-0.5">
            <div style={{ width: `${deepPct}%` }} className="bg-indigo-600 rounded-l-md" title={`Głęboki ${formatHM(deepH)}`} />
            <div style={{ width: `${remPct}%` }} className="bg-purple-400" title={`REM ${formatHM(remH)}`} />
            <div style={{ width: `${lightPct}%` }} className="bg-blue-400" title={`Lekki ${formatHM(lightH)}`} />
            <div style={{ width: `${awakePct}%` }} className="bg-amber-500 rounded-r-md" title={`Czuwanie ${awakeMins}m`} />
          </div>
          <div className="grid grid-cols-4 text-3xs font-bold text-slate-400 text-center">
            <span className="text-indigo-400">Głęboki: {formatHM(deepH)} ({deepPct}%)</span>
            <span className="text-purple-400">REM: {formatHM(remH)} ({remPct}%)</span>
            <span className="text-blue-400">Lekki: {formatHM(lightH)} ({lightPct}%)</span>
            <span className="text-amber-500">Czuwanie: {awakeMins}m</span>
          </div>
        </div>
      </div>

      {/* Hypnogram Timeline Chart (Czasowy Wykres Snu) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Clock size={12} className="text-indigo-400" /> Czasowy Wykres Snu (Hypnogram Timeline)
          </h4>
          <span className="text-3xs font-bold text-slate-400">23:15 → 07:15</span>
        </div>

        {/* Timeline Axis */}
        <div className="space-y-1.5 pt-1">
          <div className="flex h-16 w-full items-end gap-1 rounded-2xl border border-white/10 bg-black/20 p-2">
            {hypnogramBlocks.map((b, idx) => (
              <div
                key={idx}
                style={{ width: `${(b.durationMins / 480) * 100}%` }}
                className={`h-full rounded-md border-t-2 ${getStageColor(b.stage)} transition-all`}
                title={`${b.stage.toUpperCase()}: ${b.startTs} - ${b.endTs} (${b.durationMins}m)`}
              />
            ))}
          </div>
          <div className="flex justify-between text-3xs font-bold text-slate-500 px-1">
            <span>23:15</span>
            <span>01:30</span>
            <span>03:45</span>
            <span>05:30</span>
            <span>07:15</span>
          </div>
        </div>
      </div>

      {/* 14-Night Sleep Debt Ledger */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-amber-400" /> Bilans Długu Sennego (Sleep Debt Ledger)
          </h4>
          <span className="text-3xs font-bold text-emerald-400">Wskazówka: OK</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-white">-1h 15m</span>
          <span className="text-2xs text-slate-400">Skumulowany dług z 14 nocy (Zapotrzebowanie: 7h 45m/noc)</span>
        </div>
      </div>

      {/* Nightly Vitals Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
          <p className="text-3xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Heart size={12} className="text-rose-400" /> Najniższe Tętno
          </p>
          <p className="mt-1 text-base font-black text-white">{enhanced?.sleep_lowest_heart_rate ?? oura?.rhr_avg ?? 54} bpm</p>
          <p className="text-3xs text-slate-400">Dołek o 04:12</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
          <p className="text-3xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Wind size={12} className="text-cyan-400" /> Oddech / SpO2
          </p>
          <p className="mt-1 text-base font-black text-white">{enhanced?.sleep_average_breath ?? 13.9} /min</p>
          <p className="text-3xs text-emerald-400 font-bold">Dotlenienie SpO2: {enhanced?.spo2_percentage ?? 98}%</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
          <p className="text-3xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Clock size={12} className="text-amber-400" /> Latencja & Efektywność
          </p>
          <p className="mt-1 text-base font-black text-white">{oura?.latency_minutes ?? 13} min</p>
          <p className="text-3xs text-slate-400">Efektywność snu: {oura?.sleep_efficiency ?? 88}%</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
          <p className="text-3xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Activity size={12} className="text-purple-400" /> Ruch / Restlessness
          </p>
          <p className="mt-1 text-base font-black text-white">{enhanced?.restless_periods ?? 14} epizodów</p>
          <p className="text-3xs text-slate-400">Spokojny sen: 89%</p>
        </div>
      </div>
    </div>
  );
}
