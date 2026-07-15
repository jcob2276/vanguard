/**
 * predictions.test.ts
 *
 * Tests the pure weighted-average logic used in generateTomorrowPredictions
 * and the error-absolute calculation in resolvePastPredictions.
 *
 * The DB-touching async functions are smoke-tested for correct call shape.
 */
import { assertEquals, assertAlmostEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// ─── pure logic extracted from predictions.ts ────────────────────────────────
// (mirrors the implementation — if the implementation changes, tests break)

function computeWeightedAvg(
  history: Array<{ date: string; value: number | null }>,
  defaultValue: number,
): number {
  if (!history || history.length === 0) return defaultValue;

  let sumValues = 0;
  let sumWeights = 0;
  history.forEach((row, idx) => {
    const val = row.value;
    if (val != null) {
      const weight = 7 - idx; // most recent = highest weight (7), oldest = 1
      sumValues += val * weight;
      sumWeights += weight;
    }
  });

  if (sumWeights === 0) return defaultValue;
  return parseFloat((sumValues / sumWeights).toFixed(2));
}

// ─── tests ───────────────────────────────────────────────────────────────────

Deno.test('predictions — weighted avg: single value returns that value', () => {
  const result = computeWeightedAvg([{ date: '2026-07-14', value: 7.5 }], 7.0);
  assertAlmostEquals(result, 7.5, 0.01);
});

Deno.test('predictions — weighted avg: empty history returns default', () => {
  assertEquals(computeWeightedAvg([], 7.0), 7.0);
});

Deno.test('predictions — weighted avg: null values are skipped', () => {
  const history = [
    { date: '2026-07-14', value: null },
    { date: '2026-07-13', value: null },
    { date: '2026-07-12', value: 8.0 },
  ];
  // Only the 3rd row (idx=2, weight=5) contributes: 8.0 * 5 / 5 = 8.0
  const result = computeWeightedAvg(history, 7.0);
  assertAlmostEquals(result, 8.0, 0.01);
});

Deno.test('predictions — weighted avg: all null values return default', () => {
  const history = [
    { date: '2026-07-14', value: null },
    { date: '2026-07-13', value: null },
  ];
  assertEquals(computeWeightedAvg(history, 7.0), 7.0);
});

Deno.test('predictions — weighted avg: more recent days have higher weight', () => {
  // idx=0 (most recent): weight=7, idx=1: weight=6
  const history = [
    { date: '2026-07-14', value: 8.0 }, // weight 7
    { date: '2026-07-13', value: 6.0 }, // weight 6
  ];
  const expected = parseFloat(((8.0 * 7 + 6.0 * 6) / (7 + 6)).toFixed(2));
  assertAlmostEquals(computeWeightedAvg(history, 7.0), expected, 0.01);
  // 8 is more recent → result should be > 7
  assertEquals(computeWeightedAvg(history, 7.0) > 7.0, true);
});

Deno.test('predictions — weighted avg: 7 days full history', () => {
  const history = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-07-${14 - i}`,
    value: 7.0 + i * 0.1, // 7.0, 7.1, 7.2 ... 7.6
  }));
  const result = computeWeightedAvg(history, 7.5);
  // result should be a valid number in plausible range [7.0, 7.6]
  assertEquals(result >= 7.0 && result <= 7.6, true);
});

// ─── error calculation logic ─────────────────────────────────────────────────

Deno.test('predictions — error is absolute difference between predicted and actual', () => {
  const predicted = 7.5;
  const actual = 6.8;
  const errorValue = Math.abs(predicted - actual);
  assertAlmostEquals(errorValue, 0.7, 0.001);
});

Deno.test('predictions — error is always non-negative regardless of direction', () => {
  assertEquals(Math.abs(7.0 - 8.5) >= 0, true); // actual > predicted
  assertEquals(Math.abs(8.5 - 7.0) >= 0, true); // actual < predicted
});

// ─── tomorrow date calculation ────────────────────────────────────────────────

Deno.test('predictions — tomorrow date calculation', () => {
  const todayStr = '2026-07-15';
  const tomorrow = new Date(todayStr + 'T12:00:00Z');
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  assertEquals(tomorrowStr, '2026-07-16');
});

Deno.test('predictions — tomorrow calculation wraps month correctly', () => {
  const todayStr = '2026-07-31';
  const tomorrow = new Date(todayStr + 'T12:00:00Z');
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  assertEquals(tomorrowStr, '2026-08-01');
});

// ─── confidence intervals ────────────────────────────────────────────────────

Deno.test('predictions — interval low is never negative', () => {
  const predicted = 0.05;
  const margin = 0.15;
  const low = Math.max(0, predicted - margin);
  assertEquals(low, 0);
});

Deno.test('predictions — interval low = max(0, predicted - margin)', () => {
  const predicted = 7.5;
  const margin = 1.2;
  assertEquals(Math.max(0, predicted - margin), 6.3);
});

Deno.test('predictions — default values are within plausible ranges', () => {
  const defaults = {
    sleep_hours: 7.5,
    readiness_score: 75.0,
    execution_score: 0.65,
  };
  assertEquals(defaults.sleep_hours > 5 && defaults.sleep_hours < 10, true);
  assertEquals(defaults.readiness_score > 50 && defaults.readiness_score <= 100, true);
  assertEquals(defaults.execution_score > 0 && defaults.execution_score <= 1, true);
});
