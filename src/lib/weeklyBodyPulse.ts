import { formatDayLabel, getTodayWarsaw, shiftDateStr, warsawDayBoundsISO, TIMEZONE } from './date';
import { getSaunaStats, isWellnessOnlySession, sessionDateKey } from './health/workoutSauna';

const RUN_SPORTS = new Set(['Run', 'TrailRun', 'VirtualRun']);

export type SleepDay = {
  date: string;
  hours: number | null;
  score: number | null;
};

export type WeeklyBodyPulseData = {
  since: string;
  gymCount: number;
  runCount: number;
  runKm: number;
  saunaCount: number;
  saunaMinutes: number;
  sleepAvgHours: number | null;
  sleepAvgScore: number | null;
  sleepBest: SleepDay | null;
  sleepWorst: SleepDay | null;
  avgBedtime: string | null;
  avgWake: string | null;
  avgDeepHours: number | null;
  avgRemHours: number | null;
  avgEfficiency: number | null;
  avgHrv: number | null;
  avgLatencyMin: number | null;
  avgReadiness: number | null;
  averageRecovery: number | null;
  warningDays: number;
};

type SessionRow = {
  date: string | null;
  workout_day?: string | null;
  exercise_logs?: Array<{ exercise_name?: string | null; muscle_tags?: string[] | null; reps?: number | null }> | null;
};

type StravaRow = {
  start_date: string | null;
  sport_type: string | null;
  distance: number | null;
};

export type OuraPulseRow = {
  date: string;
  total_sleep_hours: number | null;
  sleep_score: number | null;
  bedtime_timestamp?: string | null;
  bedtime_end_timestamp?: string | null;
  deep_sleep_hours?: number | null;
  rem_sleep_hours?: number | null;
  sleep_efficiency?: number | null;
  hrv_avg?: number | null;
  latency_minutes?: number | null;
  readiness_score?: number | null;
};

type StrainRow = {
  recovery_score: number | null;
  daily_status: string | null;
};

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(value: number | null): number | null {
  return value == null ? null : Math.round(value * 10) / 10;
}

function round0(value: number | null): number | null {
  return value == null ? null : Math.round(value);
}

/** Warsaw HH:MM from ISO timestamp. */
function warsawClock(iso: string): { hour: number; minute: number; totalMinutes: number } {
  const d = new Date(iso);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }).format(d),
  );
  const minute = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, minute: '2-digit' }).format(d),
  );
  return { hour, minute, totalMinutes: hour * 60 + minute };
}

/**
 * Average clock time. Night wrap: hours before noon count as next calendar day
 * (bedtimes like 23:40 / 00:20). Morning wake times should pass wrapNight=false.
 */
