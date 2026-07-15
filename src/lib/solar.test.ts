/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Configurable mock functions
let mockGetTimes: any = null;
let mockGetMoonIllumination: any = null;

vi.mock('suncalc', async (importOriginal) => {
  const original = await importOriginal<typeof import('suncalc')>();
  return {
    ...original,
    getTimes: (date: Date, lat: number, lon: number) => {
      if (mockGetTimes) return mockGetTimes(date, lat, lon);
      return original.getTimes(date, lat, lon);
    },
    getMoonIllumination: (date: Date) => {
      if (mockGetMoonIllumination) return mockGetMoonIllumination(date);
      return original.getMoonIllumination(date);
    },
  };
});

// Import after mocking
import { getSunTimes, getMoonPhase } from './solar';

describe('solar', () => {
  beforeEach(() => {
    mockGetTimes = null;
    mockGetMoonIllumination = null;
  });

  describe('getSunTimes', () => {
    it('calculates deterministic sun times for Warsaw default location', () => {
      const date = '2026-03-20'; // Spring Equinox
      const times = getSunTimes(date);

      expect(times.sunrise).toBeInstanceOf(Date);
      expect(times.sunset).toBeInstanceOf(Date);
      expect(times.solarNoon).toBeInstanceOf(Date);
      expect(typeof times.sunriseMin).toBe('number');
      expect(typeof times.sunsetMin).toBe('number');

      // Warsaw spring Equinox: sunrise around 5:30-6:30, sunset around 17:30-18:30
      expect(times.sunrise.getHours()).toBeGreaterThanOrEqual(4);
      expect(times.sunrise.getHours()).toBeLessThanOrEqual(8);
      expect(times.sunset.getHours()).toBeGreaterThanOrEqual(16);
      expect(times.sunset.getHours()).toBeLessThanOrEqual(20);
    });

    it('falls back to default times if suncalc returns null/undefined (polar case)', () => {
      mockGetTimes = () => ({
        sunrise: undefined,
        sunset: undefined,
        solarNoon: undefined,
      });

      const date = new Date(2026, 5, 21);
      const times = getSunTimes(date);

      expect(times.sunrise.getHours()).toBe(6);
      expect(times.sunrise.getMinutes()).toBe(0);
      expect(times.sunset.getHours()).toBe(18);
      expect(times.sunset.getMinutes()).toBe(0);
      expect(times.solarNoon.getHours()).toBe(12);
      expect(times.solarNoon.getMinutes()).toBe(0);
    });
  });

  describe('getMoonPhase', () => {
    it('calculates moon phase and details for a given date', () => {
      const info = getMoonPhase('2026-07-15');
      expect(info.phase).toBeGreaterThanOrEqual(0);
      expect(info.phase).toBeLessThanOrEqual(1);
      expect(typeof info.emoji).toBe('string');
      expect(typeof info.name).toBe('string');
      expect(typeof info.isMajor).toBe('boolean');
    });

    it('maps phase to name, emoji, and major phase flags correctly', () => {
      const testCases = [
        { phase: 0.0, expectedEmoji: '🌑', expectedName: 'Nów', expectedMajor: true },
        { phase: 0.1, expectedEmoji: '🌒', expectedName: 'Przybywający sierp', expectedMajor: false },
        { phase: 0.25, expectedEmoji: '🌓', expectedName: 'Pierwsza kwadra', expectedMajor: true },
        { phase: 0.4, expectedEmoji: '🌔', expectedName: 'Przybywający gibbous', expectedMajor: false },
        { phase: 0.5, expectedEmoji: '🌕', expectedName: 'Pełnia', expectedMajor: true },
        { phase: 0.6, expectedEmoji: '🌖', expectedName: 'Ubywający gibbous', expectedMajor: false },
        { phase: 0.75, expectedEmoji: '🌗', expectedName: 'Ostatnia kwadra', expectedMajor: true },
        { phase: 0.9, expectedEmoji: '🌘', expectedName: 'Ubywający sierp', expectedMajor: false },
      ];

      for (const tc of testCases) {
        mockGetMoonIllumination = () => ({
          fraction: 0,
          phase: tc.phase,
          angle: 0,
        });

        const info = getMoonPhase(new Date());
        expect(info.emoji).toBe(tc.expectedEmoji);
        expect(info.name).toBe(tc.expectedName);
        expect(info.isMajor).toBe(tc.expectedMajor);
      }
    });
  });
});
