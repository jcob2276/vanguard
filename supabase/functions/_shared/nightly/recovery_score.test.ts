import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { computeRecoveryScore } from './recovery_score.ts';

Deno.test('computeRecoveryScore — normal day with solid Oura and baseline data', () => {
  const input = {
    sleep: 8.0,
    sleepByDate: {
      '2026-07-10': 7.5,
      '2026-07-11': 8.0,
      '2026-07-12': 7.0,
      '2026-07-13': 7.5,
      '2026-07-14': 8.0,
    },
    date: '2026-07-15',
    respToday: 14.5,
    skinTempToday: 0.1,
    hrvAvg: 60,
    rhrAvg: 55,
    sleepScore: 85,
    readinessScore: 88,
    // nValid must be >= 14 for 'solid' confidence
    hrvEwma: { center: 58, spread: 4, nValid: 15 },
    rhrEwma: { center: 56, spread: 2, nValid: 15 },
    sleepScoreEwma: { center: 82, spread: 3, nValid: 15 },
    respEwma: { center: 14.3, spread: 0.2, nValid: 15 },
    hrvBase: 58,
    rhrBase: 56,
    subjectiveScore: null,
    ageYears: 30,
    sex: 'M' as const,
    steps: 10000,
    sleepTargetH: 7.5,
  };

  const result = computeRecoveryScore(input);

  // Sleep debt: 6 days total. Target: 7.5.
  // 2026-07-10: 7.5-7.5 = 0
  // 2026-07-11: 8.0-7.5 = 0.5
  // 2026-07-12: 7.0-7.5 = -0.5
  // 2026-07-13: 7.5-7.5 = 0
  // 2026-07-14: 8.0-7.5 = 0.5
  // 2026-07-15: 8.0-7.5 = 0.5
  // Total = 1.0h
  assertEquals(result.sleepDebtH, 1.0);
  assertEquals(result.recoveryConfidence, 'solid');
  assertEquals(typeof result.recovery, 'number');
  assertEquals(result.recovery! >= 0 && result.recovery! <= 100, true);
});

Deno.test('computeRecoveryScore — falls back to subjectiveScore when Oura data is missing', () => {
  const input = {
    sleep: null,
    sleepByDate: {},
    date: '2026-07-15',
    respToday: null,
    skinTempToday: null,
    hrvAvg: null,
    rhrAvg: null,
    sleepScore: null,
    readinessScore: null,
    hrvEwma: null,
    rhrEwma: null,
    sleepScoreEwma: null,
    respEwma: null,
    hrvBase: null,
    rhrBase: null,
    subjectiveScore: 8, // scale of 1-10 -> translates to 80
    ageYears: 30,
    sex: 'M' as const,
    steps: null,
  };

  const result = computeRecoveryScore(input);

  assertEquals(result.sleepDebtH, null);
  assertEquals(result.isSubjectiveFallback, true);
  assertEquals(result.recovery, 80);
  assertEquals(result.recoveryConfidence, 'building');
});

Deno.test('computeRecoveryScore — returns building when nValid is low (calibration)', () => {
  const input = {
    sleep: 7.0,
    sleepByDate: { '2026-07-15': 7.0 },
    date: '2026-07-15',
    respToday: 14.5,
    skinTempToday: 0.1,
    hrvAvg: 60,
    rhrAvg: 55,
    sleepScore: 85,
    readinessScore: 88,
    // nValid < 14 causes building/calibration mode
    hrvEwma: { center: 58, spread: 4, nValid: 2 },
    rhrEwma: { center: 56, spread: 2, nValid: 2 },
    sleepScoreEwma: { center: 82, spread: 3, nValid: 2 },
    respEwma: { center: 14.3, spread: 0.2, nValid: 2 },
    hrvBase: 58,
    rhrBase: 56,
    subjectiveScore: null,
    ageYears: 30,
    sex: 'M' as const,
    steps: null,
  };

  const result = computeRecoveryScore(input);
  assertEquals(result.recoveryConfidence, 'building');
});

Deno.test('computeRecoveryScore — returns calibrating when all data is missing', () => {
  const input = {
    sleep: null,
    sleepByDate: {},
    date: '2026-07-15',
    respToday: null,
    skinTempToday: null,
    hrvAvg: null,
    rhrAvg: null,
    sleepScore: null,
    readinessScore: null,
    hrvEwma: null,
    rhrEwma: null,
    sleepScoreEwma: null,
    respEwma: null,
    hrvBase: null,
    rhrBase: null,
    subjectiveScore: null,
    ageYears: 30,
    sex: 'M' as const,
    steps: null,
  };

  const result = computeRecoveryScore(input);
  assertEquals(result.recovery, null);
  assertEquals(result.recoveryConfidence, 'calibrating');
});
