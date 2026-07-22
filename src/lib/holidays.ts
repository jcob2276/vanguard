/**
 * Polish National Holidays & Special Dates Engine
 * Single source of truth for Polish fixed and moveable statutory holidays.
 */

export interface PolishHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  isFreeDay: boolean;
}

/**
 * Calculates Easter Sunday for a given year using Meeus/Jones/Butcher algorithm.
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed month
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Returns all statutory Polish holidays for a given year.
 */
export function getPolishHolidays(year: number): Record<string, PolishHoliday> {
  const map: Record<string, PolishHoliday> = {};

  const add = (dateStr: string, name: string, isFreeDay = true) => {
    map[dateStr] = { date: dateStr, name, isFreeDay };
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  // Fixed holidays
  add(`${year}-01-01`, 'Nowy Rok');
  add(`${year}-01-06`, 'Trzech Króli (Objawienie Pańskie)');
  add(`${year}-05-01`, 'Święto Pracy');
  add(`${year}-05-03`, 'Święto Konstytucji 3 Maja');
  add(`${year}-08-15`, 'Wniebowzięcie NMP / Święto Wojska Polskiego');
  add(`${year}-11-01`, 'Wszystkich Świętych');
  add(`${year}-11-11`, 'Święto Niepodległości');
  add(`${year}-12-25`, 'Boże Narodzenie (Pierwszy Dzień)');
  add(`${year}-12-26`, 'Boże Narodzenie (Drugi Dzień)');

  // Moveable holidays (based on Easter)
  const easter = getEasterSunday(year);
  const easterMonday = addDays(easter, 1);
  const pentecost = addDays(easter, 49); // Zielone Świątki (niedziela)
  const corpusChristi = addDays(easter, 60); // Boże Ciało (czwartek)

  add(formatDate(easter), 'Wielkanoc (Niedziela Wielkanocna)');
  add(formatDate(easterMonday), 'Poniedziałek Wielkanocny');
  add(formatDate(pentecost), 'Zielone Świątki');
  add(formatDate(corpusChristi), 'Boże Ciało');

  return map;
}

/**
 * Cache for calculated holidays per year
 */
const holidayCache: Record<number, Record<string, PolishHoliday>> = {};

export function getPolishHolidayForDate(dateStr: string): PolishHoliday | null {
  if (!dateStr || dateStr.length < 10) return null;
  const year = Number(dateStr.slice(0, 4));
  if (isNaN(year)) return null;

  if (!holidayCache[year]) {
    holidayCache[year] = getPolishHolidays(year);
  }

  return holidayCache[year][dateStr] || null;
}
