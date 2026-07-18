import { NETWORK_TIMEOUT_MS } from '../constants';
import { invokeEdge, supabase } from '../supabase';
import type { FoodBase } from './foodTypes';

export interface ExternalFoodSearchResult {
  results: FoodBase[];
  status: 'ok' | 'unavailable' | 'rate_limited';
  incompleteCount: number;
}

const normalize = (value: string) => value
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLocaleLowerCase('pl');

export function rankFoodResult(food: Pick<FoodBase, 'name' | 'brand'> & { useCount?: number }, query: string) {
  const needle = normalize(query.trim());
  const name = normalize(food.name);
  const brand = normalize(food.brand ?? '');
  const match = name === needle ? 100 : name.startsWith(needle) ? 70 : name.includes(needle) ? 45 : brand.includes(needle) ? 25 : 0;
  return match + Math.min(20, food.useCount ?? 0);
}

export async function searchPrivateFoodLibrary(userId: string, query: string): Promise<FoodBase[]> {
  const { data, error } = await supabase
    .from('food_library')
    .select('name,brand,barcode,calories,protein,carbs,fat,fiber,sugar,default_grams')
    .eq('user_id', userId)
    .limit(250);
  if (error) throw error;
  return (data ?? [])
    .map((row) => ({
      name: row.name, brand: row.brand, barcode: row.barcode,
      calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat,
      fiber: row.fiber, sugar: row.sugar, defaultGrams: row.default_grams,
      source: 'confirmed' as const,
    }))
    .filter((food) => rankFoodResult(food, query) > 0)
    .sort((a, b) => rankFoodResult(b, query) - rankFoodResult(a, query))
    .slice(0, 12);
}

export async function searchExternalFoods(query: string): Promise<ExternalFoodSearchResult> {
  return invokeEdge('lookup-food', {
    method: 'GET', query: { q: query.trim() }, signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
}

export async function lookupFoodBarcode(code: string): Promise<FoodBase | null> {
  const response = await invokeEdge('lookup-food', {
    method: 'GET', query: { barcode: code }, signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
  return response.results[0] ?? null;
}
