import { shiftDateStr } from './date.ts';

export const LIFE_OBLIGATION_KINDS = [
  'people',
  'vehicle',
  'document',
  'home',
  'finance',
  'health_admin',
] as const;

export type LifeObligationKind = (typeof LIFE_OBLIGATION_KINDS)[number];

export const LIFE_OBLIGATION_RECURRENCES = ['yearly', 'once', 'monthly'] as const;
export type LifeObligationRecurrence = (typeof LIFE_OBLIGATION_RECURRENCES)[number];

export const LIFE_OBLIGATION_KIND_LABELS: Record<LifeObligationKind, string> = {
  people: 'Ludzie',
  vehicle: 'Pojazd',
  document: 'Dokumenty',
  home: 'Dom',
  finance: 'Finanse',
  health_admin: 'Zdrowie admin',
};

export const LIFE_OBLIGATION_RECURRENCE_LABELS: Record<LifeObligationRecurrence, string> = {
  yearly: 'Co rok',
  monthly: 'Co miesiąc',
  once: 'Jednorazowo',
};

/** Sensible default cycle per kind (birthdays / inspection / policy = yearly). */
export const DEFAULT_RECURRENCE: Record<LifeObligationKind, LifeObligationRecurrence> = {
  people: 'yearly',
  vehicle: 'yearly',
  document: 'yearly',
  home: 'yearly',
  finance: 'monthly',
  health_admin: 'yearly',
};

/** Default lead offsets (days before occurrence). Negative = before. */
export const DEFAULT_LEAD_OFFSETS: Record<LifeObligationKind, number[]> = {
  people: [-14, -7, 0],
  vehicle: [-30, -14, -7],
  document: [-60, -30, -14],
  home: [-14, -7, 0],
  finance: [-30, -14, -7],
  health_admin: [-30, -14, -7],
};

export interface LifeObligationLike {
  anchor_date: string;
  recurrence: LifeObligationRecurrence | string;
  lead_offsets: number[];
  sent_reminders?: unknown;
}

function parseYmd(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m, d };
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Next occurrence on or after `today` (YYYY-MM-DD, Warsaw calendar). */
export function nextOccurrence(
  anchorDate: string,
  recurrence: string,
  today: string,
): string | null {
  if (!anchorDate || !today) return null;
  const anchor = parseYmd(anchorDate);
  const now = parseYmd(today);

  if (recurrence === 'once') {
    return anchorDate >= today ? anchorDate : null;
  }

  if (recurrence === 'monthly') {
    let candidate = ymd(now.y, now.m, Math.min(anchor.d, daysInMonth(now.y, now.m)));
    if (candidate < today) {
      const nextM = now.m === 12 ? 1 : now.m + 1;
      const nextY = now.m === 12 ? now.y + 1 : now.y;
      candidate = ymd(nextY, nextM, Math.min(anchor.d, daysInMonth(nextY, nextM)));
    }
    return candidate;
  }

  // yearly (default)
  let candidate = ymd(now.y, anchor.m, Math.min(anchor.d, daysInMonth(now.y, anchor.m)));
  if (candidate < today) {
    candidate = ymd(now.y + 1, anchor.m, Math.min(anchor.d, daysInMonth(now.y + 1, anchor.m)));
  }
  return candidate;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function daysUntil(occurrence: string, today: string): number {
  const a = new Date(`${occurrence}T12:00:00Z`).getTime();
  const b = new Date(`${today}T12:00:00Z`).getTime();
  return Math.round((a - b) / 86_400_000);
}

export function reminderKey(occurrence: string, offset: number): string {
  return `${occurrence}:${offset}`;
}

export function parseSentReminders(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

/**
 * Lead offsets due today for this obligation (not yet in sent_reminders).
 * Offset 0 = day of occurrence; -7 = seven days before.
 */
export function dueLeadOffsetsToday(
  obligation: LifeObligationLike,
  today: string,
): { occurrence: string; offset: number; key: string }[] {
  const occurrence = nextOccurrence(obligation.anchor_date, obligation.recurrence, today);
  if (!occurrence) return [];

  const sent = new Set(parseSentReminders(obligation.sent_reminders));
  const offsets = obligation.lead_offsets?.length
    ? obligation.lead_offsets
    : [-14, -7, 0];

  const due: { occurrence: string; offset: number; key: string }[] = [];
  for (const offset of offsets) {
    const remindOn = shiftDateStr(occurrence, offset);
    if (remindOn !== today) continue;
    const key = reminderKey(occurrence, offset);
    if (sent.has(key)) continue;
    due.push({ occurrence, offset, key });
  }
  return due;
}

export function leadLabel(offset: number): string {
  if (offset === 0) return 'w dniu';
  if (offset < 0) return `${Math.abs(offset)} dni wcześniej`;
  return `${offset} dni po`;
}
