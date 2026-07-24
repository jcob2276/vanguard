/**
 * @component OuraRunningPerformanceLabCard
 * @role Dedykowane Centrum Biegowe & Performance Hub (Intervals.icu / Garmin Running).
 *       Prezentuje pełne, bogate wskaźniki z API Intervals.icu: HR Recovery (spadek 60s),
 *       spalone węglowodany (carbs_used), model Banistera (CTL/ATL), próg mleczanowy (LTHR) oraz GAP.
 */
import { useEffect, useState } from 'react';
import { Flame, Heart, Activity, Zap, ArrowDown, Footprints, Award, ShieldCheck, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface RunningActivity {
  strava_id: number;
  name: string | null;
  start_date: string | null;
  distance: number | null;
  moving_time: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  average_speed: number | null;
  raw_data?: any;
}

export function OuraRunningPerformanceLabCard() {
  const [runs, setRuns] = useState<RunningActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRunningActivities() {
      try {
        const { data, error } = await supabase
          .from('strava_activities')
          .select('strava_id, name, start_date, distance, moving_time, average_heartrate, max_heartrate, average_speed, raw_data')
          .eq('source', 'garmin_intervals')
          .order('start_date', { ascending: false })
          .limit(10);

        if (!error && data) {
          setRuns(data);
        }
      } catch (err) {
        console.error('Błąd pobierania aktywności biegowych:', err);
      } finally {
        setLoading(false);
      }
    }

    loadRunningActivities();
  }, []);

  const latestRun = runs.length > 0 ? runs[0] : null;
  const raw = latestRun?.raw_data || {};

  const hrr = raw.icu_hrr?.hrr ?? null;
  const hrrStart = raw.icu_hrr?.start_bpm ?? null;
  const hrrEnd = raw.icu_hrr?.end_bpm ?? null;
  const carbs = raw.carbs_used ?? null;
  const atl = raw.icu_atl ? Math.round(raw.icu_atl) : null;
  const ctl = raw.icu_ctl ? Math.round(raw.icu_ctl) : null;
  const lthr = raw.lthr ?? 175;
  const gapMeterSec = raw.gap ?? null;
  const cadence = raw.average_cadence ? Math.round(raw.average_cadence * 2) : null; // total SPM (left + right)

  const formatPace = (speedMs: number | null) => {
    if (!speedMs || speedMs <= 0) return '--';
    const paceSec = 1000 / speedMs;
    const mins = Math.floor(paceSec / 60);
    const secs = Math.round(paceSec % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const gapPaceStr = gapMeterSec ? formatPace(gapMeterSec) : null;

  return (
    <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 p-5 space-y-4 shadow-2xl text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
            <Activity size={18} />
          </div>
          <div>
            <h4 className="text-3xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
              DEDYKOVANE CENTRUM BIEGOWE <ShieldCheck size={12} className="text-sky-400" />
            </h4>
            <p className="text-xs font-bold text-white">Intervals.icu & Garmin Running Analytics Engine</p>
          </div>
        </div>

        <span className="text-3xs font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
          {runs.length} Biegów z API
        </span>
      </div>

      {/* Grid Głównych Metryk z Ostatniego Biegu */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        {/* HR Recovery 60s */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-emerald-500/30 space-y-1">
          <span className="flex items-center gap-1 text-3xs font-bold text-emerald-400 uppercase">
            <Heart size={12} /> HR Recovery (60s)
          </span>
          <p className="text-lg font-black text-emerald-300">
            {hrr !== null ? `-${hrr} bpm` : '--'}
          </p>
          <p className="text-[10px] text-slate-400">
            {hrrStart && hrrEnd ? `Spadek od ${hrrStart} do ${hrrEnd} bpm` : 'Regeneracja sercowa po biegu'}
          </p>
        </div>

        {/* Spalone Węglowodany */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/30 space-y-1">
          <span className="flex items-center gap-1 text-3xs font-bold text-amber-400 uppercase">
            <Flame size={12} /> Spalone Węgle
          </span>
          <p className="text-lg font-black text-amber-300">
            {carbs !== null ? `${carbs} g` : '--'}
          </p>
          <p className="text-[10px] text-slate-400">Zużycie glikogenu w trakcie biegu</p>
        </div>

        {/* Form & Fatigue Banister (CTL / ATL) */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-purple-500/30 space-y-1">
          <span className="flex items-center gap-1 text-3xs font-bold text-purple-400 uppercase">
            <Zap size={12} /> Model Banistera
          </span>
          <p className="text-lg font-black text-purple-300">
            {ctl !== null && atl !== null ? `CTL ${ctl} · ATL ${atl}` : '--'}
          </p>
          <p className="text-[10px] text-slate-400">Forma (28d) vs Zmęczenie (7d)</p>
        </div>

        {/* Próg Mleczanowy LTHR */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-rose-500/30 space-y-1">
          <span className="flex items-center gap-1 text-3xs font-bold text-rose-400 uppercase">
            <Activity size={12} /> Próg Mleczanowy
          </span>
          <p className="text-lg font-black text-rose-300">{lthr} bpm</p>
          <p className="text-[10px] text-slate-400">Próg LTHR z biegów Garmin</p>
        </div>

        {/* GAP (Grade Adjusted Pace) */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-sky-500/30 space-y-1">
          <span className="flex items-center gap-1 text-3xs font-bold text-sky-400 uppercase">
            <Zap size={12} /> Tempo GAP
          </span>
          <p className="text-lg font-black text-sky-300">
            {gapPaceStr ? `${gapPaceStr} /km` : '--'}
          </p>
          <p className="text-[10px] text-slate-400">Tempo skorygowane o nachylenie</p>
        </div>

        {/* Kadencja */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-teal-500/30 space-y-1">
          <span className="flex items-center gap-1 text-3xs font-bold text-teal-400 uppercase">
            <Footprints size={12} /> Kadencja Biegu
          </span>
          <p className="text-lg font-black text-teal-300">
            {cadence !== null ? `${cadence} spm` : '--'}
          </p>
          <p className="text-[10px] text-slate-400">Kroki na minutę (L+R)</p>
        </div>
      </div>

      {/* Lista Biegów z Intervals.icu */}
      <div className="space-y-2 pt-2">
        <h5 className="text-3xs font-black uppercase tracking-wider text-slate-400">Ostatnie Treningi Biegowe z Intervals.icu API</h5>

        {loading ? (
          <div className="p-4 text-center text-3xs text-slate-400 animate-pulse">Ładowanie biegów...</div>
        ) : runs.length === 0 ? (
          <div className="p-3 text-center text-3xs text-slate-400">Brak biegów z Intervals.icu w bazie.</div>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => {
              const rRaw = r.raw_data || {};
              const distKm = r.distance ? (r.distance / 1000).toFixed(2) : '--';
              const paceStr = formatPace(r.average_speed);
              const rHrr = rRaw.icu_hrr?.hrr ?? null;
              const rCarbs = rRaw.carbs_used ?? null;

              return (
                <div key={r.strava_id} className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <p className="font-bold text-white">{r.name || 'Bieg'}</p>
                    <p className="text-3xs text-slate-400">
                      {r.start_date ? new Date(r.start_date).toLocaleDateString('pl-PL') : ''} · Dystans: <strong className="text-emerald-300">{distKm} km</strong> · Tempo: <strong className="text-white">{paceStr} /km</strong>
                    </p>
                  </div>

                  <div className="text-right space-y-0.5 text-3xs font-semibold">
                    <p className="text-rose-400">Tętno śr: {r.average_heartrate ? `${r.average_heartrate} bpm` : '--'}</p>
                    <p className="text-emerald-300">
                      {rHrr ? `HRR: -${rHrr} bpm` : ''} {rCarbs ? `· Węgle: ${rCarbs}g` : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
