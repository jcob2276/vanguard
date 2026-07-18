import type { FoodSource } from './foodTrust';

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
  source?: FoodSource;
  useCount?: number;
  incomplete?: boolean;
  confidence?: 'high' | 'medium' | 'low';
}
