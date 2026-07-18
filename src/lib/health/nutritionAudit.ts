import type { FoodTrustLevel } from './foodTrust';

interface AuditableEntry {
  calories?: number | null;
  parse_meta?: unknown;
}

export interface NutritionDayAudit {
  score: number;
  label: string;
  uncertainEntries: number;
  incompleteEntries: number;
}

export function auditNutritionDay(entries: AuditableEntry[]): NutritionDayAudit {
  if (!entries.length) return { score: 0, label: 'Brak wpisów', uncertainEntries: 0, incompleteEntries: 0 };
  let uncertainEntries = 0;
  let incompleteEntries = 0;
  let penalty = 0;
  for (const entry of entries) {
    const meta = entry.parse_meta && typeof entry.parse_meta === 'object'
      ? entry.parse_meta as Record<string, unknown> : {};
    const level = meta.trust_level as FoodTrustLevel | undefined;
    if (entry.calories == null || entry.calories <= 0 || level === 'incomplete') {
      incompleteEntries += 1;
      penalty += 35;
    } else if (level === 'estimated' || !level) {
      uncertainEntries += 1;
      penalty += 16;
    } else if (level === 'reference') {
      uncertainEntries += 1;
      penalty += 6;
    }
  }
  const score = Math.max(0, Math.round(100 - penalty / entries.length));
  const label = score >= 90 ? 'Dane bardzo pewne' : score >= 70 ? 'Dane wystarczające' : 'Warto sprawdzić';
  return { score, label, uncertainEntries, incompleteEntries };
}

