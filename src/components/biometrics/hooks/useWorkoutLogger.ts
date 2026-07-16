import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { getTodayWarsaw } from '../../../lib/date';
import { useHaptics } from '../../../hooks/useHaptics';
import { notify, confirmDialog } from '../../../lib/notify';
import {
  newExercise,
  useStopwatch,
  type WorkoutExercise,
  type WorkoutActivity,
} from '../workout/workoutUtils';
import {
  endWorkoutSession,
  hasResumableWorkoutDraftContent,
  isWorkoutSessionActive,
  loadWorkoutDraft,
  markWorkoutSessionActive,
  persistWorkoutDraft,
  saveWorkoutDraft,
  saveWorkoutSession,
  type WorkoutDraft,
  type WorkoutLoggerInitial,
} from '../../../lib/health/workoutLogging';
import { useUserId } from '../../../store/useStore';
import { useQueryClient } from '@tanstack/react-query';
import { calendarKeys, biometricsKeys } from '../../../lib/queryKeys';
import {
  advancePlyoProgram,
  clearPlyoCheckoff,
  initPlyoCheckoff,
  isPlyoSessionComplete,
  plyoPrescriptionToLogs,
  resolvePlyoSession,
  savePlyoCheckoff,
} from '../../../lib/health/plyoMarathonProgram';

interface UseWorkoutLoggerOptions {
  initial?: WorkoutLoggerInitial | null;
  onSaved?: () => void;
  onBack: () => void;
}

