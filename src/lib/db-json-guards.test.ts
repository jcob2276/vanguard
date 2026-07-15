/* eslint-disable max-lines-per-function */
import { describe, expect, it } from 'vitest';
import {
  parseWorldState,
  parseStrainComponents,
  parseGcHrZones,
  parseStravaSplits,
  parseStravaBestEfforts,
  parseDailyWinWithTasks,
  parseDataCoverage,
} from './db-json-guards';

describe('db-json-guards', () => {
  describe('parseWorldState', () => {
    it('returns null if input is not an object', () => {
      expect(parseWorldState(null)).toBeNull();
      expect(parseWorldState([])).toBeNull();
      expect(parseWorldState('not an object')).toBeNull();
    });

    it('parses valid world state', () => {
      const valid = {
        biometrics: {
          readiness_score: 85,
          oura_history: [{ date: '2026-07-15' }],
        },
        execution: {
          today_win: { id: 'win-1', title: 'Win' },
        },
        training: {
          has_workout_today: true,
        },
        nutrition: {
          weekly_calories: 2500,
          protein_today: 150,
        },
      };

      const result = parseWorldState(valid);
      expect(result).not.toBeNull();
      expect(result?.biometrics.readiness_score).toBe(85);
      expect(result?.biometrics.oura_history).toEqual([{ date: '2026-07-15' }]);
      expect(result?.execution.today_win).toEqual({ id: 'win-1', title: 'Win' });
      expect(result?.training.has_workout_today).toBe(true);
      expect(result?.nutrition.weekly_calories).toBe(2500);
      expect(result?.nutrition.protein_today).toBe(150);
    });

    it('gracefully falls back on missing or malformed fields', () => {
      const partial = {
        biometrics: {
          readiness_score: 'not a number', // invalid
        },
        training: {},
      };

      const result = parseWorldState(partial);
      expect(result).not.toBeNull();
      expect(result?.biometrics.readiness_score).toBeNull();
      expect(result?.biometrics.oura_history).toBeNull();
      expect(result?.execution.today_win).toBeNull();
      expect(result?.training.has_workout_today).toBe(false);
      expect(result?.nutrition.weekly_calories).toBeNull();
      expect(result?.nutrition.protein_today).toBeNull();
    });
  });

  describe('parseStrainComponents', () => {
    it('returns null if input is not an object', () => {
      expect(parseStrainComponents(null)).toBeNull();
      expect(parseStrainComponents('invalid')).toBeNull();
    });

    it('parses valid strain components', () => {
      const valid = {
        recovery_confidence: 'solid',
        strain_confidence: 'building',
        caffeine_active_mg: 150,
        sleep_debt_h: 1.5,
        hrv_z: 1.2,
        rhr_z: -0.5,
        sleep_score_today: 92,
        sleep_z: 0.8,
        fueling_score: 80,
        readiness_signals: [{ key: 'hrv', flag: 'green', detail: 'Good HRV' }],
        wellness_load: 5.4,
        explanation: 'Feeling recovered',
      };

      const result = parseStrainComponents(valid);
      expect(result).toEqual(valid);
    });

    it('handles incorrect values and missing fields gracefully', () => {
      const malformed = {
        recovery_confidence: 'invalid_status', // should be undefined
        caffeine_active_mg: 'not a number', // should be null
        explanation: 12345, // should be null
      };

      const result = parseStrainComponents(malformed);
      expect(result?.recovery_confidence).toBeUndefined();
      expect(result?.strain_confidence).toBeUndefined();
      expect(result?.caffeine_active_mg).toBeNull();
      expect(result?.explanation).toBeNull();
      expect(result?.sleep_debt_h).toBeNull();
    });
  });

  describe('parseGcHrZones', () => {
    it('returns null if input is not an array', () => {
      expect(parseGcHrZones(null)).toBeNull();
      expect(parseGcHrZones({})).toBeNull();
    });

    it('parses array of zones, filtering out non-objects and extracting secsInZone', () => {
      const input = [
        { secsInZone: 120 },
        'not-an-object',
        { secsInZone: 'invalid-type' },
        { other_field: 123 },
      ];

      const result = parseGcHrZones(input);
      expect(result).toEqual([
        { secsInZone: 120 },
        { secsInZone: null },
        { secsInZone: null },
      ]);
    });
  });

  describe('parseStravaSplits', () => {
    it('returns null if not an array', () => {
      expect(parseStravaSplits(null)).toBeNull();
    });

    it('parses valid splits and fills nulls for missing values', () => {
      const input = [
        {
          split: 1,
          moving_time: 300,
          distance: 1000,
          average_speed: 3.33,
          average_heartrate: 155,
          average_grade_adjusted_speed: 3.4,
          elevation_difference: 5,
          elapsed_time: 305,
        },
        {
          split: 2,
          moving_time: 'invalid', // should yield null
        },
      ];

      const result = parseStravaSplits(input);
      expect(result).toHaveLength(2);
      expect(result?.[0].split).toBe(1);
      expect(result?.[0].moving_time).toBe(300);
      expect(result?.[1].split).toBe(2);
      expect(result?.[1].moving_time).toBeNull();
      expect(result?.[1].distance).toBeNull();
    });
  });

  describe('parseStravaBestEfforts', () => {
    it('returns null if not an array', () => {
      expect(parseStravaBestEfforts(null)).toBeNull();
    });

    it('filters out efforts without string name or number moving_time', () => {
      const input = [
        { name: '1k', moving_time: 240, pr_rank: 1 },
        { name: '5k', moving_time: 'invalid' }, // missing valid moving_time
        { moving_time: 1200 }, // missing name
      ];

      const result = parseStravaBestEfforts(input);
      expect(result).toEqual([
        { name: '1k', moving_time: 240, pr_rank: 1 },
      ]);
    });
  });

  describe('parseDailyWinWithTasks', () => {
    it('returns null if not an object or missing core fields', () => {
      expect(parseDailyWinWithTasks(null)).toBeNull();
      expect(parseDailyWinWithTasks({ date: '2026-07-15' })).toBeNull(); // missing id
      expect(parseDailyWinWithTasks({ id: 'win-1' })).toBeNull(); // missing date
    });

    it('parses daily win with tasks', () => {
      const input = {
        id: 'win-1',
        date: '2026-07-15',
        title: 'Completed test suite',
        daily_win_tasks: [
          { id: 'task-1', title: 'Task 1' },
          'invalid-task', // should be filtered out or handled
        ],
      };

      const result = parseDailyWinWithTasks(input);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('win-1');
      expect(result?.daily_win_tasks).toBeDefined();
      expect(result?.daily_win_tasks?.length).toBe(1);
    });
  });

  describe('parseDataCoverage', () => {
    it('returns null if not an object', () => {
      expect(parseDataCoverage(null)).toBeNull();
    });

    it('returns defaults for missing fields', () => {
      const result = parseDataCoverage({});
      expect(result).toEqual({
        oura_30: 0,
        oura_90: 0,
        nutrition_30: 0,
        nutrition_90: 0,
        wins_30: 0,
        wins_90: 0,
        overall_30: 0,
        overall_90: 0,
      });
    });

    it('parses correct numeric coverage metrics', () => {
      const input = {
        oura_30: 100,
        oura_90: 95,
        nutrition_30: 80,
        nutrition_90: 75,
        wins_30: 90,
        wins_90: 85,
        overall_30: 90,
        overall_90: 85,
      };
      const result = parseDataCoverage(input);
      expect(result).toEqual(input);
    });
  });
});
