import { isLogWellness } from '../desktopUtils';
import type { Tables } from '../../../lib/database.types';

type ExerciseLogRow = {
  exercise_name: string;
  muscle_tags?: Tables<'exercise_logs'>['muscle_tags'];
  is_pws_or_msp?: Tables<'exercise_logs'>['is_pws_or_msp'];
  rir?: Tables<'exercise_logs'>['rir'];
};

interface StravaActivity {
  start_date?: string | null;
  distance?: number | null;
  sport_type?: string | null;
  moving_time?: number | null;
}

export function stravaDay(a: { start_date?: string | null }) {
  return (a.start_date || '').slice(0, 10);
}

export function countQualityStrengthSets(logs: ExerciseLogRow[]) {
  return (logs || []).filter((l) => {
    if (isLogWellness(l)) return false;
    if (l.is_pws_or_msp) return true;
    if (l.rir != null && Number(l.rir) <= 1) return true;
    return false;
  }).length;
}

export function summarizeStravaWindow(activities: StravaActivity[]) {
  let runKm = 0;
  let walkKm = 0;
  let otherMin = 0;
  activities.forEach((a) => {
    const distKm = (a.distance || 0) / 1000;
    const sport = a.sport_type || '';
    if (['Run', 'TrailRun', 'VirtualRun'].includes(sport)) runKm += distKm;
    else if (['Walk', 'Hike'].includes(sport)) walkKm += distKm;
    else otherMin += (a.moving_time || 0) / 60;
  });
  return { runKm, walkKm, otherMin, count: activities.length };
}
