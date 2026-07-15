import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTodayWarsaw } from '../../../lib/date';
import { notify } from '../../../lib/notify';
import { updateDailyWin } from '../../../lib/goal/goalSpine.mutations';
import { useUserId } from '../../../store/useStore';
import type { Tables } from '../../../lib/database.types';
import { shutdownKeys } from '../../../lib/queryKeys';
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

interface ShutdownTasksList {
  title: string | null;
  todoId: string | null;
  done: boolean;
  idx: number;
}

interface ShutdownFetchedData {
  todayWin: Tables<'daily_wins'> | null;
  dayScore: number;
  rpeScore: number;
}

function computeInitialFromCache(queryClient: ReturnType<typeof useQueryClient>, userId: string, today: string) {
  const cached = queryClient.getQueryData<ShutdownFetchedData>(shutdownKeys.data(userId, today));
  if (!cached) return null;
  const win = cached.todayWin;
  return {
    completedTasks: win ? [!!win.done_1, !!win.done_2, !!win.done_3, !!win.done_4, !!win.done_5] : [false, false, false, false, false],
    reflectionText: win?.day_note || '',
    actualAccomplishmentText: win?.journal_entry || '',
    moodScore: win?.mood_score || 3,
    rpeScore: cached.rpeScore,
    dayScore: cached.dayScore,
  };
}

export function useShutdownData() {
  const userId = useUserId();
  const today = getTodayWarsaw();
  const queryClient = useQueryClient();

  const initial = userId ? computeInitialFromCache(queryClient, userId, today) : null;

  const { data: fetched, isLoading: loading } = useQuery({
    queryKey: shutdownKeys.data(userId ?? '', today),
    queryFn: async (): Promise<ShutdownFetchedData> => {
      const [todayWin, dayScoreVal, rpeVals] = await Promise.all([
        fetchDailyWin(userId!, today),
        fetchDailyReconciliationScore(userId!, today),
        fetchWorkoutSessionsRpe(userId!, today),
      ]);

      const dayScore = dayScoreVal ?? 7;
      const maxRpe = rpeVals.length > 0 ? Math.max(...rpeVals) : 5;

      return { todayWin, dayScore, rpeScore: maxRpe };
    },
    enabled: !!userId,
  });

  const todayWin = fetched?.todayWin ?? null;

  const [completedTasks, setCompletedTasks] = useState<boolean[]>(initial?.completedTasks ?? [false, false, false, false, false]);
  const [reflectionText, setReflectionText] = useState(initial?.reflectionText ?? '');
  const [actualAccomplishmentText, setActualAccomplishmentText] = useState(initial?.actualAccomplishmentText ?? '');
  const [moodScore, setMoodScore] = useState(initial?.moodScore ?? 3);
  const [rpeScore, setRpeScore] = useState(initial?.rpeScore ?? 5);
  const [dayScore, setDayScore] = useState(initial?.dayScore ?? 7);
  const [saving, setSaving] = useState(false);

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

      await queryClient.invalidateQueries({ queryKey: shutdownKeys.data(userId, today) });
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