export function useWorkoutLogger({
  initial,
  onSaved,
  onBack,
}: UseWorkoutLoggerOptions) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const [workoutName, setWorkoutName] = useState('');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([newExercise()]);
  const [activities, setActivities] = useState<WorkoutActivity[]>([]);
  const [notes, setNotes] = useState('');
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(() => Date.now());

  // Custom manual time overrides
  const [manualTime, setManualTime] = useState(false);
  const todayStr = getTodayWarsaw();
  const [workoutDate, setWorkoutDate] = useState(todayStr);
  const [startTimeManual, setStartTimeManual] = useState('18:00');
  const [endTimeManual, setEndTimeManual] = useState('19:00');

  const elapsed = useStopwatch(timerStart);
  const haptics = useHaptics();
  const sessionEndedRef = useRef(false);

  const finalizeWorkoutSession = useCallback(() => {
    sessionEndedRef.current = true;
    if (!userId) return;
    endWorkoutSession(userId);
    clearPlyoCheckoff(userId);
  }, [userId]);

  const [plyoSkipped, setPlyoSkipped] = useState(false);
  const plyoSession = userId ? resolvePlyoSession(workoutDate, userId) : null;
  const [plyoDone, setPlyoDone] = useState<boolean[][]>(() =>
    plyoSession && userId ? initPlyoCheckoff(userId, plyoSession) : []
  );

  useEffect(() => {
    if (!userId || plyoSkipped) return;
    const session = resolvePlyoSession(workoutDate, userId);
    void (async () => {
      setPlyoDone(initPlyoCheckoff(userId, session));
    })();
  }, [userId, workoutDate, plyoSkipped]);

  useEffect(() => {
    if (!userId || initial === undefined) return;
    const draft = loadWorkoutDraft(userId);
    const seed =
      draft && hasResumableWorkoutDraftContent(draft)
        ? draft
        : initial ?? draft;
    if (!seed) return;
    void (async () => {
      setWorkoutName(seed.workoutName);
      setExercises(seed.exercises?.length ? seed.exercises : [newExercise()]);
      setActivities(seed.activities ?? []);
      setNotes(seed.notes ?? '');
      setSessionRpe(seed.sessionRpe ?? null);
      if (draft) {
        setWorkoutDate(draft.workoutDate);
        setTimerStart(draft.timerStart);
        setManualTime(draft.manualTime);
        setStartTimeManual(draft.startTimeManual);
        setEndTimeManual(draft.endTimeManual);
      }
    })();
  }, [userId, initial]);

  useEffect(() => {
    if (!userId || plyoSkipped || !plyoSession || sessionEndedRef.current) return;
    const t = window.setTimeout(() => {
      if (sessionEndedRef.current) return;
      savePlyoCheckoff(userId, plyoSession.sessionKey, plyoDone);
    }, 400);
    return () => window.clearTimeout(t);
  }, [userId, plyoSkipped, plyoSession, plyoDone]);

  const togglePlyoSet = (exIdx: number, setIdx: number) => {
    setPlyoDone((prev) =>
      prev.map((row, i) =>
        i === exIdx ? row.map((d, j) => (j === setIdx ? !d : d)) : row
      )
    );
  };

  useEffect(() => {
    if (!userId) return;
    markWorkoutSessionActive(userId);
  }, [userId]);

  const draftSnapshotRef = useRef<WorkoutDraft | null>(null);
  useEffect(() => {
    draftSnapshotRef.current = {
      workoutName,
      exercises,
      activities,
      notes,
      sessionRpe,
      workoutDate,
      timerStart,
      manualTime,
      startTimeManual,
      endTimeManual,
      savedAt: Date.now(),
    };
  });

  useEffect(() => {
    if (!userId) return;
    const flush = () => {
      if (sessionEndedRef.current) return;
      const draft = draftSnapshotRef.current;
      if (!draft) return;
      persistWorkoutDraft(userId, draft);
      if (!sessionEndedRef.current && plyoSession && plyoDone.length > 0) {
        savePlyoCheckoff(userId, plyoSession.sessionKey, plyoDone);
      }
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [userId, plyoSession, plyoDone]);

  useEffect(() => {
    if (!userId || sessionEndedRef.current) return;
    const t = window.setTimeout(() => {
      if (sessionEndedRef.current) return;
      const draft = draftSnapshotRef.current;
      if (!draft) return;
      if (
        isWorkoutSessionActive(userId) ||
        hasResumableWorkoutDraftContent(draft)
      ) {
        saveWorkoutDraft(userId, draft);
      } else {
        endWorkoutSession(userId);
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [
    userId,
    workoutName,
    exercises,
    activities,
    notes,
    sessionRpe,
    workoutDate,
    timerStart,
    manualTime,
    startTimeManual,
    endTimeManual,
  ]);

  const hasUnsavedData = Boolean(
    workoutName.trim() ||
      notes.trim() ||
      sessionRpe != null ||
      exercises.some((e) => e.name.trim()) ||
      activities.some((a) => a.name.trim()) ||
      plyoDone.some((row) => row.some(Boolean))
  );

  const handleBack = async () => {
    if (
      hasUnsavedData &&
      !(await confirmDialog(
        'Masz niezapisane dane treningu — wyjść bez zapisywania?'
      ))
    )
      return;
    finalizeWorkoutSession();
    onBack();
  };

  const addExercise = () => {
    haptics.light();
    setExercises((p) => [...p, newExercise()]);
  };
  const removeExercise = (id: number) => {
    if (exercises.length > 1) {
      haptics.light();
      setExercises((p) => p.filter((e) => e.id !== id));
    }
  };
  const updateExercise = (u: WorkoutExercise) =>
    setExercises((p) => p.map((e) => (e.id === u.id ? u : e)));

  async function save() {
    if (!userId || saving) return;
    const validEx = exercises.filter((e) => e.name.trim());
    const validAc = activities.filter((a) => a.name.trim());
    const plyoLogs =
      !plyoSkipped && plyoSession
        ? plyoPrescriptionToLogs(plyoSession.exercises, plyoDone)
        : [];
    if (!validEx.length && !validAc.length && !plyoLogs.length) {
      notify('Dodaj ćwiczenia siłowe albo odhacz serie plyo', 'error');
      return;
    }

    if (manualTime) {
      if (!workoutDate) {
        notify('Wybierz datę treningu', 'error');
        return;
      }
      if (!startTimeManual || !endTimeManual) {
        notify('Podaj godzinę rozpoczęcia i zakończenia treningu', 'error');
        return;
      }
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (!timeRegex.test(startTimeManual) || !timeRegex.test(endTimeManual)) {
        notify('Niepoprawny format godziny rozpoczęcia lub zakończenia', 'error');
        return;
      }
    }

    const plyoComplete = Boolean(
      !plyoSkipped && plyoSession && isPlyoSessionComplete(plyoDone)
    );

    setSaving(true);
    try {
      await supabase.auth.getSession();
      const { queued } = await saveWorkoutSession(userId, {
        workoutName,
        exercises,
        activities,
        notes,
        sessionRpe,
        workoutDate,
        timerStart,
        manualTime,
        startTimeManual,
        endTimeManual,
        plyoLogs,
      });
      if (plyoComplete) {
        advancePlyoProgram(userId);
      }
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
        void queryClient.invalidateQueries({ queryKey: biometricsKeys.all });
      }
      finalizeWorkoutSession();
      haptics.success();
      if (queued) {
        notify(
          'Brak sieci — trening zapisany lokalnie, zsynchronizuje się automatycznie',
          'info'
        );
      }
      onSaved?.();
      onBack();
    } catch (err: unknown) {
      haptics.error();
      const message =
        err instanceof Error ? (err as Error).message : String(err);
      if (message.includes('Not authorized') || message.includes('JWT')) {
        notify(
          'Sesja wygasła — odśwież stronę (draft treningu zostaje lokalnie)',
          'error'
        );
      } else {
        notify(message, 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  return {
    workoutName,
    setWorkoutName,
    exercises,
    setExercises,
    activities,
    setActivities,
    notes,
    setNotes,
    sessionRpe,
    setSessionRpe,
    saving,
    timerStart,
    setTimerStart,
    manualTime,
    setManualTime,
    workoutDate,
    setWorkoutDate,
    startTimeManual,
    setStartTimeManual,
    endTimeManual,
    setEndTimeManual,
    elapsed,
    plyoSkipped,
    setPlyoSkipped,
    plyoSession,
    plyoDone,
    togglePlyoSet,
    addExercise,
    removeExercise,
    updateExercise,
    save,
    handleBack,
  };
}
