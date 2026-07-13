import { formatWarsawDate } from '../../lib/date';
import { format, startOfWeek } from 'date-fns';
import { sessionVol } from '../biometrics/workout/workoutUtils';
import { avg } from './desktopMath';
import type { OuraRow, WorkoutSessionSummary, StravaActivitySummary, NutritionDayRow } from './desktopDataTypes';

export function weeklyVolume(sessions: WorkoutSessionSummary[]) {
  const map: Record<string, number> = {};
  const dates: Record<string, Date> = {};
  for (const s of sessions) {
    const ws = startOfWeek(new Date(s.date + 'T12:00:00Z'), { weekStartsOn: 1 });
    const k = formatWarsawDate(ws);
    map[k] = (map[k] || 0) + sessionVol(s);
    dates[k] = ws;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10)
    .map(([k, v]) => ({ week: format(dates[k], 'dd.MM'), vol: Math.round(v / 100) / 10 }));
}

export function weeklyRunKm(strava: StravaActivitySummary[]) {
  const runs = strava.filter((a) => ['Run', 'TrailRun', 'VirtualRun', 'Hike'].includes(a.sport_type));
  const map: Record<string, number> = {};
  const dates: Record<string, Date> = {};
  for (const a of runs) {
    const ws = startOfWeek(new Date(a.start_date), { weekStartsOn: 1 });
    const k = formatWarsawDate(ws);
    map[k] = (map[k] || 0) + (parseFloat(String(a.distance)) || 0);
    dates[k] = ws;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([k, v]) => ({ week: format(dates[k], 'dd.MM'), km: Math.round(v / 100) / 10 }));
}

interface Alert {
  type: 'warn' | 'ok';
  msg: string;
}

export function computeAlerts(oura: OuraRow[], _sessions: WorkoutSessionSummary[], _nutrition: NutritionDayRow[]) {
  const alerts: Alert[] = [];
  const lat = oura[oura.length - 1];
  const avg7HRV = avg(oura.slice(-8, -1).map((o) => o.hrv_avg).filter((v): v is number => v != null));
  if (lat?.hrv_avg && avg7HRV && (avg7HRV - lat.hrv_avg) / avg7HRV > 0.12)
    alerts.push({ type: 'warn', msg: `HRV o ${Math.round(avg7HRV - lat.hrv_avg)}ms poniżej 7-dniowej średniej` });
  if (!alerts.length && (lat?.readiness_score ?? 0) >= 70)
    alerts.push({ type: 'ok', msg: 'Sygnały OK — dobry dzień na ciśnięcie' });
  return alerts;
}

export { SPRINT_SEASON, getSprintInfo } from '../../lib/growth/sprintUtils';

export function sprintMetrics(oura: OuraRow[], sessions: WorkoutSessionSummary[], strava: StravaActivitySummary[], start: string | null, end: string | null) {
  if (!start || !end) return null;
  const o = oura.filter((r) => r.date >= start && r.date <= end);
  const s = sessions.filter((r) => (r.date ?? '') >= start && (r.date ?? '') <= end);
  const runs = strava.filter((a) => {
    const d = a.start_date.slice(0, 10);
    return d >= start && d <= end && ['Run', 'TrailRun', 'VirtualRun'].includes(a.sport_type);
  });
  return {
    avgReadiness: avg(o.map((r) => r.readiness_score).filter((v): v is number => v != null)),
    avgSleep: avg(o.map((r) => r.total_sleep_hours).filter((v): v is number => v != null)),
    avgHRV: avg(o.map((r) => r.hrv_avg).filter((v): v is number => v != null)),
    totalVol: s.reduce((sum, sess) => sum + sessionVol(sess), 0),
    trainDays: s.filter((sess) => sessionVol(sess) > 0).length,
    kmRun: runs.reduce((sum, a) => sum + (parseFloat(String(a.distance)) || 0), 0) / 1000
  };
}
