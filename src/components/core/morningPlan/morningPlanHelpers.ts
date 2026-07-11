export function addMinutes(timeStr: string, minutes: number) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** The date part of a stored calendar/scheduled ISO string (Warsaw wall-clock, per combineDateTimeWarsawISO). */
export function isoDateStr(iso: string): string {
  return iso.split('T')[0];
}

/** Minutes since midnight, read directly off the Warsaw wall-clock digits (no browser-tz conversion). */
export function isoMinutesOfDay(iso: string): number {
  const t = iso.split('T')[1] || '00:00:00';
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Duration in minutes — a plain instant delta, safe regardless of how either Date parses tz. */
export function isoDurationMin(startIso: string, endIso: string): number {
  const diff = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000;
  return diff > 0 ? diff : 0;
}
