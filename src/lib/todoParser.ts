import { startOfDay, addDays, format } from 'date-fns';

const PRIORITY_TOKENS = {
  p1: { priority: 'urgent', label: 'P1' },
  p2: { priority: 'high', label: 'P2' },
  p3: { priority: 'normal', label: 'P3' },
  p4: { priority: 'low', label: 'P4' },
} as const;

const WEEKDAYS = [
  ['nd', 'niedz', 'niedziela'],
  ['pon', 'poniedzialek', 'poniedziałek'],
  ['wt', 'wtorek'],
  ['sr', 'sro', 'sroda', 'śr', 'śro', 'środa'],
  ['czw', 'czwartek'],
  ['pt', 'piatek', 'piątek'],
  ['sob', 'sobota'],
];

const MONTHS = [
  ['sty', 'stycznia'],
  ['lut', 'lutego'],
  ['mar', 'marca'],
  ['kwi', 'kwietnia'],
  ['maj', 'maja'],
  ['cze', 'czerwca'],
  ['lip', 'lipca'],
  ['sie', 'sierpnia'],
  ['wrz', 'wrzesnia', 'września'],
  ['paz', 'paź', 'pazdziernika', 'października'],
  ['lis', 'listopada'],
  ['gru', 'grudnia'],
];

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function nextWeekday(now: Date, weekday: number): Date {
  const today = startOfDay(now);
  const diff = (weekday - today.getDay() + 7) % 7 || 7;
  return addDays(today, diff);
}

function futureDateForMonthDay(now: Date, monthIndex: number, day: number): Date {
  const today = startOfDay(now);
  let date = new Date(today.getFullYear(), monthIndex, day);
  if (date < today) date = new Date(today.getFullYear() + 1, monthIndex, day);
  return date;
}

