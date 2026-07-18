interface IntakeDay { date: string; calories: number | null }
interface WeightPoint { date: string; weight_kg: number | null }

export interface NutritionCalibration {
  status: 'ready' | 'collecting';
  loggedDays: number;
  averageCalories: number | null;
  weeklyWeightChangeKg: number | null;
  message: string;
}

export function calibrateNutrition(intake: IntakeDay[], weights: WeightPoint[]): NutritionCalibration {
  const validDays = intake.filter((day) => day.calories != null && day.calories > 500);
  const validWeights = weights.filter((point) => point.weight_kg != null).sort((a, b) => a.date.localeCompare(b.date));
  const averageCalories = validDays.length
    ? Math.round(validDays.reduce((sum, day) => sum + Number(day.calories), 0) / validDays.length) : null;
  if (validDays.length < 14 || validWeights.length < 2) {
    return {
      status: 'collecting', loggedDays: validDays.length, averageCalories, weeklyWeightChangeKg: null,
      message: `Kalibracja uczy się Twojego organizmu · ${validDays.length}/14 pełnych dni`,
    };
  }
  const first = validWeights[0];
  const last = validWeights[validWeights.length - 1];
  const days = Math.max(1, (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000);
  const change = (Number(last.weight_kg) - Number(first.weight_kg)) * 7 / days;
  const weeklyWeightChangeKg = Math.round(change * 100) / 100;
  const direction = Math.abs(change) < 0.08 ? 'stabilna' : change < 0 ? 'spada' : 'rośnie';
  return {
    status: 'ready', loggedDays: validDays.length, averageCalories, weeklyWeightChangeKg,
    message: `Przy średnio ${averageCalories} kcal masa ${direction} ${Math.abs(weeklyWeightChangeKg)} kg/tydz.`,
  };
}

