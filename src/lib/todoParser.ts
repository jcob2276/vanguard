const PRIORITY_TOKENS = {
  p1: { priority: 'urgent', label: 'P1' },
  p2: { priority: 'high', label: 'P2' },
  p3: { priority: 'normal', label: 'P3' },
  p4: { priority: 'low', label: 'P4' },
};

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

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function nextWeekday(now, weekday) {
  const today = startOfDay(now);
  const diff = (weekday - today.getDay() + 7) % 7 || 7;
  return addDays(today, diff);
}

function futureDateForMonthDay(now, monthIndex, day) {
  const today = startOfDay(now);
  let date = new Date(today.getFullYear(), monthIndex, day);
  if (date < today) date = new Date(today.getFullYear() + 1, monthIndex, day);
  return date;
}

function tokenPattern(words) {
  return words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}

function cleanTitle(title) {
  return title
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}

function consumeMatch(text, match) {
  return `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`;
}

export function parseTodoQuickInput(input, now = new Date()) {
  let title = String(input || '');
  const tokens = [];

  const priorityMatch = title.match(/(^|\s)(p[1-4])(?=\s|$)/i);
  if (priorityMatch) {
    const raw = priorityMatch[2].toLowerCase();
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

  const priority = tokens.find((token) => token.type === 'priority')?.value || null;
  const due_date = tokens.find((token) => token.type === 'date')?.value || null;

  return {
    title: cleanTitle(title),
    priority,
    due_date,
    tokens,
  };
}
