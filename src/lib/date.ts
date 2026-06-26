const WARSAW_TZ = 'Europe/Warsaw';

export function getTodayWarsaw(): string {
  return formatWarsawDate(new Date());
}

export function getYesterdayWarsaw(): string {
  const today = getTodayWarsaw();
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

export function getTomorrowWarsaw(): string {
  const today = getTodayWarsaw();
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

export function getDaysAgoWarsaw(days: number): string {
  const today = getTodayWarsaw();
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
}

/** Returns the Europe/Warsaw UTC offset suffix (e.g. "+02:00") for a given instant, DST-aware. */
function warsawOffsetSuffix(instant: Date): string {
  const offsetStr = new Intl.DateTimeFormat('en-US', {
    timeZone: WARSAW_TZ,
    timeZoneName: 'shortOffset',
  }).formatToParts(instant).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const match = offsetStr.match(/GMT([+-]\d+)(?::(\d+))?/);
  const hours = match ? parseInt(match[1], 10) : 1;
  const minutes = match?.[2] ? parseInt(match[2], 10) : 0;
  const sign = hours < 0 ? '-' : '+';
  return `${sign}${String(Math.abs(hours)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * UTC-correct day boundaries for a Warsaw calendar date, as ISO strings with
 * an explicit offset — safe to pass to a `timestamptz` column filter (a bare
 * `${date}T00:00:00` literal gets parsed as UTC by Postgres, not Warsaw).
 */
export function warsawDayBoundsISO(dateStr: string): { fromISO: string; toISO: string } {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const offset = warsawOffsetSuffix(probe);
  return {
    fromISO: `${dateStr}T00:00:00${offset}`,
    toISO: `${dateStr}T23:59:59${offset}`,
  };
}

export function nowWarsaw(): Date {
  // Shift wall-clock so getHours/getDate match Europe/Warsaw on any system TZ (see date.test.ts).
  return new Date(new Date().toLocaleString('en-US', { timeZone: WARSAW_TZ }));
}

export function formatWarsawDate(date: Date | string | number): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: WARSAW_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(d);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // Ignore formatting error and fallback
  }

  try {
    const raw = new Date(date).toLocaleDateString('en-CA', { timeZone: WARSAW_TZ });
    return raw.replace(/[^\d-/]/g, '').replace(/\//g, '-');
  } catch (e) {
    return '';
  }
}
