/** Shared keyword tables for Telegram + frontend todo parsers. Sunday = 0. */

export type TodoPriority = 'urgent' | 'high' | 'normal' | 'low';

export const TODO_PRIORITY_ALIASES: Record<string, { value: TodoPriority; label: string }> = {
  p1: { value: 'urgent', label: 'P1' },
  '!high': { value: 'urgent', label: 'P1' },
  pilne: { value: 'urgent', label: 'Pilne' },
  p2: { value: 'high', label: 'P2' },
  ważne: { value: 'high', label: 'Ważne' },
  wazne: { value: 'high', label: 'Ważne' },
  p3: { value: 'normal', label: 'P3' },
  p4: { value: 'low', label: 'P4' },
  '!low': { value: 'low', label: 'P4' },
  niski: { value: 'low', label: 'P4' },
};

/** Weekday alias groups indexed by JS getDay() (0 = Sunday). */
export const TODO_WEEKDAY_ALIASES: string[][] = [
  ['nd', 'niedz', 'niedziela', 'niedziel', 'niedzielę', 'niedziele'],
  ['pon', 'poniedzialek', 'poniedziałek', 'poniedzia'],
  ['wt', 'wtorek', 'wtore'],
  ['sr', 'sro', 'sroda', 'śr', 'śro', 'środa', 'środę'],
  ['czw', 'czwartek', 'czwarte'],
  ['pt', 'piatek', 'piątek', 'piąt'],
  ['sob', 'sobota', 'sobotę', 'sobot'],
];

export const TODO_TODAY_ALIASES = ['dziś', 'dzisiaj', 'dzis'] as const;
export const TODO_TOMORROW_ALIASES = ['jutro'] as const;
export const TODO_DAY_AFTER_ALIASES = ['pojutrze'] as const;

/** Flat map: lowercase alias → weekday index (0=Sun). */
export function weekdayIndexFromAlias(alias: string): number {
  const needle = alias.toLocaleLowerCase('pl-PL');
  return TODO_WEEKDAY_ALIASES.findIndex((group) => group.includes(needle));
}

export function resolvePriorityAlias(raw: string): { value: TodoPriority; label: string } | null {
  const key = raw.toLocaleLowerCase('pl-PL');
  return TODO_PRIORITY_ALIASES[key] ?? null;
}
