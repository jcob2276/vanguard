import { describe, expect, it } from 'vitest';
import {
  avgClockLabel,
  bodyPulseHeadline,
  buildWeeklyBodyPulse,
  EMPTY_WEEKLY_BODY_PULSE,
  formatDurationHours,
  formatSleepDayLabel,
} from './weeklyBodyPulse';

describe('buildWeeklyBodyPulse', () => {
  it('splits gym, sauna, runs and sleep extremes over 7 days', () => {
    const data = buildWeeklyBodyPulse({
      since: '2026-07-13',
      sessions: [
        {
          date: '2026-07-14',
          workout_day: 'Nogi',
          exercise_logs: [{ exercise_name: 'Squat', muscle_tags: ['quads'], reps: 8 }],
        },
        {
          date: '2026-07-15',
          workout_day: 'Sauna',
          exercise_logs: [{ exercise_name: 'Sauna', muscle_tags: ['wellness'], reps: 20 }],
        },
      ],
      strava: [
        { start_date: '2026-07-16T07:00:00+02:00', sport_type: 'Run', distance: 5200 },
        { start_date: '2026-07-17T07:00:00+02:00', sport_type: 'Ride', distance: 20000 },
      ],
      oura: [
        {
          date: '2026-07-14',
          total_sleep_hours: 7.8,
          sleep_score: 88,
          bedtime_timestamp: '2026-07-13T22:30:00+02:00',
          bedtime_end_timestamp: '2026-07-14T06:30:00+02:00',
          deep_sleep_hours: 1.8,
          rem_sleep_hours: 1.5,
          sleep_efficiency: 90,
          hrv_avg: 55,
          latency_minutes: 12,
          readiness_score: 80,
        },
        {
          date: '2026-07-15',
          total_sleep_hours: 5.4,
          sleep_score: 62,
          bedtime_timestamp: '2026-07-15T00:30:00+02:00',
          bedtime_end_timestamp: '2026-07-15T06:00:00+02:00',
          deep_sleep_hours: 0.9,
          rem_sleep_hours: 0.8,
          sleep_efficiency: 78,
          hrv_avg: 41,
          latency_minutes: 20,
          readiness_score: 58,
        },
        {
          date: '2026-07-16',
          total_sleep_hours: 7.1,
          sleep_score: 74,
          bedtime_timestamp: '2026-07-15T23:00:00+02:00',
          bedtime_end_timestamp: '2026-07-16T06:15:00+02:00',
          deep_sleep_hours: 1.4,
          rem_sleep_hours: 1.2,
          sleep_efficiency: 85,
          hrv_avg: 48,
          latency_minutes: 15,
          readiness_score: 70,
        },
      ],
      strain: [
        { recovery_score: 60, daily_status: 'yellow' },
        { recovery_score: 70, daily_status: 'green' },
      ],
    });

    expect(data.gymCount).toBe(1);
    expect(data.saunaCount).toBe(1);
    expect(data.saunaMinutes).toBe(20);
    expect(data.runCount).toBe(1);
    expect(data.runKm).toBe(5.2);
    expect(data.sleepAvgHours).toBe(6.8);
    expect(data.sleepBest?.date).toBe('2026-07-14');
    expect(data.sleepWorst?.date).toBe('2026-07-15');
    expect(data.avgBedtime).toBe('23:20');
    expect(data.avgWake).toBe('06:15');
    expect(data.avgDeepHours).toBe(1.4);
    expect(data.avgRemHours).toBe(1.2);
    expect(data.avgEfficiency).toBe(84);
    expect(data.avgHrv).toBe(48);
    expect(data.avgLatencyMin).toBe(16);
    expect(data.avgReadiness).toBe(69);
    expect(data.averageRecovery).toBe(65);
    expect(data.warningDays).toBe(1);
  });
});

describe('avgClockLabel', () => {
  it('averages bedtimes across midnight', () => {
    expect(avgClockLabel(['2026-07-13T23:00:00+02:00', '2026-07-15T01:00:00+02:00'], true)).toBe('00:00');
  });
});

describe('bodyPulseHeadline', () => {
  it('flags low sleep before activity praise', () => {
    expect(bodyPulseHeadline({
      ...EMPTY_WEEKLY_BODY_PULSE,
      gymCount: 4,
      runCount: 2,
      runKm: 20,
      saunaCount: 1,
      saunaMinutes: 15,
      sleepAvgHours: 6.0,
      sleepAvgScore: 60,
      averageRecovery: 70,
    })).toBe('Sen ciągnie w dół ostatnie 7 dni');
  });
});

describe('formatDurationHours', () => {
  it('converts decimal hours to h + m', () => {
    expect(formatDurationHours(1.7)).toBe('1h 42m');
    expect(formatDurationHours(7.0)).toBe('7h');
    expect(formatDurationHours(0.5)).toBe('30m');
  });
});

describe('formatSleepDayLabel', () => {
  it('renders hours with day label', () => {
    expect(formatSleepDayLabel({ date: '2026-07-19', hours: 7.5, score: 80 }, '2026-07-19')).toBe('7h 30m · Dziś');
  });
});