export function avgClockLabel(timestamps: string[], wrapNight = true): string | null {
  const minutes = timestamps.map((ts) => {
    const { hour, totalMinutes } = warsawClock(ts);
    return wrapNight && hour < 12 ? totalMinutes + 24 * 60 : totalMinutes;
  });
  const avg = mean(minutes);
  if (avg == null) return null;
  const wrapped = Math.round(avg) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

function sleepRank(day: SleepDay): number {
  if (day.score != null) return day.score;
  if (day.hours != null) return day.hours * 12;
  return -Infinity;
}

function shortWeekday(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00Z`)
    .toLocaleDateString('pl-PL', { weekday: 'short', timeZone: TIMEZONE })
    .replace('.', '');
}

export function buildWeeklyBodyPulse(input: {
  since: string;
  sessions: SessionRow[];
  strava: StravaRow[];
  oura: OuraPulseRow[];
  strain: StrainRow[];
}): WeeklyBodyPulseData {
  const { since, sessions, strava, oura, strain } = input;

  const inWindow = sessions.filter((s) => {
    const key = sessionDateKey(s.date) || sessionDateKey(s.workout_day);
    return key >= since;
  });

  const gymCount = inWindow.filter((s) => !isWellnessOnlySession(s)).length;
  const { sessionsCount: saunaCount, totalMinutes: saunaMinutes } = getSaunaStats(
    inWindow.map((s) => ({
      date: sessionDateKey(s.date) || sessionDateKey(s.workout_day),
      workout_day: s.workout_day,
      exercise_logs: s.exercise_logs,
    })),
    since,
  );

  const runs = strava.filter((a) => RUN_SPORTS.has(a.sport_type ?? '') && sessionDateKey(a.start_date) >= since);
  const runCount = runs.length;
  const runKm = Math.round((runs.reduce((sum, a) => sum + (Number(a.distance) || 0), 0) / 1000) * 10) / 10;

  const ouraWindow = oura.filter((row) => row.date >= since);
  const sleepDays: SleepDay[] = ouraWindow
    .filter((row) => row.total_sleep_hours != null || row.sleep_score != null)
    .map((row) => ({
      date: row.date,
      hours: row.total_sleep_hours,
      score: row.sleep_score,
    }));

  const sleepAvgHours = round1(mean(sleepDays.flatMap((d) => (d.hours == null ? [] : [d.hours]))));
  const sleepAvgScore = round0(mean(sleepDays.flatMap((d) => (d.score == null ? [] : [d.score]))));

  let sleepBest: SleepDay | null = null;
  let sleepWorst: SleepDay | null = null;
  for (const day of sleepDays) {
    if (sleepRank(day) === -Infinity) continue;
    if (!sleepBest || sleepRank(day) > sleepRank(sleepBest)) sleepBest = day;
    if (!sleepWorst || sleepRank(day) < sleepRank(sleepWorst)) sleepWorst = day;
  }
  if (sleepBest && sleepWorst && sleepBest.date === sleepWorst.date) {
    sleepWorst = null;
  }

  const bedtimes = ouraWindow.flatMap((r) => (r.bedtime_timestamp ? [r.bedtime_timestamp] : []));
  const wakes = ouraWindow.flatMap((r) => (r.bedtime_end_timestamp ? [r.bedtime_end_timestamp] : []));

  const recoveryValues = strain.flatMap((row) => (row.recovery_score == null ? [] : [row.recovery_score]));
  const averageRecovery = round0(mean(recoveryValues));
  const warningDays = strain.filter((row) => row.daily_status === 'red' || row.daily_status === 'yellow').length;

  return {
    since,
    gymCount,
    runCount,
    runKm,
    saunaCount,
    saunaMinutes,
    sleepAvgHours,
    sleepAvgScore,
    sleepBest,
    sleepWorst,
    avgBedtime: avgClockLabel(bedtimes, true),
    avgWake: avgClockLabel(wakes, false),
    avgDeepHours: round1(mean(ouraWindow.flatMap((r) => (r.deep_sleep_hours == null ? [] : [r.deep_sleep_hours])))),
    avgRemHours: round1(mean(ouraWindow.flatMap((r) => (r.rem_sleep_hours == null ? [] : [r.rem_sleep_hours])))),
    avgEfficiency: round0(mean(ouraWindow.flatMap((r) => (r.sleep_efficiency == null ? [] : [r.sleep_efficiency])))),
    avgHrv: round0(mean(ouraWindow.flatMap((r) => (r.hrv_avg == null ? [] : [r.hrv_avg])))),
    avgLatencyMin: round0(mean(ouraWindow.flatMap((r) => (r.latency_minutes == null ? [] : [r.latency_minutes])))),
    avgReadiness: round0(mean(ouraWindow.flatMap((r) => (r.readiness_score == null ? [] : [r.readiness_score])))),
    averageRecovery,
    warningDays,
  };
}

export function weeklyBodyPulseWindow() {
  const today = getTodayWarsaw();
  const since = shiftDateStr(today, -6);
  return {
    today,
    since,
    fromISO: warsawDayBoundsISO(since).fromISO,
    toISO: warsawDayBoundsISO(today).toISO,
  };
}

/** Decimal hours from Oura → clock duration (1.7 → "1h 42m"). */
export function formatDurationHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return '—';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatSleepDayLabel(day: SleepDay | null, today: string): string {
  if (!day) return '—';
  const label = day.date === today ? formatDayLabel(day.date, today) : shortWeekday(day.date);
  if (day.hours != null) return `${formatDurationHours(day.hours)} · ${label}`;
  if (day.score != null) return `${day.score} · ${label}`;
  return label;
}

export function bodyPulseHeadline(data: WeeklyBodyPulseData): string {
  if (data.sleepAvgHours != null && data.sleepAvgHours < 6.5) return 'Sen ciągnie w dół ostatnie 7 dni';
  if (data.gymCount === 0 && data.runCount === 0) return 'Mało ruchu w ostatnich 7 dniach';
  if (data.gymCount + data.runCount >= 4) return 'Aktywność trzyma kierunek';
  return 'Przebieg ostatnich 7 dni';
}

export const EMPTY_WEEKLY_BODY_PULSE: WeeklyBodyPulseData = {
  since: '',
  gymCount: 0,
  runCount: 0,
  runKm: 0,
  saunaCount: 0,
  saunaMinutes: 0,
  sleepAvgHours: null,
  sleepAvgScore: null,
  sleepBest: null,
  sleepWorst: null,
  avgBedtime: null,
  avgWake: null,
  avgDeepHours: null,
  avgRemHours: null,
  avgEfficiency: null,
  avgHrv: null,
  avgLatencyMin: null,
  avgReadiness: null,
  averageRecovery: null,
  warningDays: 0,
};
