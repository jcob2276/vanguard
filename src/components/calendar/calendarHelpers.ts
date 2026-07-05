import { getTodayWarsaw } from '../../lib/date';

export const WARSAW_OFFSET = '+02:00'; // CEST; simplified constant

export const HOUR_START = 6;
export const HOUR_END = 23;
export const HOURS = HOUR_END - HOUR_START;
export const PX_PER_HOUR = 64;
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
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return toLocalISO(new Date(dt.getTime()));
}

export function weekMon(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // Mon=0
  dt.setUTCDate(dt.getUTCDate() - dow);
  return toLocalISO(new Date(dt.getTime()));
}

export function todayStr() {
  return getTodayWarsaw();
}

export function dayLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric' });
}

export function monthLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function getWarsawParts(isoStr: string) {
  const normalized = isoStr.includes(' ') && !isoStr.includes('T') ? isoStr.replace(' ', 'T') : isoStr;
  const date = new Date(normalized);
  if (isNaN(date.getTime())) throw new Error(`Invalid date string: ${isoStr}`);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
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
  } catch (e) {
    return 0;
  }
}

export function formatTime(iso: string) {
  try {
    const { timeStr } = getWarsawParts(iso);
    return timeStr;
  } catch (e) {
    return '';
  }
}

export function dateOfISO(iso: string) {
  try {
    const { dateStr } = getWarsawParts(iso);
    return dateStr;
  } catch (e) {
    return iso.split('T')[0] || iso.split(' ')[0] || '';
  }
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
          ? 'bg-amber-500 dark:bg-amber-400'
          : spent > maxVal
          ? 'bg-rose-500 dark:bg-rose-400'
          : 'bg-emerald-500 dark:bg-emerald-400',
    };
  }
  if (minVal != null && minVal > 0) {
    return {
      pct: Math.min(100, (spent / minVal) * 100),
      statusText: `${spent.toFixed(1)}h / min ${minVal}h`,
      barColor: spent >= minVal ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400',
    };
  }
  if (maxVal != null && maxVal > 0) {
    return {
      pct: Math.min(100, (spent / maxVal) * 100),
      statusText: `${spent.toFixed(1)}h / max ${maxVal}h`,
      barColor: spent > maxVal ? 'bg-rose-500 dark:bg-rose-400' : baseColor,
    };
  }
  return { pct: 0, statusText: `${spent.toFixed(1)}h`, barColor: baseColor };
}

export const CATEGORY_COLORS: Record<string, string> = {
  praca: 'bg-blue-500/8 dark:bg-blue-500/12 border-l-blue-500 border-y-blue-500/10 border-r-blue-500/10 text-blue-600 dark:text-blue-400',
  cialo_trening: 'bg-emerald-500/8 dark:bg-emerald-500/12 border-l-emerald-500 border-y-emerald-500/10 border-r-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  duch_refleksja: 'bg-sky-500/8 dark:bg-sky-500/12 border-l-sky-500 border-y-sky-500/10 border-r-sky-500/10 text-sky-600 dark:text-sky-400',
  finanse: 'bg-amber-500/8 dark:bg-amber-500/12 border-l-amber-500 border-y-amber-500/10 border-r-amber-500/10 text-amber-600 dark:text-amber-400',
  relacje_rodzina: 'bg-violet-500/8 dark:bg-violet-500/12 border-l-violet-500 border-y-violet-500/10 border-r-violet-500/10 text-violet-600 dark:text-violet-400',
  odpoczynek_regeneracja: 'bg-rose-500/8 dark:bg-rose-500/12 border-l-rose-500 border-y-rose-500/10 border-r-rose-500/10 text-rose-600 dark:text-rose-400',

  // Legacy Fallbacks
  work: 'bg-blue-500/8 dark:bg-blue-500/12 border-l-blue-500 border-y-blue-500/10 border-r-blue-500/10 text-blue-600 dark:text-blue-400',
  health: 'bg-emerald-500/8 dark:bg-emerald-500/12 border-l-emerald-500 border-y-emerald-500/10 border-r-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  personal: 'bg-violet-500/8 dark:bg-violet-500/12 border-l-violet-500 border-y-violet-500/10 border-r-violet-500/10 text-violet-600 dark:text-violet-400',
  sport: 'bg-orange-500/8 dark:bg-orange-500/12 border-l-orange-500 border-y-orange-500/10 border-r-orange-500/10 text-orange-600 dark:text-orange-400',
  study: 'bg-sky-500/8 dark:bg-sky-500/12 border-l-sky-500 border-y-sky-500/10 border-r-sky-500/10 text-sky-600 dark:text-sky-400',
};

export function eventColor(ev: CalRow) {
  const summaryLower = ev.summary?.toLowerCase() || '';
  const isFocusTime = ev.summary?.includes('Focus Time') || ev.summary?.includes('🛡️');
  if (isFocusTime) {
    return 'bg-indigo-600 dark:bg-indigo-700 text-white border border-indigo-700/20 font-semibold';
  }

  // 1. Explicit database category
  if (ev.category && CATEGORY_COLORS[ev.category.toLowerCase()]) {
    return CATEGORY_COLORS[ev.category.toLowerCase()];
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

  return 'bg-primary text-white border border-primary/20';
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
