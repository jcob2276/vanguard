import {
  daysUntil,
  nextOccurrence,
  type LifeObligationKind,
} from '@vanguard/domain';
import type { LifeObligation } from '../../lib/lifeObligationsApi';

export type UrgencyBucket = 'today' | 'week' | 'month' | 'later';

export interface DerivedObligation {
  item: LifeObligation;
  nextDate: string;
  daysLeft: number;
  bucket: UrgencyBucket;
  /** 0–1 progress toward occurrence; 1 = today or overdue framing as full. */
  ringProgress: number;
}

export const URGENCY_BUCKET_LABELS: Record<UrgencyBucket, string> = {
  today: 'Dziś',
  week: '7 dni',
  month: '30 dni',
  later: 'Później',
};

const RING_HORIZON_DAYS = 90;

export function urgencyBucket(daysLeft: number): UrgencyBucket {
  if (daysLeft <= 0) return 'today';
  if (daysLeft <= 7) return 'week';
  if (daysLeft <= 30) return 'month';
  return 'later';
}

export function ringProgress(daysLeft: number, horizonDays = RING_HORIZON_DAYS): number {
  if (daysLeft <= 0) return 1;
  if (daysLeft >= horizonDays) return 0.08;
  return 1 - daysLeft / horizonDays;
}

export function deriveObligation(item: LifeObligation, today: string): DerivedObligation | null {
  const nextDate = nextOccurrence(item.anchor_date, item.recurrence, today);
  if (!nextDate) return null;
  const daysLeft = daysUntil(nextDate, today);
  return {
    item,
    nextDate,
    daysLeft,
    bucket: urgencyBucket(daysLeft),
    ringProgress: ringProgress(daysLeft),
  };
}

export function deriveAll(items: LifeObligation[], today: string): DerivedObligation[] {
  return items
    .map((item) => deriveObligation(item, today))
    .filter((row): row is DerivedObligation => row != null)
    .sort((a, b) => a.daysLeft - b.daysLeft || a.nextDate.localeCompare(b.nextDate));
}

export function bucketMap(rows: DerivedObligation[]): Record<UrgencyBucket, DerivedObligation[]> {
  const map: Record<UrgencyBucket, DerivedObligation[]> = {
    today: [],
    week: [],
    month: [],
    later: [],
  };
  for (const row of rows) map[row.bucket].push(row);
  return map;
}

export function filterByKind(rows: DerivedObligation[], kind: LifeObligationKind): DerivedObligation[] {
  return rows.filter((row) => row.item.kind === kind);
}

export function initialsFrom(title: string, relatedName: string | null): string {
  const source = (relatedName || title).trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function countdownLabel(daysLeft: number): string {
  if (daysLeft <= 0) return 'Dziś';
  if (daysLeft === 1) return 'Jutro';
  return `${daysLeft} dni`;
}

export function monthsAheadDate(today: string, months: number): string {
  const [y, m, d] = today.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return today;
  const total = m - 1 + months;
  const ny = y + Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const dim = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`;
}

export function isYmd(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

export interface StarterTemplate {
  id: string;
  kind: LifeObligationKind;
  /** Domyślna nazwa typu (bez osób / marek). */
  title: string;
  related_name: string | null;
  monthsAhead: number;
  blurb: string;
  titlePlaceholder: string;
  relatedPlaceholder: string;
}

/** Szybkie typy — nie przykłady z życia („Mama”). */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'birthday',
    kind: 'people',
    title: 'Urodziny',
    related_name: null,
    monthsAhead: 2,
    blurb: 'Przypomnienia 14 · 7 · w dniu',
    titlePlaceholder: 'np. Urodziny',
    relatedPlaceholder: 'Imię osoby',
  },
  {
    id: 'anniversary',
    kind: 'people',
    title: 'Rocznica',
    related_name: null,
    monthsAhead: 3,
    blurb: 'Przypomnienia 14 · 7 · w dniu',
    titlePlaceholder: 'np. Rocznica',
    relatedPlaceholder: 'Imię / opis',
  },
  {
    id: 'vehicle-inspection',
    kind: 'vehicle',
    title: 'Przegląd techniczny',
    related_name: null,
    monthsAhead: 1,
    blurb: 'Przypomnienia 30 · 14 · 7',
    titlePlaceholder: 'np. Przegląd techniczny',
    relatedPlaceholder: 'Marka / rejestracja',
  },
  {
    id: 'vehicle-insurance',
    kind: 'vehicle',
    title: 'Ubezpieczenie OC',
    related_name: null,
    monthsAhead: 2,
    blurb: 'Przypomnienia 30 · 14 · 7',
    titlePlaceholder: 'np. Ubezpieczenie OC',
    relatedPlaceholder: 'Marka / rejestracja',
  },
  {
    id: 'insurance-policy',
    kind: 'document',
    title: 'Polisa',
    related_name: null,
    monthsAhead: 3,
    blurb: 'Przypomnienia 60 · 30 · 14',
    titlePlaceholder: 'np. Polisa mieszkania',
    relatedPlaceholder: 'Co obejmuje (opcjonalnie)',
  },
  {
    id: 'passport',
    kind: 'document',
    title: 'Paszport / dowód',
    related_name: null,
    monthsAhead: 6,
    blurb: 'Przypomnienia 60 · 30 · 14',
    titlePlaceholder: 'np. Paszport',
    relatedPlaceholder: 'Dla kogo (opcjonalnie)',
  },
];

export function templatesForKind(kind: LifeObligationKind): StarterTemplate[] {
  return STARTER_TEMPLATES.filter((t) => t.kind === kind);
}
