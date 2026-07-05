import { useEffect, useRef } from 'react';
import { purgeStaleWorkoutDraft, shouldAutoResumeWorkout, markWorkoutSessionActive } from '../lib/workoutLogging';

export function useWorkoutResume(
  userId: string | undefined,
  setShowWorkoutLogger: React.Dispatch<React.SetStateAction<boolean>>
) {
  const resumedWorkoutDraft = useRef(false);

  useEffect(() => {
    if (resumedWorkoutDraft.current || !userId) return;
    resumedWorkoutDraft.current = true;
    purgeStaleWorkoutDraft(userId);
    if (shouldAutoResumeWorkout(userId)) {
      markWorkoutSessionActive(userId);
      setShowWorkoutLogger(true);
    }
  }, [userId, setShowWorkoutLogger]);

  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setShowWorkoutLogger((prev) => {
        if (prev) return prev;
        if (!shouldAutoResumeWorkout(userId)) return prev;
        markWorkoutSessionActive(userId);
        return true;
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, setShowWorkoutLogger]);
}
