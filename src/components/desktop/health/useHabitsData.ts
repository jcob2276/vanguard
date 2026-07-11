import { useState } from 'react';
import {
  useHabits,
  useHabitLogs,
  useAddHabit,
  useDeleteHabit,
  useToggleHabit,
  type HabitRow,
  type HabitLogRow,
} from '../../../lib/health/habitsApi';
import { getTodayWarsaw, shiftDateStr } from '../../../lib/date';
import { notify, confirmDialog } from '../../../lib/notify';

export interface UseHabitsDataProps {
  userId: string;
}

export function useHabitsData({ userId }: UseHabitsDataProps) {
  const today = getTodayWarsaw();
  const sinceDate = shiftDateStr(today, -60);

  const { data: habits = [] } = useHabits(userId);
  const { data: habitLogs = [] } = useHabitLogs(userId, sinceDate);

  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [newHabit, setNewHabit] = useState<{ name: string; icon: string; is_positive: boolean }>({ name: '', icon: '✅', is_positive: true });

  const addHabitMutation = useAddHabit();
  const deleteHabitMutation = useDeleteHabit();
  const toggleHabitMutation = useToggleHabit();

  async function addHabit() {
    if (!newHabit.name.trim() || !userId) return;
    try {
      await addHabitMutation.mutateAsync({
        userId,
        name: newHabit.name,
        icon: newHabit.icon,
        is_positive: newHabit.is_positive,
      });
    } catch (err) {
      notify('Błąd dodawania nawyku.', 'error');
    } finally {
      setNewHabit({ name: '', icon: '✅', is_positive: true });
      setIsAddingHabit(false);
    }
  }

  async function deleteHabit(id: string) {
    if (!(await confirmDialog('Usunąć nawyk?'))) return;
    try {
      await deleteHabitMutation.mutateAsync({ userId, id });
    } catch (err) {
      notify('Błąd usuwania nawyku.', 'error');
    }
  }

  async function toggleHabit(habitId: string) {
    if (!userId) return;
    const habit = habits.find((h) => h.id === habitId);
    const existing = habitLogs.find((l) => l.habit_id === habitId && l.date === today);
    try {
      await toggleHabitMutation.mutateAsync({
        userId,
        habitId,
        habit,
        existingLog: existing,
        sinceDate,
      });
    } catch (err) {
      console.warn('[toggleHabit] failed', err);
    }
  }

  return {
    habits,
    habitLogs,
    isAddingHabit,
    setIsAddingHabit,
    newHabit,
    setNewHabit,
    addHabit,
    deleteHabit,
    toggleHabit,
  };
}
