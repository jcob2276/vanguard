/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchExerciseHistory } from './workoutApi';
import { supabase } from '../supabase';

// Create a query builder mock that supports chaining
const mockQuery: any = {
  select: vi.fn(),
  eq: vi.fn(),
  limit: vi.fn(),
};

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => mockQuery),
  },
}));

describe('workoutApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
  });

  describe('fetchExerciseHistory', () => {
    it('calls supabase with correct queries and parameters', async () => {
      mockQuery.limit.mockResolvedValue({
        data: [{ weight: 80, reps: 5, rir: 2, set_number: 1, session_id: 'sess-1' }],
        error: null,
      });

      const result = await fetchExerciseHistory(' Bench Press ', 'user-123');

      // Verify trimmed exercise name is used
      expect(supabase.from).toHaveBeenCalledWith('exercise_logs');
      expect(mockQuery.select).toHaveBeenCalledWith(
        'weight, reps, rir, set_number, session_id, workout_sessions!inner(date)'
      );
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockQuery.eq).toHaveBeenCalledWith('exercise_name', 'Bench Press');
      expect(mockQuery.limit).toHaveBeenCalledWith(500);

      expect(result).toEqual([{ weight: 80, reps: 5, rir: 2, set_number: 1, session_id: 'sess-1' }]);
    });

    it('throws error if supabase call fails', async () => {
      mockQuery.limit.mockResolvedValue({
        data: null,
        error: { message: 'Database failure' },
      });

      await expect(fetchExerciseHistory('Squat', 'user-123')).rejects.toThrow('Database failure');
    });
  });
});
