import { getTodayWarsaw, shiftDateStr, TIMEZONE } from '../../lib/date';
import { CATEGORY_COLORS } from '../../lib/projects/lifeSpheres';

const warsawOffsetFormatter = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, timeZoneName: 'shortOffset' });

export function getWarsawOffset(date?: string | Date): string {
  const d = date ? new Date(date) : new Date();
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date passed to getWarsawOffset: ${date}`);
  }
  const tzPart = warsawOffsetFormatter.formatToParts(d).find(p => p.type === 'timeZoneName')?.value;
  if (!tzPart) {
    const month = d.getMonth();
    return (month >= 3 && month <= 9) ? '+02:00' : '+01:00';
  }
  const numStr = tzPart.replace('GMT', '');
  if (numStr === '') return '+00:00';
  if (numStr.includes(':')) {
    return numStr.length === 5 ? numStr[0] + '0' + numStr.slice(1) : numStr;
  }
  const sign = numStr[0];
  const hour = parseInt(numStr.slice(1), 10);
  return sign + String(hour).padStart(2, '0') + ':00';
}
export const HOUR_START = 5;
export const HOUR_END = 23;
export const HOURS = HOUR_END - HOUR_START;
export const PX_PER_HOUR = 54;
export const PX_PER_MIN = PX_PER_HOUR / 60;

export interface CalRow {
  id: string;
  event_id: string | null;
  summary: string | null;
  start_time: string | null;
  end_time: string | null;
  category: string | null;
}

export function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(dateStr: string, n: number) {
  return shiftDateStr(dateStr, n);
}

export function weekMon(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // Mon=0
  return shiftDateStr(dateStr, -dow);
}

export function todayStr() {
  return getTodayWarsaw();
}

export function dayLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric' });
}

export function formatWeekdayShort(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pl-PL', { weekday: 'short' });
}

export function monthLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

const warsawPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

function getWarsawParts(isoStr: string) {
  const normalized = isoStr.includes(' ') && !isoStr.includes('T') ? isoStr.replace(' ', 'T') : isoStr;
  const date = new Date(normalized);
  if (isNaN(date.getTime())) throw new Error(`Invalid date string: ${isoStr}`);

  const parts = warsawPartsFormatter.formatToParts(date);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    dateStr: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
    timeStr: `${getPart('hour')}:${getPart('minute')}`
  };
}

export function parseTime(iso: string) {
  try {
    const { hour, minute } = getWarsawParts(iso);
    return Number(hour) * 60 + Number(minute);
  } catch (_e: unknown) {
    return 0;
  }
}

export function formatTime(iso: string) {
  try {
    const { timeStr } = getWarsawParts(iso);
    return timeStr;
  } catch (_e: unknown) {
    return '';
  }
}

export function dateOfISO(iso: string) {
  try {
    const { dateStr } = getWarsawParts(iso);
    return dateStr;
  } catch (_e: unknown) {
    return iso.split('T')[0] || iso.split(' ')[0] || '';
  }
}

// Google Calendar expands recurring events into per-instance rows whose id is
// `{recurringEventId}_{YYYYMMDDTHHMMSSZ}` (from the `singleEvents=true` sync).
// Deleting the instance id removes just that occurrence; deleting the base id
// removes the whole series. This regex recovers the base id when present.
const RECURRING_INSTANCE_ID_RE = /^(.+)_(\d{8}T\d{6}Z)$/;

export function recurringSeriesBaseId(eventId: string | null | undefined): string | null {
  if (!eventId) return null;
  const match = eventId.match(RECURRING_INSTANCE_ID_RE);
  return match ? match[1] : null;
}

export function nowMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

export function computeBudgetBarState(
  spent: number,
  minVal: number | null | undefined,
  maxVal: number | null | undefined,
  baseColor: string,
): { pct: number; statusText: string; barColor: string } {
  if (minVal != null && minVal > 0 && maxVal != null && maxVal > 0) {
    return {
      pct: Math.min(100, (spent / maxVal) * 100),
      statusText: `${spent.toFixed(1)}h / ${minVal}–${maxVal}h`,
      barColor:
        spent < minVal
          ? 'bg-warning dark:bg-warning'
          : spent > maxVal
          ? 'bg-danger dark:bg-danger'
          : 'bg-success dark:bg-success',
    };
  }
  if (minVal != null && minVal > 0) {
    return {
      pct: Math.min(100, (spent / minVal) * 100),
      statusText: `${spent.toFixed(1)}h / min ${minVal}h`,
      barColor: spent >= minVal ? 'bg-success dark:bg-success' : 'bg-warning dark:bg-warning',
    };
  }
  if (maxVal != null && maxVal > 0) {
    return {
      pct: Math.min(100, (spent / maxVal) * 100),
      statusText: `${spent.toFixed(1)}h / max ${maxVal}h`,
      barColor: spent > maxVal ? 'bg-danger dark:bg-danger' : baseColor,
    };
  }
  return { pct: 0, statusText: `${spent.toFixed(1)}h`, barColor: baseColor };
}


export function eventColor(ev: CalRow) {
  const summaryLower = ev.summary?.toLowerCase() || '';
  const isFocusTime = ev.summary?.includes('Focus Time') || ev.summary?.includes('🛡️');
  if (isFocusTime) {
    return 'bg-primary/12 dark:bg-primary/18 text-primary border border-primary/25 font-bold';
  }

  // 1. Explicit database category
  if (ev.category && CATEGORY_COLORS[ev.category.toLowerCase()]) {
    const tonalCategoryColors: Record<string, string> = {
      praca: 'bg-info/12 dark:bg-info/15 text-text-primary border border-info/25 font-bold',
      cialo_trening: 'bg-success/12 dark:bg-success/15 text-text-primary border border-success/25 font-bold',
      duch_refleksja: 'bg-info/12 dark:bg-info/15 text-text-primary border border-info/25 font-bold',
      finanse: 'bg-warning/14 dark:bg-warning/15 text-text-primary border border-warning/30 font-bold',
      relacje_rodzina: 'bg-primary/12 dark:bg-primary/15 text-text-primary border border-primary/25 font-bold',
      odpoczynek_regeneracja: 'bg-danger/12 dark:bg-danger/15 text-text-primary border border-danger/25 font-bold',
    };
    return tonalCategoryColors[ev.category.toLowerCase()] || CATEGORY_COLORS[ev.category.toLowerCase()];
  }

  // 2. Keyword-based fallbacks for uncategorized events
  if (summaryLower.includes('sen') || summaryLower.includes('sleep') || summaryLower.includes('sauna')) {
    return CATEGORY_COLORS['odpoczynek_regeneracja'];
  }
  if (summaryLower.includes('bieg') || summaryLower.includes('trening') || summaryLower.includes('siłownia') || summaryLower.includes('run') || summaryLower.includes('gym') || summaryLower.includes('workout')) {
    return CATEGORY_COLORS['cialo_trening'];
  }
  if (summaryLower.includes('medyt') || summaryLower.includes('reflek') || summaryLower.includes('cich') || summaryLower.includes('silent') || summaryLower.includes('mindful')) {
    return CATEGORY_COLORS['duch_refleksja'];
  }
  if (summaryLower.includes('budżet') || summaryLower.includes('finans') || summaryLower.includes('money') || summaryLower.includes('invest') || summaryLower.includes('giełd')) {
    return CATEGORY_COLORS['finanse'];
  }
  if (summaryLower.includes('rodzin') || summaryLower.includes('randk') || summaryLower.includes('spotkan') || summaryLower.includes('koleg') || summaryLower.includes('znajom') || summaryLower.includes('dinner') || summaryLower.includes('date') || summaryLower.includes('urodzin')) {
    if (!summaryLower.includes('pracy') && !summaryLower.includes('work') && !summaryLower.includes('daily') && !summaryLower.includes('sync')) {
      return CATEGORY_COLORS['relacje_rodzina'];
    }
  }

  return 'bg-primary/12 dark:bg-primary/18 text-primary font-bold border border-primary/25';
}

export function layoutDayEvents(dayEvents: CalRow[]) {
  // 1. Filter and parse times
  const parsed = dayEvents
    .filter(ev => ev.start_time && ev.end_time)
    .map(ev => {
      const start = parseTime(ev.start_time!);
      const end = parseTime(ev.end_time!);
      return {
        event: ev,
        start: Math.max(HOUR_START * 60, start),
        end: Math.min(HOUR_END * 60, end)
      };
    });

  // Sort by start time, then end time (longest first)
  parsed.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });

  // Group into columns
  const columns: { end: number }[][] = [];
  const eventLayouts = new Map<string, { columnIndex: number }>();

  for (const item of parsed) {
    let colIndex = 0;
    while (colIndex < columns.length) {
      const col = columns[colIndex];
      const lastInCol = col[col.length - 1];
      if (item.start >= lastInCol.end) {
        break;
      }
      colIndex++;
    }

    if (colIndex === columns.length) {
      columns.push([]);
    }

    columns[colIndex].push(item);
    eventLayouts.set(item.event.id, { columnIndex: colIndex });
  }

  // Group into overlapping clusters to normalize column counts
  const clusters: typeof parsed[] = [];
  let currentCluster: typeof parsed = [];
  let clusterEnd = 0;

  for (const item of parsed) {
    if (currentCluster.length === 0 || item.start < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.end);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.end;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const styles = new Map<string, { left: string; width: string }>();

  for (const cluster of clusters) {
    let maxCol = 0;
    for (const item of cluster) {
      const layout = eventLayouts.get(item.event.id);
      if (layout && layout.columnIndex > maxCol) {
        maxCol = layout.columnIndex;
      }
    }
    const colsCount = maxCol + 1;

    for (const item of cluster) {
      const layout = eventLayouts.get(item.event.id);
      const colIdx = layout ? layout.columnIndex : 0;
      const width = `${100 / colsCount}%`;
      const left = `${(colIdx * 100) / colsCount}%`;
      styles.set(item.event.id, { left, width });
    }
  }

  return styles;
}
