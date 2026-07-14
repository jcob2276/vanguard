import { TIMEZONE } from '../../lib/date';
import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Clock, HeartPulse, RefreshCw, Route } from 'lucide-react';
import { supabase, invokeEdge } from '../../lib/supabase';
import { unwrapList } from '../../lib/supabaseUtils';
import { TIMEOUTS } from '../../lib/constants';
import Spinner from '../ui/Spinner';
import Badge from '../ui/Badge';
import { Card } from '../ui/Card';
import type { Session } from '@supabase/supabase-js';

interface StravaActivityItem {
  strava_id: number | null;
  name: string | null;
  sport_type: string | null;
  start_date: string | null;
  distance: number | null;
  moving_time: number | null;
  pace_sec_per_km: number | null;
  hr_avg: number | null;
  perceived_exertion: number | null;
  total_elevation_gain: number | null;
  has_pr: boolean | null;
  is_oura: boolean | null;
}

function fmtPace(secPerKm: number | null | undefined) {
  if (!secPerKm) return '--';
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
}

function fmtTime(seconds: number | null | undefined) {
  if (!seconds) return '--';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('pl-PL', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
  });
}

function isRun(activity: StravaActivityItem) {
  const text = `${activity.sport_type || ''} ${activity.name || ''}`.toLowerCase();
  return text.includes('run') || text.includes('bieg');
}

function RunRow({ activity }: { activity: StravaActivityItem }) {
  const distance = activity.distance ? (Number(activity.distance) / 1000).toFixed(2) : '--';
  const hrAvg = activity.hr_avg ? Math.round(activity.hr_avg) : null;

  return (
    <Card padding="1rem">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-black uppercase tracking-[0.18em] text-text-muted">
            {fmtDate(activity.start_date)}
          </p>
          <h3 className="mt-1 truncate text-sm font-black uppercase tracking-tight text-text-primary font-display">
            {activity.name || 'Run'}
          </h3>
        </div>
        {activity.has_pr && (
          <Badge variant="tag" color="var(--color-warning)">PR</Badge>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-surface border border-border-custom p-2.5 shadow-sm">
          <Route size={11} className="mb-1 text-primary/70" />
          <p className="text-xs font-black text-text-primary">{distance} km</p>
        </div>
        <div className="rounded-xl bg-surface border border-border-custom p-2.5 shadow-sm">
          <Activity size={11} className="mb-1 text-warning/80" />
          <p className="text-xs font-black text-text-primary">{fmtPace(activity.pace_sec_per_km)}</p>
        </div>
        <div className="rounded-xl bg-surface border border-border-custom p-2.5 shadow-sm">
          <Clock size={11} className="mb-1 text-text-muted" />
          <p className="text-xs font-black text-text-primary">{fmtTime(activity.moving_time)}</p>
        </div>
      </div>

      {(hrAvg || activity.perceived_exertion || activity.total_elevation_gain != null) && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-2xs font-bold uppercase tracking-widest text-text-muted">
          {hrAvg && (
            <span className="inline-flex items-center gap-1 text-danger/80">
              <HeartPulse size={10} /> {hrAvg} bpm
            </span>
          )}
          {activity.perceived_exertion && <span>RPE {activity.perceived_exertion}</span>}
          {activity.total_elevation_gain != null && <span>+{Math.round(activity.total_elevation_gain)}m</span>}
        </div>
      )}
    </Card>
  );
}

export default function StravaWidget({ session }: { session: Session }) {
  const [activities, setActivities] = useState<StravaActivityItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const data = unwrapList(await supabase
        .from('strava_activities_clean')
        .select('strava_id,name,sport_type,start_date,distance,moving_time,pace_sec_per_km,hr_avg,perceived_exertion,total_elevation_gain,has_pr,is_oura')
        .eq('user_id', session.user.id)
        .eq('is_oura', false)
        .order('start_date', { ascending: false })
        .limit(20));

      setActivities(data.filter(isRun).slice(0, 3));
    } catch (e: unknown) {
      console.error('[StravaWidget] fetch error:', e);
      setError(e instanceof Error ? (e as Error).message : String(e));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchActivities();
    }, 0);
    return () => clearTimeout(t);
  }, [fetchActivities]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      await invokeEdge('sync?service=strava', {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUTS.default),
      });
      setLoading(true);
      await fetchActivities();
    } catch (e: unknown) { console.error('[StravaWidget] sync error:', e); setError(e instanceof Error ? (e as Error).message : String(e)); } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="space-y-3">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xs font-black uppercase tracking-[0.22em] text-warning font-display">Bieganie</p>
          <h2 className="mt-1 text-lg font-black uppercase tracking-tight text-text-primary font-display">Ostatnie 3 biegi</h2>
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
        <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-xs font-bold text-danger dark:text-danger">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}

      {loading ? (
        <Card padding="1.5rem">
          <Spinner size="sm" className="!border-text-primary/10 !border-t-orange-500" />
        </Card>
      ) : activities.length === 0 ? (
        <Card className="text-center" padding="1.25rem">
          <p className="text-xs font-black uppercase tracking-widest text-text-muted">Brak biegów w feedzie</p>
        </Card>
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
