import { addDays, addHours, addMinutes, addMonths, addWeeks, format, startOfDay } from 'date-fns';

const PRIORITIES = {
  p1: { value: 'urgent', label: 'P1' },
  p2: { value: 'high', label: 'P2' },
  p3: { value: 'normal', label: 'P3' },
  p4: { value: 'low', label: 'P4' },
  pilne: { value: 'urgent', label: 'Pilne' },
  ważne: { value: 'high', label: 'Ważne' },
  wazne: { value: 'high', label: 'Ważne' },
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
  ['sty', 'stycznia'], ['lut', 'lutego'], ['mar', 'marca'], ['kwi', 'kwietnia'],
  ['maj', 'maja'], ['cze', 'czerwca'], ['lip', 'lipca'], ['sie', 'sierpnia'],
  ['wrz', 'wrzesnia', 'września'], ['paz', 'paź', 'pazdziernika', 'października'],
  ['lis', 'listopada'], ['gru', 'grudnia'],
];

type TokenType = 'priority' | 'date' | 'deadline' | 'duration' | 'time' | 'recurrence' | 'tag';
interface ParsedToken { type: TokenType; label: string; value: string }

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alternatives = (groups: string[][]) => groups.flat().map(escape).join('|');
const boundary = (source: string) => new RegExp(`(^|\\s)(${source})(?=\\s|$|[,.!?])`, 'i');
const toDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

