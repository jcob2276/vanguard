import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  shouldAutoResumeWorkout,
  saveWorkoutSession,
  hasResumableWorkoutDraftContent,
} from './workoutLogging';
import { supabase } from '../supabase';
import { rirEffectiveness, stimulusForExercise } from '../../data/exercises';

// Mock localStorage for Node environment in Vitest
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] || null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  }),
  length: 0,
  key: vi.fn((idx: number) => Object.keys(store)[idx] || null),
};
globalThis.localStorage = localStorageMock as unknown as Storage;

vi.mock('../supabase', () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({ data: 'mock-id', error: null })),
  },
}));

vi.mock('./strainRefresh', () => ({
  scheduleStrainRecompute: vi.fn(),
}));

describe('workoutLogging', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('hasResumableWorkoutDraftContent', () => {
    it('returns false for completely empty draft', () => {
      const empty = {
        workoutName: '',
        exercises: [],
        activities: [],
        notes: '',
        sessionRpe: null,
        workoutDate: '2026-06-28',
        timerStart: null,
        manualTime: false,
        startTimeManual: '18:00',
        endTimeManual: '19:00',
        savedAt: Date.now(),
      };
      expect(hasResumableWorkoutDraftContent(empty)).toBe(false);
    });

    it('returns true if any exercise has a name', () => {
      const draft = {
        workoutName: '',
        exercises: [{ id: 1, name: 'Bench Press', tags: [], sets: [] }],
        activities: [],
        notes: '',
        sessionRpe: null,
        workoutDate: '2026-06-28',
        timerStart: null,
        manualTime: false,
        startTimeManual: '18:00',
        endTimeManual: '19:00',
        savedAt: Date.now(),
      };
      expect(hasResumableWorkoutDraftContent(draft)).toBe(true);
    });
  });

  describe('shouldAutoResumeWorkout', () => {
    const userId = 'test-user-1';

    it('returns false when no draft exists and session not active', () => {
      expect(shouldAutoResumeWorkout(userId)).toBe(false);
    });

    it('returns false and clears active session when active session is set but draft is empty', () => {
      localStorage.setItem(`vanguard_workout_session_active_${userId}`, String(Date.now()));
      const emptyDraft = {
        workoutName: '',
        exercises: [],
        activities: [],
        notes: '',
        sessionRpe: null,
        workoutDate: '2026-06-28',
        timerStart: null,
        manualTime: false,
        startTimeManual: '18:00',
        endTimeManual: '19:00',
        savedAt: Date.now(),
      };
      localStorage.setItem(`vanguard_workout_draft_${userId}`, JSON.stringify(emptyDraft));

      expect(shouldAutoResumeWorkout(userId)).toBe(false);
      expect(localStorage.getItem(`vanguard_workout_session_active_${userId}`)).toBeNull();
      expect(localStorage.getItem(`vanguard_workout_draft_${userId}`)).toBeNull();
    });

    it('returns true when active session is set and draft has content', () => {
      localStorage.setItem(`vanguard_workout_session_active_${userId}`, String(Date.now()));
      const draft = {
        workoutName: 'Heavy Push',
        exercises: [],
        activities: [],
        notes: '',
        sessionRpe: null,
        workoutDate: '2026-06-28',
        timerStart: null,
        manualTime: false,
        startTimeManual: '18:00',
        endTimeManual: '19:00',
        savedAt: Date.now(),
      };
      localStorage.setItem(`vanguard_workout_draft_${userId}`, JSON.stringify(draft));

      expect(shouldAutoResumeWorkout(userId)).toBe(true);
    });
  });

  describe('saveWorkoutSession manual time across midnight', () => {
    it('correctly shifts end date by 1 day if end time is before start time', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc');
      
      await saveWorkoutSession('test-user-1', {
        workoutName: 'Midnight Lift',
        exercises: [{ id: 1, name: 'Squats', tags: [], sets: [{ id: 1, kg: '100', reps: '5', rir: '', msp: false }] }],
        activities: [],
        notes: 'Late night session',
        sessionRpe: 8,
        workoutDate: '2026-06-28',
        timerStart: null,
        manualTime: true,
        startTimeManual: '23:00',
        endTimeManual: '01:00',
      });

      expect(rpcSpy).toHaveBeenCalled();
      const rpcArgs = rpcSpy.mock.calls[0][1] as Record<string, unknown>;
      
      const expectedStart = new Date('2026-06-28T23:00:00').toISOString();
      const expectedEnd = new Date('2026-06-29T01:00:00').toISOString();

      expect(rpcArgs['p_start_time']).toBe(expectedStart);
      expect(rpcArgs['p_end_time']).toBe(expectedEnd);
    });
  });

  describe('exercise stimulus weights (dips)', () => {
    it('maps Dips correctly with triceps-dominant weights', () => {
      const stimulus = stimulusForExercise('Dips');
      expect(stimulus.triceps?.direct).toBe(1);
      expect(stimulus.klatka?.indirect).toBe(0.45);
      expect(stimulus.barki?.indirect).toBe(0.15);
    });
  });

  describe('exercise stimulus weights (podciąganie nachwytem vs podchwytem)', () => {
    it('maps Podciąganie nachwytem correctly with lats-dominant weights', () => {
      const stimulus = stimulusForExercise('Podciąganie nachwytem');
      expect(stimulus.plecy?.direct).toBe(1);
      expect(stimulus.biceps?.indirect).toBe(0.45);
    });

    it('maps Podciąganie podchwytem correctly with biceps-dominant weights', () => {
      const stimulus = stimulusForExercise('Podciąganie podchwytem');
      expect(stimulus.biceps?.direct).toBe(1);
      expect(stimulus.plecy?.indirect).toBe(0.5);
    });
  });

  describe('rirEffectiveness', () => {
    it('gives full credit to sets near failure (low RIR)', () => {
      expect(rirEffectiveness(0)).toBe(1);
      expect(rirEffectiveness(1)).toBe(1);
    });

    it('decays credit as RIR grows', () => {
      expect(rirEffectiveness(2)).toBe(0.9);
      expect(rirEffectiveness(4)).toBe(0.7);
      expect(rirEffectiveness(6)).toBe(0.45);
      expect(rirEffectiveness(10)).toBe(0.25);
    });

    it('assumes full credit when RIR was not logged', () => {
      expect(rirEffectiveness(null)).toBe(1);
      expect(rirEffectiveness(undefined)).toBe(1);
    });
  });
});
