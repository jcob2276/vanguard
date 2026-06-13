import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Clock, HeartPulse, RefreshCw, Route } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function fmtPace(secPerKm) {
  if (!secPerKm) return '--';
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
}

function fmtTime(seconds) {
  if (!seconds) return '--';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function fmtDate(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    day: '2-digit',
    month: '2-digit',
  });
}

function isRun(activity) {
  const text = `${activity.sport_type || ''} ${activity.type || ''} ${activity.name || ''}`.toLowerCase();
  return text.includes('run') || text.includes('bieg');
}

function RunRow({ activity }) {
  const distance = activity.distance ? (Number(activity.distance) / 1000).toFixed(2) : '--';
  const hrAvg = activity.hr_avg ? Math.round(activity.hr_avg) : null;

  return (
    <article className="rounded-2xl border border-border-custom bg-surface/50 backdrop-blur-md p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[0.18em] text-text-muted">
            {fmtDate(activity.start_date)}
          </p>
          <h3 className="mt-1 truncate text-[13px] font-black uppercase tracking-tight text-text-primary font-display">
            {activity.name || 'Run'}
          </h3>
        </div>
        {activity.has_pr && (
          <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-300 shadow-sm">
            PR
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-surface border border-border-custom p-2.5 shadow-sm">
          <Route size={11} className="mb-1 text-primary/70" />
          <p className="text-[11px] font-black text-text-primary">{distance} km</p>
        </div>
        <div className="rounded-xl bg-surface border border-border-custom p-2.5 shadow-sm">
          <Activity size={11} className="mb-1 text-orange-500/80" />
          <p className="text-[11px] font-black text-text-primary">{fmtPace(activity.pace_sec_per_km)}</p>
        </div>
        <div className="rounded-xl bg-surface border border-border-custom p-2.5 shadow-sm">
          <Clock size={11} className="mb-1 text-text-muted" />
          <p className="text-[11px] font-black text-text-primary">{fmtTime(activity.moving_time)}</p>
        </div>
      </div>

      {(hrAvg || activity.perceived_exertion || activity.total_elevation_gain != null) && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[9px] font-bold uppercase tracking-widest text-text-muted">
          {hrAvg && (
            <span className="inline-flex items-center gap-1 text-rose-500/80">
              <HeartPulse size={10} /> {hrAvg} bpm
            </span>
          )}
          {activity.perceived_exertion && <span>RPE {activity.perceived_exertion}</span>}
          {activity.total_elevation_gain != null && <span>+{Math.round(activity.total_elevation_gain)}m</span>}
        </div>
      )}
    </article>
  );
}

export default function StravaWidget({ session }) {
  const [activities, setActivities] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchActivities = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const { data, error: err } = await supabase
        .from('strava_activities_clean')
        .select('strava_id,name,sport_type,start_date,distance,moving_time,pace_sec_per_km,hr_avg,perceived_exertion,total_elevation_gain,has_pr,is_oura')
        .eq('user_id', session.user.id)
        .eq('is_oura', false)
        .order('start_date', { ascending: false })
        .limit(20);

      if (err) throw err;
      setActivities((data || []).filter(isRun).slice(0, 3));
    } catch (e) {
      console.error('[StravaWidget] fetch error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    setTimeout(() => {
      fetchActivities();
    }, 0);
  }, [fetchActivities]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-strava`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setLoading(true);
      await fetchActivities();
    } catch (e) {
      console.error('[StravaWidget] sync error:', e);
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="space-y-3">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-orange-500 font-display">Bieganie</p>
          <h2 className="mt-1 text-[16px] font-black uppercase tracking-tight text-text-primary font-display">Ostatnie 3 biegi</h2>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-xl border border-border-custom bg-surface p-2.5 text-text-secondary transition-all hover:bg-surface-solid hover:text-text-primary active:scale-95 shadow-sm cursor-pointer"
          title="Sync Strava"
        >
          <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
        </button>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-bold text-red-600 dark:text-red-300">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border-custom bg-surface/50 p-6 shadow-sm">
          <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-text-primary/10 border-t-orange-500" />
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-2xl border border-border-custom bg-surface/50 p-5 text-center shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Brak biegów w feedzie</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => (
            <RunRow key={activity.strava_id || activity.start_date} activity={activity} />
          ))}
        </div>
      )}
    </section>
  );
}
