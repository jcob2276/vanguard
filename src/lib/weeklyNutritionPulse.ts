export type NutritionDayRow = {
  date: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  avg_food_quality: number | null;
  insulin_load: number | null;
};

export type WeeklyNutritionPulseData = {
  loggedDays: number;
  avgCalories: number | null;
  avgProtein: number | null;
  avgCarbs: number | null;
  avgFat: number | null;
  avgFiber: number | null;
  avgSugar: number | null;
  avgQuality: number | null;
  avgInsulin: number | null;
  caloriesDeltaPct: number;
  proteinGoal: number;
  kcalTarget: number;
  proteinOnTrack: boolean;
};

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round0(value: number | null): number | null {
  return value == null ? null : Math.round(value);
}

function round1(value: number | null): number | null {
  return value == null ? null : Math.round(value * 10) / 10;
}

function isLoggedDay(row: NutritionDayRow): boolean {
  return (row.calories ?? 0) > 0 || (row.protein ?? 0) > 0;
}

export function buildWeeklyNutritionPulse(input: {
  rows: NutritionDayRow[];
  proteinGoal: number;
  kcalTarget: number;
}): WeeklyNutritionPulseData {
  const logged = input.rows.filter(isLoggedDay);
  const avgCalories = round0(mean(logged.flatMap((r) => (r.calories == null || r.calories <= 0 ? [] : [r.calories]))));
  const avgProtein = round0(mean(logged.flatMap((r) => (r.protein == null || r.protein <= 0 ? [] : [r.protein]))));
  const avgCarbs = round0(mean(logged.flatMap((r) => (r.carbs == null ? [] : [r.carbs]))));
  const avgFat = round0(mean(logged.flatMap((r) => (r.fat == null ? [] : [r.fat]))));
  const avgFiber = round1(mean(logged.flatMap((r) => (r.fiber == null ? [] : [r.fiber]))));
  const avgSugar = round0(mean(logged.flatMap((r) => (r.sugar == null ? [] : [r.sugar]))));
  const avgQuality = round0(mean(logged.flatMap((r) => (r.avg_food_quality == null ? [] : [r.avg_food_quality]))));
  const avgInsulin = round0(mean(logged.flatMap((r) => (r.insulin_load == null ? [] : [r.insulin_load]))));

  const caloriesDeltaPct =
    avgCalories != null && input.kcalTarget > 0
      ? Math.round(((avgCalories - input.kcalTarget) / input.kcalTarget) * 100)
      : 0;

  const proteinOnTrack = avgProtein !== null && avgProtein >= input.proteinGoal * 0.9;

  return {
    loggedDays: logged.length,
    avgCalories,
    avgProtein,
    avgCarbs,
    avgFat,
    avgFiber,
    avgSugar,
    avgQuality,
    avgInsulin,
    caloriesDeltaPct,
    proteinGoal: input.proteinGoal,
    kcalTarget: input.kcalTarget,
    proteinOnTrack,
  };
}

export function nutritionPulseHeadline(data: WeeklyNutritionPulseData): string {
  if (data.loggedDays < 5) return 'Uzupełnij brakujące dni';
  if (!data.proteinOnTrack) return 'Białko poniżej bezpiecznego zakresu';
  if (data.caloriesDeltaPct > 8) return 'Budżet kcal przekroczony';
  if (data.caloriesDeltaPct < -20) return 'Duży deficyt względem celu';
  if (data.avgQuality != null && data.avgQuality < 50) return 'Jakość diety wymaga uwagi';
  return 'Przebieg zgodny z planem';
}

export function formatGrams(value: number | null | undefined, unit = 'g'): string {
  if (value == null) return '—';
  return `${value} ${unit}`;
}
