import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Activity, AlertTriangle, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function fmtPace(secPerKm) {
  if (!secPerKm) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

function fmtTime(sec) {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function HRBadge({ source, frozen }) {
  if (!source) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
      frozen
        ? 'bg-yellow-500/15 text-yellow-400'
        : source === 'strava'
        ? 'bg-blue-500/15 text-blue-400'
        : 'bg-violet-500/15 text-violet-400'
    }`}>
      {frozen && <AlertTriangle size={9} />}
      {frozen ? 'sensor lock' : source}
    </span>
  );
}

function SplitsTable({ splits }) {
  if (!splits || splits.length === 0) return null;
  // Show GAP column only if this activity has any grade-adjusted data at all
  const hasGap = splits.some(s => s.average_grade_adjusted_speed != null);
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-white/5">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-white/5 text-white/30">
            <th className="px-3 py-1.5 text-left font-black uppercase tracking-widest">km</th>
            <th className="px-3 py-1.5 text-right font-black uppercase tracking-widest">Clock</th>
            {hasGap && <th className="px-3 py-1.5 text-right font-black uppercase tracking-widest text-white/20">GAP</th>}
            <th className="px-3 py-1.5 text-right font-black uppercase tracking-widest">HR</th>
            <th className="px-3 py-1.5 text-right font-black uppercase tracking-widest">Elev</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((s, i) => {
            const clockSec = s.moving_time && s.distance
              ? Math.round(s.moving_time / (s.distance / 1000))
              : s.average_speed ? Math.round(1000 / s.average_speed) : null;
            const gapSec = s.average_grade_adjusted_speed
              ? Math.round(1000 / s.average_grade_adjusted_speed) : null;
            const pace = clockSec ? fmtPace(clockSec) : '—';
            const hr   = s.average_heartrate ? Math.round(s.average_heartrate) : null;
            const elev = s.elevation_difference != null
              ? `${s.elevation_difference >= 0 ? '+' : ''}${s.elevation_difference.toFixed(1)}m`
              : '—';
            const pause = (s.elapsed_time || 0) - (s.moving_time || 0);
            return (
              <tr key={i} className={`border-b border-white/[0.03] ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}>
                <td className="px-3 py-1.5 font-black text-white/60">{s.split}</td>
                <td className="px-3 py-1.5 text-right font-mono font-bold text-white/90">
                  {pace}
                  {pause > 20 && <span className="ml-1 text-white/30">⏸{fmtTime(pause)}</span>}
                </td>
                {hasGap && (
                  <td className="px-3 py-1.5 text-right font-mono text-white/40">
                    {gapSec ? fmtPace(gapSec) : '—'}
                  </td>
                )}
                <td className={`px-3 py-1.5 text-right font-mono font-bold ${hr ? 'text-red-400' : 'text-white/25'}`}>
                  {hr ?? '—'}
                </td>
                <td className={`px-3 py-1.5 text-right font-mono ${
                  s.elevation_difference > 0 ? 'text-green-400/70' : s.elevation_difference < 0 ? 'text-blue-400/70' : 'text-white/25'
                }`}>
                  {elev}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ActivityCard({ activity, ouraPreRun, ouraPostRun }) {
  const [open, setOpen] = useState(false);

  const distKm   = activity.distance ? (activity.distance / 1000).toFixed(2) : '—';
  const pace     = fmtPace(activity.pace_sec_per_km);
  const moving   = fmtTime(activity.moving_time);
  const cadence  = activity.cadence_spm;
  const elev     = activity.total_elevation_gain;
  const rpe      = activity.perceived_exertion;
  const hrAvg    = activity.hr_avg ? Math.round(activity.hr_avg) : null;
  const hrMax    = activity.hr_max ? Math.round(activity.hr_max) : null;
  const hasPR    = activity.has_pr;
  const splits   = activity.splits_with_hr;

  const preHrv   = ouraPreRun?.hrv_avg  ? Math.round(ouraPreRun.hrv_avg)  : null;
  const postHrv  = ouraPostRun?.hrv_avg ? Math.round(ouraPostRun.hrv_avg) : null;
  const hrvDelta = (preHrv && postHrv) ? postHrv - preHrv : null;

  return (
    <div className="rounded-2xl border border-white/5 bg-neutral-950/70 overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/30">
              {fmtDate(activity.start_date)}
            </p>
            <p className="mt-0.5 text-sm font-black text-white">
              {activity.name}
              {hasPR && <span className="ml-2 text-[9px] text-yellow-400">🏆 PR</span>}
            </p>
            {activity.gear_name && (
              <p className="text-[9px] text-white/30 mt-0.5">{activity.gear_name} · {activity.gear_distance_km?.toFixed(0)} km</p>
            )}
          </div>
          <HRBadge source={activity.hr_source} frozen={activity.hr_frozen} />
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Dystans', value: `${distKm} km` },
            { label: 'Tempo',   value: pace },
            { label: 'Czas',    value: moving },
            { label: 'Kadencja', value: cadence ? `${cadence} spm` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-white/[0.03] p-2 text-center">
              <p className="text-[7px] font-black uppercase tracking-widest text-white/30">{label}</p>
              <p className="mt-0.5 text-[11px] font-black text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* HR + extra row */}
        {(hrAvg || elev || rpe) && (
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-white/50">
            {hrAvg && (
              <span className="text-red-400/80">
                ❤️ {hrAvg}{hrMax ? `/${hrMax}` : ''} bpm
                {activity.hr_frozen && <span className="ml-1 text-yellow-400">⚠️</span>}
              </span>
            )}
            {elev != null && <span>↑{elev}m</span>}
            {rpe && <span>RPE {rpe}/10</span>}
            {activity.pause_seconds > 30 && <span className="text-white/30">⏸ {fmtTime(activity.pause_seconds)}</span>}
          </div>
        )}

        {/* HRV context from Oura */}
        {(preHrv || postHrv) && (
          <div className="mt-2 flex items-center gap-2 text-[10px]">
            <span className="text-white/25 font-black uppercase tracking-wider text-[8px]">HRV</span>
            {preHrv && (
              <span className="text-violet-400/80">
                przed {preHrv} ms
              </span>
            )}
            {preHrv && postHrv && <span className="text-white/20">→</span>}
            {postHrv && (
              <span className="text-violet-400/80">
                po {postHrv} ms
              </span>
            )}
            {hrvDelta !== null && (
              <span className={`text-[9px] font-black ${hrvDelta >= 0 ? 'text-green-400/70' : 'text-red-400/60'}`}>
                ({hrvDelta >= 0 ? '+' : ''}{hrvDelta})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expandable splits */}
      {splits && splits.length > 0 && (
        <>
          <button
            onClick={() => setOpen(o => !o)}
            className="flex w-full items-center justify-between border-t border-white/5 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white/30 transition-colors hover:text-white/60"
          >
            <span>Splity ({splits.length} km)</span>
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {open && (
            <div className="px-3 pb-3">
              <SplitsTable splits={splits} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function StravaWidget({ session }) {
  const [activities, setActivities] = useState([]);
  const [ouraMap, setOuraMap]       = useState({});  // date → {hrv_avg, rhr_avg}
  const [syncing, setSyncing]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [lastSync, setLastSync]     = useState(null);
  const [error, setError]           = useState(null);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('strava_activities_clean')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_oura', false)
        .order('start_date', { ascending: false })
        .limit(5);

      if (err) throw err;
      const acts = data || [];
      setActivities(acts);

      // Fetch Oura HRV for the dates of these activities (+1 day for post-run)
      if (acts.length > 0) {
        const dates = new Set();
        acts.forEach(a => {
          const d = new Date(a.start_date).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
          dates.add(d);
          const next = new Date(new Date(d).getTime() + 86400000).toISOString().split('T')[0];
          dates.add(next);
        });
        const minDate = [...dates].sort()[0];
        const maxDate = [...dates].sort().at(-1);
        const { data: oura } = await supabase
          .from('oura_daily_summary')
          .select('date,hrv_avg,rhr_avg,readiness_score')
          .eq('user_id', session.user.id)
          .gte('date', minDate)
          .lte('date', maxDate);
        if (oura) {
          const map = {};
          oura.forEach(o => { map[o.date] = o; });
          setOuraMap(map);
        }
      }
    } catch (e) {
      console.error('[StravaWidget] fetch error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-strava`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setLastSync(new Date());
      await fetchActivities();
    } catch (e) {
      console.error('[StravaWidget] sync error:', e);
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-orange-400" />
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">Bieganie</p>
          {lastSync && (
            <p className="text-[8px] text-white/25">
              sync {lastSync.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-orange-400 transition-all hover:bg-orange-500/20 disabled:opacity-50"
        >
          <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sync...' : 'Synchronizuj'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] text-red-400">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}

      {/* Activities */}
      {loading ? (
        <div className="rounded-2xl border border-white/5 bg-neutral-950/70 p-8 text-center">
          <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-orange-400" />
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-neutral-950/70 p-6 text-center">
          <Zap size={20} className="mx-auto mb-2 text-white/15" />
          <p className="text-[10px] font-black uppercase tracking-widest text-white/25">Brak treningów</p>
          <p className="mt-1 text-[9px] text-white/20">Kliknij Synchronizuj żeby pobrać z Strava</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map(a => {
            const runDate = new Date(a.start_date).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
            const nextDate = new Date(new Date(runDate).getTime() + 86400000).toISOString().split('T')[0];
            return (
              <ActivityCard
                key={a.strava_id}
                activity={a}
                ouraPreRun={ouraMap[runDate] || null}
                ouraPostRun={ouraMap[nextDate] || null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
