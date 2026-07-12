export const TIMEZONE = 'Europe/Warsaw';
export const WARSAW_TZ = TIMEZONE;

export function getTodayWarsaw(): string {
  return formatWarsawDate(new Date());
}

export function getYesterdayWarsaw(): string {
  const today = getTodayWarsaw();
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

export function getDaysAgoWarsaw(days: number): string {
  const today = getTodayWarsaw();
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
}

/**
 * Shifts a YYYY-MM-DD date string by N days (negative to go back), anchored at UTC
 * noon so the shift is immune to DST — the single canonical implementation for this;
 * do not reintroduce a local copy (see docs/FRONTEND_GUIDE.md).
 */
export function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Returns the Europe/Warsaw UTC offset suffix (e.g. "+02:00") for a given instant, DST-aware. */
export function warsawOffsetSuffix(instant: Date): string {
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
 * an explicit offset — safe to pass to a `timestamptz` column filter.
 */
export function warsawDayBoundsISO(dateStr: string): { fromISO: string; toISO: string } {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const offset = warsawOffsetSuffix(probe);
  return {
    fromISO: `${dateStr}T00:00:00${offset}`,
    toISO: `${dateStr}T23:59:59${offset}`,
  };
}

/**
 * Combines a YYYY-MM-DD date and an "HH:MM" wall-clock time into a Warsaw-offset ISO
 * string.
 */
export function combineDateTimeWarsawISO(dateStr: string, timeStr: string): string {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const offset = warsawOffsetSuffix(probe);
  return `${dateStr}T${timeStr}:00${offset}`;
}

const warsawTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: WARSAW_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Reads the "HH:MM" wall-clock time (Warsaw) back off a stored timestamptz ISO string. */
export function warsawTimeOfDay(isoStr: string): string {
  return warsawTimeFormatter.format(new Date(isoStr));
}

const warsawDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: WARSAW_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatWarsawDate(date: Date | string | number): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const parts = warsawDateFormatter.formatToParts(d);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch (e: unknown) {
    // Ignore formatting error and fallback
  }

  try {
    const raw = new Date(date).toLocaleDateString('en-CA', { timeZone: WARSAW_TZ });
    return raw.replace(/[^\d-/]/g, '').replace(/\//g, '-');
  } catch (e: unknown) {
    return '';
  }
}

export function getPastWeekStarts(current: string, n: number): string[] {
  const result: string[] = [];
  const d = new Date(current + 'T12:00:00Z');
  for (let i = 0; i < n; i++) {
    result.unshift(formatWarsawDate(d));
    d.setUTCDate(d.getUTCDate() - 7);
  }
  return result;
}

// ── Backend (time.ts) equivalents ──

export function getWarsawDateString(now: Date = new Date()): string {
  return formatWarsawDate(now);
}

export function warsawDayStartUTCMs(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const t22 = Date.UTC(year, month - 1, day - 1, 22, 0, 0);
  const formatted22 = new Intl.DateTimeFormat("en-CA", {
    timeZone: WARSAW_TZ,
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(t22).replace(/\//g, "-");
  
  if (formatted22 === dateStr) {
    return t22;
  }
  return Date.UTC(year, month - 1, day - 1, 23, 0, 0);
}

export function getWarsawDayBoundaries(dateStr: string): { start: string; end: string } {
  const startUTC = warsawDayStartUTCMs(dateStr);
  const nextDateStr = new Date(new Date(`${dateStr}T12:00:00Z`).getTime() + 86400000)
    .toLocaleDateString("en-CA", { timeZone: WARSAW_TZ });
  return {
    start: new Date(startUTC).toISOString(),
    end: new Date(warsawDayStartUTCMs(nextDateStr)).toISOString(),
  };
}

export type StreamCutoffs = {
  cut24h: string;
  cut72h: string;
  cut14d: string;
  cut21d: string;
};

export function getStreamCutoffs(baseDate: Date = new Date()): StreamCutoffs {
  const cut24hMs = baseDate.getTime() - 24 * 60 * 60 * 1000;
  const cut72hMs = baseDate.getTime() - 72 * 60 * 60 * 1000;
  const cut14dMs = baseDate.getTime() - 14 * 24 * 60 * 60 * 1000;
  const cut21dMs = baseDate.getTime() - 21 * 24 * 60 * 60 * 1000;

  return {
    cut24h: new Date(cut24hMs).toISOString(),
    cut72h: new Date(cut72hMs).toISOString(),
    cut14d: new Date(cut14dMs).toISOString(),
    cut21d: new Date(cut21dMs).toISOString(),
  };
}