export const TODO_NLP_HIGHLIGHT_REGEX = /((?:\b(?:p[1-4]|pilne|ważne|wazne|dzisiaj|dzis|dziś|jutro|pojutrze|za\s+(?:tydzień|tydzien|\d+\s+(?:dni|dzień|dzien|tygodnie|tygodni|miesiące|miesiace|miesięcy|miesiecy|min(?:ut(?:y|ę)?)?|godz(?:in(?:y|ę)?)?))|(?:w\s+)?(?:następny\s+|nastepny\s+)?(?:poniedziałek|poniedzialek|wtorek|środa|sroda|czwartek|piątek|piatek|sobota|niedziela)|codziennie|co\s+(?:dzień|dzien|tydzień|tydzien|miesiąc|miesiac|poniedziałek|poniedzialek|wtorek|środa|sroda|czwartek|piątek|piatek|sobota|niedziela)|(?:każdy|kazdy)\s+(?:poniedziałek|poniedzialek|wtorek|środa|sroda|czwartek|piątek|piatek|sobota|niedziela)|(?:o|na|godz\.?|godzina)\s*\d{1,2}(?:[:.]\d{2})?|\d{1,2}:\d{2}|rano|w\s+południe|w\s+poludnie|wieczorem|w\s+nocy|\d{1,2}[./-]\d{1,2}(?:[./-]20\d{2})?)\b)|(?:#[\p{L}\d_-]+))/giu;

function consume(text: string, match: RegExpMatchArray): string {
  if (match.index == null) return text;
  return `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`;
}

function cleanTitle(title: string): string {
  return title.replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
}

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

function futureMonthDay(now: Date, month: number, day: number, year?: number): Date | null {
  const today = startOfDay(now);
  if (year != null) return validDate(year, month, day);
  const current = validDate(today.getFullYear(), month, day);
  if (!current) return null;
  return current < today ? validDate(today.getFullYear() + 1, month, day) : current;
}

function nextWeekday(now: Date, weekday: number): Date {
  const today = startOfDay(now);
  return addDays(today, (weekday - today.getDay() + 7) % 7 || 7);
}

function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' }).format(date);
}

export function parseTodoQuickInput(input: string | null | undefined, now: Date = new Date()) {
  let title = String(input || '');
  let dateExplicit = false;
  const tokens: ParsedToken[] = [];
  const has = (type: TokenType) => tokens.some((token) => token.type === type);
  const add = (type: TokenType, label: string, value: string) => tokens.push({ type, label, value });

  const priority = title.match(boundary('p[1-4]'))
    || title.match(/(^|\s)(pilne|ważne|wazne)(?=\s*$)/i);
  if (priority) {
    const meta = PRIORITIES[priority[2].toLocaleLowerCase('pl-PL') as keyof typeof PRIORITIES];
    add('priority', meta.label, meta.value);
    title = consume(title, priority);
  }

  const deadline = title.match(/(^|\s)do\s+(jutra|pojutrza|poniedziałku|poniedzialku|wtorku|środy|srody|czwartku|piątku|piatku|soboty|niedzieli|[0-3]?\d[./-][01]?\d(?:[./-]20\d{2})?)(?=\s|$|[,.!?])/i);
  if (deadline) {
    const raw = deadline[2].toLocaleLowerCase('pl-PL');
    const inflectedWeekdays: Record<string, number> = {
      niedzieli: 0, 'poniedziałku': 1, poniedzialku: 1, wtorku: 2,
      'środy': 3, srody: 3, czwartku: 4, 'piątku': 5, piatku: 5, soboty: 6,
    };
    let value: Date | null = raw === 'jutra' ? addDays(now, 1) : raw === 'pojutrza' ? addDays(now, 2) : null;
    if (raw in inflectedWeekdays) value = nextWeekday(now, inflectedWeekdays[raw]);
    const numeric = raw.match(/^([0-3]?\d)[./-]([01]?\d)(?:[./-](20\d{2}))?$/);
    if (numeric) value = futureMonthDay(now, Number(numeric[2]) - 1, Number(numeric[1]), numeric[3] ? Number(numeric[3]) : undefined);
    if (value) {
      add('deadline', `Do ${dateLabel(value)}`, toDateKey(value));
      title = consume(title, deadline);
    }
  }

  const recurringWeekday = title.match(boundary(`(?:co|każdy|kazdy|w\\s+każdy|w\\s+kazdy)\\s+(${alternatives(WEEKDAYS)})`));
  let recurrence: string | null = null;
  if (recurringWeekday) {
    const weekdayWord = recurringWeekday[3].toLocaleLowerCase('pl-PL');
    const weekday = WEEKDAYS.findIndex((aliases) => aliases.includes(weekdayWord));
    const date = nextWeekday(now, weekday);
    recurrence = 'weekly';
    add('recurrence', `Co ${weekdayWord}`, recurrence);
    add('date', dateLabel(date), toDateKey(date));
    dateExplicit = true;
    title = consume(title, recurringWeekday);
  } else {
    const recurring = title.match(boundary('codziennie|co\\s+dzień|co\\s+dzien|co\\s+tydzień|co\\s+tydzien|co\\s+miesiąc|co\\s+miesiac'));
    if (recurring) {
      const raw = recurring[2].toLocaleLowerCase('pl-PL');
      recurrence = raw.includes('tydzie') ? 'weekly' : raw.includes('miesi') ? 'monthly' : 'daily';
      add('recurrence', recurrence === 'daily' ? 'Codziennie' : recurrence === 'weekly' ? 'Co tydzień' : 'Co miesiąc', recurrence);
      title = consume(title, recurring);
    }
  }

  const relativeClock = title.match(boundary('za\\s+(\\d+)\\s*(min(?:ut(?:y|ę)?)?|godz(?:in(?:y|ę)?)?)'));
  if (relativeClock) {
    const amount = Number(relativeClock[3]);
    const target = relativeClock[4].startsWith('godz') ? addHours(now, amount) : addMinutes(now, amount);
    add('date', dateLabel(target), toDateKey(target));
    dateExplicit = true;
    add('time', format(target, 'HH:mm'), format(target, 'HH:mm'));
    title = consume(title, relativeClock);
  }

  if (!has('date')) {
    const relative = title.match(boundary('dzisiaj|dzis|dziś|jutro|pojutrze|za\\s+tydzień|za\\s+tydzien|za\\s+(\\d+)\\s+(dni|dzień|dzien|tygodnie|tygodni|miesiące|miesiace|miesięcy|miesiecy)'));
    if (relative) {
      const raw = relative[2].toLocaleLowerCase('pl-PL');
      const amount = Number(relative[3] || 1);
      const date = raw === 'jutro' ? addDays(now, 1)
        : raw === 'pojutrze' ? addDays(now, 2)
        : raw.includes('tydzie') || raw.includes('tygod') ? addWeeks(now, amount)
        : raw.includes('miesi') ? addMonths(now, amount)
        : raw.startsWith('za ') ? addDays(now, amount)
        : now;
      add('date', dateLabel(date), toDateKey(date));
      dateExplicit = true;
      title = consume(title, relative);
    }
  }

  if (!has('date')) {
    const weekday = title.match(boundary(`(?:w\\s+)?(?:następny\\s+|nastepny\\s+)?${alternatives(WEEKDAYS)}`));
    if (weekday) {
      const raw = weekday[2].trim().split(/\s+/).at(-1)!.toLocaleLowerCase('pl-PL');
      const index = WEEKDAYS.findIndex((aliases) => aliases.includes(raw));
      const date = nextWeekday(now, index);
      add('date', dateLabel(date), toDateKey(date));
      dateExplicit = true;
      title = consume(title, weekday);
    }
  }

  if (!has('date')) {
    const namedDate = title.match(new RegExp(`(^|\\s)([0-3]?\\d)\\s+(${alternatives(MONTHS)})(?:\\s+(20\\d{2}))?(?=\\s|$|[,.!?])`, 'i'));
    if (namedDate) {
      const month = MONTHS.findIndex((aliases) => aliases.includes(namedDate[3].toLocaleLowerCase('pl-PL')));
      const date = futureMonthDay(now, month, Number(namedDate[2]), namedDate[4] ? Number(namedDate[4]) : undefined);
      if (date) { add('date', dateLabel(date), toDateKey(date)); dateExplicit = true; title = consume(title, namedDate); }
    }
  }

  if (!has('date')) {
    const numeric = title.match(/(^|\s)([0-3]?\d)[./-]([01]?\d)(?:[./-](20\d{2}))?(?=\s|$|[,.!?])/);
    if (numeric) {
      const date = futureMonthDay(now, Number(numeric[3]) - 1, Number(numeric[2]), numeric[4] ? Number(numeric[4]) : undefined);
      if (date) { add('date', dateLabel(date), toDateKey(date)); dateExplicit = true; title = consume(title, numeric); }
    }
  }

  const time = title.match(/(^|\s)(?:o|na|godz\.?|godzina)\s*([01]?\d|2[0-3])(?:[:.]([0-5]\d))?(?=\s|$|[,.!?])/i)
    || title.match(/(^|\s)([01]?\d|2[0-3]):([0-5]\d)(?=\s|$|[,.!?])/);
  const period = !time && title.match(boundary('rano|w\\s+południe|w\\s+poludnie|wieczorem|w\\s+nocy'));
  if (time) {
    const value = `${String(Number(time[2])).padStart(2, '0')}:${String(Number(time[3] || 0)).padStart(2, '0')}`;
    add('time', value, value);
    title = consume(title, time);
  } else if (period) {
    const raw = period[2].toLocaleLowerCase('pl-PL');
    const value = raw.includes('połud') || raw.includes('polud') ? '12:00' : raw.includes('wiecz') ? '18:00' : raw.includes('nocy') ? '22:00' : '08:00';
    add('time', value, value);
    title = consume(title, period);
  }
  if (has('time') && !has('date')) add('date', 'Dzisiaj', toDateKey(now));

  const duration = title.match(/(^|\s)(?:(\d+(?:[.,]\d+)?)\s*(?:h|godz(?:in(?:y|ę)?)?)(?:\s*(\d+)\s*m(?:in(?:ut)?)?)?|(\d+)\s*m(?:in(?:ut(?:y|ę)?)?)?)(?=\s|$|[,.!?])/i);
  if (duration) {
    const minutes = duration[2] ? Math.round(Number(duration[2].replace(',', '.')) * 60) + Number(duration[3] || 0) : Number(duration[4]);
    if (minutes >= 5 && minutes <= 1440) {
      add('duration', minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} godz.${minutes % 60 ? ` ${minutes % 60} min` : ''}`, String(minutes));
      title = consume(title, duration);
    }
  }

  const tagMatches = [...title.matchAll(/(^|\s)#([\p{L}\d_-]+)(?=\s|$|[,.!?])/giu)];
  for (const match of tagMatches) add('tag', `#${match[2]}`, match[2].toLocaleLowerCase('pl-PL'));
  for (const match of [...tagMatches].reverse()) title = consume(title, match);

  if (recurrence && !has('date')) add('date', 'Dzisiaj', toDateKey(now));

  const token = (type: TokenType) => tokens.find((item) => item.type === type)?.value || null;
  return {
    title: cleanTitle(title),
    priority: token('priority'),
    due_date: token('date'),
    deadline_date: token('deadline'),
    scheduled_time: token('time'),
    duration_minutes: token('duration') ? Number(token('duration')) : null,
    recurrence,
    date_explicit: dateExplicit,
    tags: tokens.filter((item) => item.type === 'tag').map((item) => item.value),
    tokens,
  };
}
