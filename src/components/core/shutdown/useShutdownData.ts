import { useEffect, useState } from 'react';
import { getTodayWarsaw } from '../../../lib/date';
import { notify } from '../../../lib/notify';
import { updateDailyWin } from '../../../lib/goal/goalSpine.mutations';
import { useUserId } from '../../../store/useStore';
import type { Tables } from '../../../lib/database.types';
import {
  fetchDailyWin,
  fetchDailyReconciliationScore,
  fetchWorkoutSessionsRpe,
  upsertDailyReconciliationScore,
  insertVanguardStream,
} from '../../../lib/shutdownApi';

function taskField(win: Tables<'daily_wins'>, key: string): string | null {
  return (win as unknown as Record<string, string | null>)[key] ?? null;
}

export interface ShutdownTasksList {
  title: string | null;
  todoId: string | null;
  done: boolean;
  idx: number;
}

export function useShutdownData() {
  const userId = useUserId();
  const today = getTodayWarsaw();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [todayWin, setTodayWin] = useState<Tables<'daily_wins'> | null>(null);
  const [completedTasks, setCompletedTasks] = useState<boolean[]>([false, false, false, false, false]);
  const [reflectionText, setReflectionText] = useState('');
  const [actualAccomplishmentText, setActualAccomplishmentText] = useState('');
  const [moodScore, setMoodScore] = useState(3);
  const [rpeScore, setRpeScore] = useState(5);
  const [dayScore, setDayScore] = useState(7);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchDailyWin(userId, today);

        if (data) {
          setTodayWin(data);
          setCompletedTasks([!!data.done_1, !!data.done_2, !!data.done_3, !!data.done_4, !!data.done_5]);
          setReflectionText(data.day_note || '');
          setActualAccomplishmentText(data.journal_entry || '');
          setMoodScore(data.mood_score || 3);
          setRpeScore(data.daily_rpe || 5);
        }

        const [dayScoreVal, rpeVals] = await Promise.all([
          fetchDailyReconciliationScore(userId, today),
          fetchWorkoutSessionsRpe(userId, today),
        ]);

        if (dayScoreVal !== null) {
          setDayScore(dayScoreVal);
        }

        if (rpeVals.length > 0) {
          const maxRpe = Math.max(...rpeVals);
          if (maxRpe > 0) setRpeScore(maxRpe);
        }
      } catch (err: unknown) {
        console.error('[Action Error]', err);
        notify(err instanceof Error ? err.message : 'Wystąpił błąd', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, today]);

  const tasksList: ShutdownTasksList[] = todayWin
    ? [1, 2, 3, 4, 5]
        .map((i, idx) => ({
          title: taskField(todayWin, 'task_' + i),
          todoId: taskField(todayWin, 'task_' + i + '_todo_id'),
          done: completedTasks[idx],
          idx,
        }))
        .filter((t) => t.title?.trim())
    : [];

  const handleSaveShutdown = async () => {
    if (!userId || !todayWin) return;
    setSaving(true);
    try {
      const activeTasksCount = [1, 2, 3, 4, 5].filter((i) => taskField(todayWin, 'task_' + i)?.trim()).length;
      const doneCount = [1, 2, 3, 4, 5].filter((i, idx) => taskField(todayWin, 'task_' + i)?.trim() && completedTasks[idx]).length;
      const allDone = activeTasksCount > 0 && doneCount === activeTasksCount;
      const result = allDone ? 'Z' : 'P';

      const patch = {
        day_note: reflectionText.trim(),
        journal_entry: actualAccomplishmentText.trim(),
        mood_score: moodScore,
        daily_rpe: rpeScore,
        result,
      };

      await updateDailyWin(userId, todayWin.id, patch);

      await upsertDailyReconciliationScore(userId, today, dayScore);

      const reflectionPart = reflectionText.trim() ? ' | Refleksja: ' + reflectionText.trim() : '';
      const accomplishmentPart = actualAccomplishmentText.trim() ? ' | Co zrobiono: ' + actualAccomplishmentText.trim() : '';

      await insertVanguardStream({
        user_id: userId,
        source: 'daily_shutdown',
        content: 'Domknięcie dnia: Wynik ' + dayScore + '/10 (Samopoczucie: ' + moodScore + '/5, RPE: ' + rpeScore + '/10)' + reflectionPart + accomplishmentPart,
        classification: 'reflection:evening',
        metadata: { kind: 'day_close', date: today, day_score: dayScore, mood: moodScore, rpe: rpeScore },
      });
    } catch (err: unknown) {
      console.error('Error saving daily shutdown:', err);
      notify('Nie udało się zamknąć dnia', 'error');
    } finally {
      setSaving(false);
    }
  };

  return {
    userId, today, loading, saving, setSaving,
    todayWin, completedTasks, setCompletedTasks,
    reflectionText, setReflectionText,
    actualAccomplishmentText, setActualAccomplishmentText,
    moodScore, setMoodScore,
    rpeScore, setRpeScore,
    dayScore, setDayScore,
    tasksList, handleSaveShutdown,
  };
}