function tokenPattern(words: string[]): string {
  return words.map((w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}

function consumeMatch(text: string, match: RegExpMatchArray): string {
  if (match.index === undefined) return text;
  return `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`;
}

export function parseTodoQuickInput(input: string | null | undefined, now: Date = new Date()) {
  let title = String(input || '');
  const tokens: Array<{ type: 'priority' | 'date' | 'duration' | 'time'; label: string; value: string }> = [];

  const priorityMatch = title.match(/(^|\s)(p[1-4])(?=\s|$)/i);
  if (priorityMatch) {
    const raw = priorityMatch[2].toLowerCase() as keyof typeof PRIORITY_TOKENS;
    const meta = PRIORITY_TOKENS[raw];
    tokens.push({ type: 'priority', label: meta.label, value: meta.priority });
    title = consumeMatch(title, priorityMatch);
  }

  const relativeMatch = title.match(/(^|\s)(dzisiaj|dzis|dziś|jutro|pojutrze)(?=\s|$)/i);
  if (relativeMatch) {
    const raw = relativeMatch[2].toLowerCase();
    const days = raw === 'jutro' ? 1 : raw === 'pojutrze' ? 2 : 0;
    const date = addDays(startOfDay(now), days);
    tokens.push({ type: 'date', label: days === 0 ? 'Dzisiaj' : days === 1 ? 'Jutro' : 'Pojutrze', value: toDateKey(date) });
    title = consumeMatch(title, relativeMatch);
  }

  if (!tokens.some((token) => token.type === 'date')) {
    const weekdayWords = WEEKDAYS.flat();
    const weekdayMatch = title.match(new RegExp(`(^|\\s)(${tokenPattern(weekdayWords)})(?=\\s|$)`, 'i'));
    if (weekdayMatch) {
      const raw = weekdayMatch[2].toLowerCase();
      const weekday = WEEKDAYS.findIndex((aliases) => aliases.includes(raw));
      const date = nextWeekday(now, weekday);
      const label = date.toLocaleDateString('pl-PL', { weekday: 'long' });
      tokens.push({ type: 'date', label: label.charAt(0).toUpperCase() + label.slice(1), value: toDateKey(date) });
      title = consumeMatch(title, weekdayMatch);
    }
  }

  if (!tokens.some((token) => token.type === 'date')) {
    const monthWords = MONTHS.flat();
    const monthDateMatch = title.match(new RegExp(`(^|\\s)([0-3]?\\d)\\s+(${tokenPattern(monthWords)})(?=\\s|$)`, 'i'));
    if (monthDateMatch) {
      const day = Number(monthDateMatch[2]);
      const rawMonth = monthDateMatch[3].toLowerCase();
      const monthIndex = MONTHS.findIndex((aliases) => aliases.includes(rawMonth));
      if (day >= 1 && day <= 31 && monthIndex >= 0) {
        const date = futureDateForMonthDay(now, monthIndex, day);
        tokens.push({ type: 'date', label: date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }), value: toDateKey(date) });
        title = consumeMatch(title, monthDateMatch);
      }
    }
  }

  if (!tokens.some((token) => token.type === 'date')) {
    const numericDateMatch = title.match(/(^|\s)([0-3]?\d)[./-]([01]?\d)(?=\s|$)/);
    if (numericDateMatch) {
      const day = Number(numericDateMatch[2]);
      const month = Number(numericDateMatch[3]);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        const date = futureDateForMonthDay(now, month - 1, day);
        tokens.push({ type: 'date', label: date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }), value: toDateKey(date) });
        title = consumeMatch(title, numericDateMatch);
      }
    }
  }

  // Clock time: "o 12:15", "o 8", "12:15" (not confused with duration, which requires an h/min suffix)
  const timeMatch = title.match(/(^|\s)o\s+([01]?\d|2[0-3])(?:[:.]([0-5]\d))?(?=\s|$)/i)
    || title.match(/(^|\s)([01]?\d|2[0-3]):([0-5]\d)(?=\s|$)/);
  if (timeMatch) {
    const hour = Number(timeMatch[2]);
    const minute = timeMatch[3] ? Number(timeMatch[3]) : 0;
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    tokens.push({ type: 'time', label: `${hh}:${mm}`, value: `${hh}:${mm}` });
    title = consumeMatch(title, timeMatch);
  }

  // Duration: "30min", "1h", "1.5h", "2h30min", "90min", "45m"
  const durationMatch = title.match(/(^|\s)(\d+(?:[.,]\d+)?)\s*h(?:(?:our|rs?)?(?:\s*(\d+)\s*m(?:in)?)?)?(?=\s|$)|(^|\s)(\d+)\s*m(?:in)?(?=\s|$)/i);
  if (durationMatch) {
    let minutes = 0;
    if (durationMatch[2]) {
      // Xh or Xh Ym form
      const hours = parseFloat(durationMatch[2].replace(',', '.'));
      minutes = Math.round(hours * 60);
      if (durationMatch[3]) minutes += parseInt(durationMatch[3]);
    } else if (durationMatch[5]) {
      // Xmin or Xm form
      minutes = parseInt(durationMatch[5]);
    }
    if (minutes > 0 && minutes <= 480) {
      const label = minutes < 60 ? `${minutes}min` : minutes % 60 === 0 ? `${minutes / 60}h` : `${Math.floor(minutes / 60)}h${minutes % 60}min`;
      tokens.push({ type: 'duration', label, value: String(minutes) });
      title = consumeMatch(title, durationMatch);
    }
  }

  const priority = tokens.find((token) => token.type === 'priority')?.value || null;
  const due_date = tokens.find((token) => token.type === 'date')?.value || null;
  const scheduled_time = tokens.find((token) => token.type === 'time')?.value || null;
  const duration_minutes = tokens.find((token) => token.type === 'duration')?.value
    ? parseInt(tokens.find((token) => token.type === 'duration')!.value)
    : null;

  return {
    title: cleanTitle(title),
    priority,
    due_date,
    scheduled_time,
    duration_minutes,
    tokens,
  };
}
