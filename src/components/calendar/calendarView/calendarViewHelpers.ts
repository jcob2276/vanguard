import { LIFE_SPHERES, LEGACY_CATEGORY_TO_SPHERE } from '../../../lib/projects/lifeSpheres';
import { addDays, type CalRow } from '../calendarHelpers';

export const buildRecurrenceRule = (
  r: '' | 'daily' | 'weekly' | 'monthly' | 'custom',
  customDays: string[],
  endDate: string
): string[] | undefined => {
  if (r === '') return undefined;
  let rule = '';
  if (r === 'daily') rule = 'FREQ=DAILY';
  else if (r === 'weekly') rule = 'FREQ=WEEKLY';
  else if (r === 'monthly') rule = 'FREQ=MONTHLY';
  else if (r === 'custom') {
    if (customDays.length === 0) return undefined;
    rule = `FREQ=WEEKLY;BYDAY=${customDays.join(',')}`;
  }
  if (endDate) {
    const formatted = endDate.replace(/-/g, '') + 'T235959Z';
    rule += `;UNTIL=${formatted}`;
  }
  return [`RRULE:${rule}`];
};

export function calculateWeeklyTotals(events: CalRow[], weekStart: string, offsetDays: number) {
  const totals: Record<string, number> = Object.fromEntries(LIFE_SPHERES.map((s) => [s.id, 0]));
  const targetWeekStart = offsetDays === 0 ? weekStart : addDays(weekStart, offsetDays);
  const targetWeekEnd = addDays(targetWeekStart, 7);
  events.forEach((ev) => {
    if (!ev.start_time || !ev.end_time || !ev.category) return;
    const evDateStr = ev.start_time.split('T')[0];
    if (evDateStr < targetWeekStart || evDateStr >= targetWeekEnd) return;
    if (ev.summary?.toLowerCase()?.includes('sen') || ev.summary?.toLowerCase()?.includes('sleep')) return;
    const cat = LEGACY_CATEGORY_TO_SPHERE[ev.category.toLowerCase()] || ev.category.toLowerCase();
    if (!(cat in totals)) return;
    try {
      const start = new Date(ev.start_time.replace(' ', 'T')).getTime();
      const end = new Date(ev.end_time.replace(' ', 'T')).getTime();
      const diffMs = end - start;
      if (diffMs > 0) totals[cat] += diffMs / (1000 * 60 * 60);
    } catch (err) {
      console.warn('[CalendarView] Failed to parse event time:', err);
    }
  });
  return totals;
}
