import { isLogWellness } from '../desktopUtils';

export function stravaDay(a: { start_date?: string }) {
  return (a.start_date || '').slice(0, 10);
}

export function countQualityStrengthSets(logs: any[]) {
  return (logs || []).filter((l) => {
    if (isLogWellness(l)) return false;
    if (l.is_pws_or_msp) return true;
    if (l.rir != null && Number(l.rir) <= 1) return true;
    return false;
  }).length;
}

export function summarizeStravaWindow(activities: any[]) {
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
