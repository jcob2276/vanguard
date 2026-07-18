export type FoodSource =
  | 'confirmed'
  | 'history'
  | 'label_ocr'
  | 'off'
  | 'reference_pl'
  | 'generic'
  | 'estimated';

export type FoodTrustLevel = 'confirmed' | 'reference' | 'estimated' | 'incomplete';

export interface FoodTrustInput {
  source?: FoodSource | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  confidence?: 'high' | 'medium' | 'low';
}

export interface FoodTrust {
  level: FoodTrustLevel;
  uncertaintyPct: number | null;
  label: string;
}

export function deriveFoodTrust(food: FoodTrustInput): FoodTrust {
  if (food.calories == null || food.calories < 0) {
    return { level: 'incomplete', uncertaintyPct: null, label: 'Brak danych' };
  }
  if (food.source === 'confirmed' || food.source === 'history') {
    return { level: 'confirmed', uncertaintyPct: 3, label: 'Potwierdzone' };
  }
  if (food.source === 'label_ocr') {
    if (food.confidence === 'low') return { level: 'estimated', uncertaintyPct: 25, label: 'Etykieta do sprawdzenia' };
    if (food.confidence === 'medium') return { level: 'reference', uncertaintyPct: 10, label: 'Z etykiety · sprawdź' };
    return { level: 'confirmed', uncertaintyPct: 5, label: 'Z etykiety' };
  }
  if (food.source === 'off' || food.source === 'reference_pl') {
    return { level: 'reference', uncertaintyPct: 10, label: 'Dane referencyjne' };
  }
  return { level: 'estimated', uncertaintyPct: 25, label: 'Szacunek' };
}

export function calorieRange(calories: number | null, uncertaintyPct: number | null) {
  if (calories == null || uncertaintyPct == null) return null;
  const delta = calories * uncertaintyPct / 100;
  return { min: Math.max(0, Math.round(calories - delta)), max: Math.round(calories + delta) };
}

export function foodTrustMeta(food: FoodTrustInput) {
  const trust = deriveFoodTrust(food);
  return {
    source: food.source ?? 'estimated',
    trust_level: trust.level,
    uncertainty_pct: trust.uncertaintyPct,
    parser_version: 'food-trust-v1',
  };
}
