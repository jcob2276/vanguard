import { assertEquals, assertAlmostEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { computeStrainScore, type StrainInput } from './strain_score.ts';

// ─── helpers ───────────────────────────────────────────────────────────────

function baseInput(overrides: Partial<StrainInput> = {}): StrainInput {
  return {
    z: null,
    runs: [],
    wsets: [],
    steps: null,
    kcal: null,
    carbs: null,
    protein: null,
    fuelingProvisional: false,
    weight: 80,
    ...overrides,
  };
}

// ─── tests ─────────────────────────────────────────────────────────────────

Deno.test('computeStrainScore — rest day: no data → strain null, confidence calibrating', () => {
  const result = computeStrainScore(baseInput());
  assertEquals(result.strain, null);
  assertEquals(result.strainConfidence, 'calibrating');
  assertEquals(result.rawTotal, 0);
});

Deno.test('computeStrainScore — steps only → building confidence, non-null strain', () => {
  const result = computeStrainScore(baseInput({ steps: 10_000 }));
  assertEquals(result.strainConfidence, 'building');
  assertEquals(result.stepsLoad, 20); // 10000 / 500 = 20, capped at 45
  assertEquals(result.strain !== null, true);
});

Deno.test('computeStrainScore — steps capped at 45 (22 500+)', () => {
  const result = computeStrainScore(baseInput({ steps: 30_000 }));
  assertEquals(result.stepsLoad, 45);
});

Deno.test('computeStrainScore — cardio zones calculate TRIMP correctly', () => {
  const result = computeStrainScore(
    baseInput({
      z: {
        z1_regen_min: 10,  // 10 * 0.5 = 5
        z2_tlenowa_min: 20, // 20 * 1.0 = 20
        z3_tempo_min: 15,  // 15 * 2.0 = 30
        z4_prog_min: 5,    // 5  * 4.0 = 20
        z5_max_min: 2,     // 2  * 6.0 = 12
      },
    }),
  );
  // total cardioRaw (before run bonuses) = 5+20+30+20+12 = 87
  assertEquals(result.cardioRaw, 87);
  assertEquals(result.strainConfidence, 'solid');
});

Deno.test('computeStrainScore — Strava run with high RPE adds bonus', () => {
  const result = computeStrainScore(
    baseInput({
      runs: [{ perceived_exertion: 9, has_pr: false }],
    }),
  );
  // no zones → cardioRaw = 0 + rpeBonus(30) = 30
  assertEquals(result.cardioRaw, 30);
  assertEquals(result.maxRpe, 9);
  assertEquals(result.isRunDay, true);
});

Deno.test('computeStrainScore — PR bonus adds 20 to cardioRaw', () => {
  const withPr = computeStrainScore(
    baseInput({ runs: [{ perceived_exertion: 5, has_pr: true }] }),
  );
  const withoutPr = computeStrainScore(
    baseInput({ runs: [{ perceived_exertion: 5, has_pr: false }] }),
  );
  assertEquals(withPr.hasPr, true);
  assertEquals(withPr.cardioRaw - withoutPr.cardioRaw, 20);
});

Deno.test('computeStrainScore — strength set: leg + cns + near-failure = 3+2+2+2 = 9 pts', () => {
  const result = computeStrainScore(
    baseInput({
      wsets: [{ exercise_name: 'martwy ciąg', rpe: 9.5, rir: 0, reps: 5 }],
    }),
  );
  // isLeg = true (martwy), isCns = true (martwy), nearFailure = rir=0 ≤ 1
  // pts = 3 + 2(leg) + 2(cns) + 2(nearFailure) = 9
  assertEquals(result.strengthPts, 9);
  assertEquals(result.legPts, 9);
  assertEquals(result.cnsPts, 9);
  assertEquals(result.strainConfidence, 'solid');
});

Deno.test('computeStrainScore — sauna minutes tracked as wellnessPts, not strengthPts', () => {
  const result = computeStrainScore(
    baseInput({
      wsets: [{ exercise_name: 'sauna', rpe: null, rir: null, reps: 20 }],
    }),
  );
  // wellnessPts = min(20 * 1.5, 25) = 25
  assertEquals(result.wellnessPts, 25);
  assertEquals(result.strengthPts, 0);
});

Deno.test('computeStrainScore — fueling penalty on high-load day with low kcal', () => {
  // Create a high-load day (cardioRaw > 80)
  const highLoad = computeStrainScore(
    baseInput({
      z: {
        z1_regen_min: 0,
        z2_tlenowa_min: 0,
        z3_tempo_min: 60, // 60 * 2 = 120 → hadLoad=true
        z4_prog_min: 0,
        z5_max_min: 0,
      },
      kcal: 1200, // < 1600 → penalty 30
      protein: 120, // 120/80 = 1.5 < 1.6 → penalty 10
      carbs: 200,
      fuelingProvisional: false,
    }),
  );
  assertEquals(highLoad.fuelingPenalty, 40); // 30 + 10
});

Deno.test('computeStrainScore — fuelingProvisional=true skips penalty even on high-load day', () => {
  const result = computeStrainScore(
    baseInput({
      z: { z1_regen_min: 0, z2_tlenowa_min: 0, z3_tempo_min: 60, z4_prog_min: 0, z5_max_min: 0 },
      kcal: 1200,
      protein: 80,
      carbs: 200,
      fuelingProvisional: true,
    }),
  );
  assertEquals(result.fuelingPenalty, 0);
});

Deno.test('computeStrainScore — fuelingScore is null when kcal is null', () => {
  const result = computeStrainScore(baseInput({ kcal: null }));
  assertEquals(result.fuelingScore, null);
});

Deno.test('computeStrainScore — strain value stays in [0, 21] range', () => {
  // Max possible load: heavy zones + heavy sets + steps
  const result = computeStrainScore(
    baseInput({
      z: { z1_regen_min: 0, z2_tlenowa_min: 0, z3_tempo_min: 0, z4_prog_min: 120, z5_max_min: 60 },
      runs: [{ perceived_exertion: 10, has_pr: true }],
      wsets: Array.from({ length: 20 }, (_, i) => ({
        exercise_name: `martwy ciąg ${i}`,
        rpe: 10,
        rir: 0,
        reps: 5,
      })),
      steps: 30_000,
    }),
  );
  assertEquals(result.strain !== null, true);
  assertEquals(result.strain! >= 0 && result.strain! <= 21, true);
});

Deno.test('computeStrainScore — mixed cardio + strength returns solid confidence', () => {
  const result = computeStrainScore(
    baseInput({
      z: { z1_regen_min: 20, z2_tlenowa_min: 30, z3_tempo_min: 0, z4_prog_min: 0, z5_max_min: 0 },
      wsets: [{ exercise_name: 'przysiad', rpe: 8, rir: 1, reps: 8 }],
    }),
  );
  assertEquals(result.strainConfidence, 'solid');
});
