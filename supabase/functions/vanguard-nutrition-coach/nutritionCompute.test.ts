import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { computeNutritionSignals } from './nutritionCompute.ts';

Deno.test('computeNutritionSignals — standard stable inputs', () => {
  const data = {
    profile: {
      current_body_fat_est: 15,
      goal_body_fat: 12,
      weekly_loss_kg: 0.35,
      protein_g_per_kg: 2.0,
      birth_date: '1995-01-01',
      event_date: null,
    },
    bm: [
      { date: '2026-06-01', weight: 75.0, waist: 80, belly: 82 },
      { date: '2026-06-15', weight: 75.0, waist: 80, belly: 82 },
    ],
    oura: [
      { date: '2026-06-14', total_calories: 2500, active_calories: 400, steps: 8000, total_sleep_hours: 8, readiness_score: 80, hrv_avg: 50, rhr_avg: 55 },
      { date: '2026-06-15', total_calories: 2500, active_calories: 400, steps: 8000, total_sleep_hours: 8, readiness_score: 80, hrv_avg: 50, rhr_avg: 55 },
    ],
    nutr: [
      { date: '2026-06-14', calories: 2000, protein: 160, carbs: 200, fat: 70, fiber: 30 },
      { date: '2026-06-15', calories: 2000, protein: 160, carbs: 200, fat: 70, fiber: 30 },
    ],
    runs: [],
    gym: [],
    todayOura: { total_calories: 2500, active_calories: 400, steps: 8000 },
    todayNutr: { calories: 1500, protein: 120, carbs: 150, fat: 50, fiber: 20 },
    medicalContext: { alerts: [], hint: '' },
    today: '2026-06-15',
    targetDate: new Date('2026-06-15T12:00:00Z'),
    d30: '2026-05-16',
  };

  const { signals, estMaintenance, targetKcal, proteinFloor } = computeNutritionSignals(data);

  // weight trend is stable (weightChange = 0)
  assertEquals(signals.body.weight_trend_kg_per_week, 0);

  // protein floor: 75kg * 2.0 = 150g
  assertEquals(proteinFloor, 150);

  // ouraAdj = avgTdeeOura * 0.88 = 2500 * 0.88 = 2200
  // maintFromLog = avgIntake - deficit (0 surplus) = 2000
  // flat = true, underlogGap = 2200 - 2000 = 200. ouraAdj - maintFromLog = 200
  // since difference <= 200, estMaintenance = (ouraAdj + maintFromLog) / 2 = 2100
  assertEquals(estMaintenance, 2100);

  // targetKcal = estMaintenance - deficitPerDay - adaptiveCorrection + addBack
  // deficitPerDay = targetWeeklyLossKg * 7700 / 7 = 0.35 * 1100 = 385
  // targetKcal = 2100 - 385 - 0 + 0 = 1715
  assertEquals(targetKcal, 1715);

  // remaining calculations
  assertEquals(signals.today.remaining_kcal, 1715 - 1500); // 215
  assertEquals(signals.today.remaining_protein, 150 - 120); // 30
});

Deno.test('computeNutritionSignals — weight loss trend and goal estimation', () => {
  const data = {
    profile: {
      current_body_fat_est: 18,
      goal_body_fat: 14,
      weekly_loss_kg: 0.5,
      protein_g_per_kg: 2.0,
      birth_date: '1995-01-01',
      event_date: null,
    },
    bm: [
      { date: '2026-06-01', weight: 80.0 },
      { date: '2026-06-15', weight: 78.0 }, // lost 2kg in 14 days -> 1kg/week
    ],
    oura: [],
    nutr: [],
    runs: [],
    gym: [],
    todayOura: null,
    todayNutr: null,
    medicalContext: null,
    today: '2026-06-15',
    targetDate: new Date('2026-06-15T12:00:00Z'),
    d30: '2026-05-16',
  };

  const { signals, weightTrendPerWeek } = computeNutritionSignals(data);

  // 2kg lost in 14 days = 1kg / week loss -> trend = -1.0
  assertEquals(weightTrendPerWeek, -1.0);
  assertEquals(signals.forecast.observed_weekly_loss_kg, 1.0);

  // goal: 18% body fat to 14%.
  // 30d forecast weight: 78 + (-1/7)*30 = 78 - 4.28 = 73.7
  assertEquals(typeof signals.forecast.days_to_goal_est, 'number');
  assertEquals(signals.forecast.days_to_goal_est! > 0, true);
});
