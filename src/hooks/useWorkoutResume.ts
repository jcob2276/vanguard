import { useEffect, useRef } from 'react';
import { purgeStaleWorkoutDraft, shouldAutoResumeWorkout, markWorkoutSessionActive } from '../lib/workoutLogging';

export function useWorkoutResume(
  userId: string | undefined,
  onResume: () => void
) {
  const resumedWorkoutDraft = useRef(false);

  useEffect(() => {
    if (resumedWorkoutDraft.current || !userId) return;
    resumedWorkoutDraft.current = true;
    purgeStaleWorkoutDraft(userId);
    if (shouldAutoResumeWorkout(userId)) {
      markWorkoutSessionActive(userId);
      onResume();
    }
  }, [userId, onResume]);

  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!shouldAutoResumeWorkout(userId)) return;
      markWorkoutSessionActive(userId);
      onResume();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, onResume]);
}
