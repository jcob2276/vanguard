import { formatDayLabel } from '../../../../lib/date';
import { type ParsedFoodItem as NLFoodItem } from '../../../../lib/health/foodLogging';

export interface FoodBase {
  barcode: string | null;
  name: string;
  brand: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  defaultGrams?: number | null;
}

export interface Favorite extends FoodBase {
  id: string;
  use_count: number;
  default_grams: number;
}

export interface RecentEntry {
  id: string;
  name: string;
  brand: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  amount: string | null;
  date: string;
  meal_type?: string | null;
}

export type NLItem = NLFoodItem;

export function parseGrams(amount: string | null): number {
  if (!amount) return 100;
  const m = amount.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return 100;
  return Math.round(parseFloat(m[1].replace(',', '.')));
}

export function derivePer100(entry: RecentEntry) {
  const g = Math.max(1, parseGrams(entry.amount));
  return {
    calories: (entry.calories ?? 0) * 100 / g,
    protein: (entry.protein ?? 0) * 100 / g,
    carbs: entry.carbs != null ? entry.carbs * 100 / g : null,
    fat: entry.fat != null ? entry.fat * 100 / g : null,
  };
}

export function scale(value: number | null, grams: number): number | null {
  if (value == null) return null;
  return Math.round((value * grams) / 100 * 10) / 10;
}

export function dayLabel(dateStr: string, todayStr: string, yesterdayStr: string): string {
  const lbl = formatDayLabel(dateStr, todayStr, yesterdayStr, true);
  return lbl === 'Dziś' ? 'Dzisiaj' : lbl;
}
