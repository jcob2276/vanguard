import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getTodayWarsaw } from '../../lib/date';
import { mirrorHabitLogToStream } from '../../lib/behaviorEvidence';
import { notify, confirmDialog } from '../../lib/notify';
import type { Database } from '../../lib/database.types';

export type HabitRow = Database['public']['Tables']['habits']['Row'];
export type HabitLogRow = Database['public']['Tables']['habit_logs']['Row'];

export interface UseHabitsDataProps {
  userId: string;
  habitsData: HabitRow[];
  habitLogsData: HabitLogRow[];
}

export function useHabitsData({ userId, habitsData, habitLogsData }: UseHabitsDataProps) {
  const [habits, setHabits] = useState<HabitRow[]>(habitsData);
  const [habitLogs, setHabitLogs] = useState<HabitLogRow[]>(habitLogsData);
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [newHabit, setNewHabit] = useState<{ name: string; icon: string; is_positive: boolean }>({ name: '', icon: '✅', is_positive: true });

  useEffect(() => { setHabits(habitsData); }, [habitsData]);
  useEffect(() => { setHabitLogs(habitLogsData); }, [habitLogsData]);

  async function addHabit() {
    if (!newHabit.name.trim() || !userId) return;
    const { data, error } = await supabase
      .from('habits')
      .insert({ user_id: userId, ...newHabit, name: newHabit.name.trim() })
      .select()
      .single();
    if (!error && data) {
      setHabits(prev => [...prev, data]);
      setNewHabit({ name: '', icon: '✅', is_positive: true });
      setIsAddingHabit(false);
    }
  }

  async function deleteHabit(id: string) {
    if (!(await confirmDialog('Usunąć nawyk?'))) return;
    const { error } = await supabase.from('habits').delete().eq('id', id);
    if (error) { notify('Błąd usuwania nawyku.', 'error'); return; }
    setHabits(prev => prev.filter(h => h.id !== id));
  }

  async function toggleHabit(habitId: string) {
    if (!userId) return;
    const today = getTodayWarsaw();
    const habit = habits.find((h) => h.id === habitId);
    const existing = habitLogs.find((l) => l.habit_id === habitId && l.date === today);
    if (existing) {
      const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id);
      if (!error) setHabitLogs((prev) => prev.filter((l) => l.id !== existing.id));
    } else {
      const { data, error } = await supabase
        .from('habit_logs')
        .insert({ user_id: userId, habit_id: habitId, date: today, completed: true })
        .select()
        .single();
      if (!error && data) {
        setHabitLogs((prev) => [...prev, data]);
        if (habit) {
          void mirrorHabitLogToStream(userId, habit, { completed: true, date: today }).catch((err) => {
            console.warn('[toggleHabit] stream mirror failed', err);
          });
        }
      }
    }
  }

  return {
    habits, setHabits,
    habitLogs, setHabitLogs,
    isAddingHabit, setIsAddingHabit,
    newHabit, setNewHabit,
    addHabit,
    deleteHabit,
    toggleHabit
  };
}
