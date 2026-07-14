import { useQuery } from '@tanstack/react-query';
import { supabase, invokeEdge } from './supabase';
import { NETWORK_TIMEOUT_MS } from './constants';

// Mirrors components/core/nutrition/hooks/foodEntryUtils.ts's FoodBase --
// duplicated rather than imported because src/lib must not import from
// src/components, and that file has 6 other component-tree consumers so
// moving it isn't a small change.
interface FoodBase {
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

const foodSearchKeys = {
  all: ['foodSearch'] as const,
  query: (userId: string, q: string) => [...foodSearchKeys.all, userId, q] as const,
};

async function fetchFoodSearch(userId: string, query: string): Promise<FoodBase[]> {
  const trimmed = query.trim();

  const libraryPromise = supabase
    .from('food_library')
    .select('name, brand, barcode, calories, protein, carbs, fat, fiber, sugar, default_grams')
    .eq('user_id', userId)
    .ilike('name', `%${trimmed}%`)
    .limit(10);

  const offPromise = invokeEdge<{ results?: FoodBase[] }>(
    `lookup-food?q=${encodeURIComponent(trimmed)}`,
    {
      method: 'GET',
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    }
  );

  const [libraryRes, offJson] = await Promise.all([libraryPromise, offPromise]);
  if (libraryRes.error) {
    console.error('[FoodEntryModal] food_library search failed', libraryRes.error);
  }

  const libraryResults: FoodBase[] = (libraryRes.data || []).map((r) => ({
    name: r.name,
    brand: r.brand,
    barcode: r.barcode,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    fiber: r.fiber,
    sugar: r.sugar,
    defaultGrams: r.default_grams,
  }));
  const seen = new Set(libraryResults.map((r) => r.name.toLowerCase()));
  const offResults: FoodBase[] = (offJson.results || []).filter(
    (r: FoodBase) => !seen.has(r.name.toLowerCase()),
  );
  return [...libraryResults, ...offResults];
}

/** query must already be debounced by the caller — this hook does no debouncing itself. */
export function useFoodSearchQuery(userId: string | undefined, query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: foodSearchKeys.query(userId || '', trimmed),
    queryFn: () => fetchFoodSearch(userId as string, trimmed),
    enabled: !!userId && trimmed.length >= 2,
  });
}
