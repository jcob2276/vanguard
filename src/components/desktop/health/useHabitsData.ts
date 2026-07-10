import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { getTodayWarsaw } from '../../../lib/date';
import { mirrorHabitLogToStream } from '../../../lib/behavior/behaviorEvidence';
import { notify, confirmDialog } from '../../../lib/notify';
import { isOfflineError, queueOfflineWrite } from '../../../lib/offlineQueue';
import type { Database } from '../../../lib/database.types';

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

  useEffect(() => { void (async () => { setHabits(habitsData); })(); }, [habitsData]);
  useEffect(() => { void (async () => { setHabitLogs(habitLogsData); })(); }, [habitLogsData]);

  async function addHabit() {
    if (!newHabit.name.trim() || !userId) return;
    const payload = { user_id: userId, ...newHabit, name: newHabit.name.trim() };
    try {
      const { data, error } = await supabase.from('habits').insert(payload).select().single();
      if (error) throw error;
      setHabits(prev => [...prev, data]);
    } catch (err: unknown) {
      if (!isOfflineError(err)) { notify('Błąd dodawania nawyku.', 'error'); return; }
      const local = { id: crypto.randomUUID(), ...payload } as HabitRow;
      await queueOfflineWrite('table:insert:habits', { payload: local }, 'Dodanie nawyku');
      setHabits(prev => [...prev, local]);
    } finally {
      setNewHabit({ name: '', icon: '✅', is_positive: true });
      setIsAddingHabit(false);
    }
  }

  async function deleteHabit(id: string) {
    if (!(await confirmDialog('Usunąć nawyk?'))) return;
    try {
      const { error } = await supabase.from('habits').delete().eq('id', id);
      if (error) throw error;
    } catch (err: unknown) {
      if (!isOfflineError(err)) { notify('Błąd usuwania nawyku.', 'error'); return; }
      await queueOfflineWrite('table:delete:habits', { match: { id } }, 'Usunięcie nawyku');
    }
    setHabits(prev => prev.filter(h => h.id !== id));
  }

  async function toggleHabit(habitId: string) {
    if (!userId) return;
    const today = getTodayWarsaw();
    const habit = habits.find((h) => h.id === habitId);
    const existing = habitLogs.find((l) => l.habit_id === habitId && l.date === today);
    if (existing) {
      try {
        const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id);
        if (error) throw error;
      } catch (err: unknown) {
        if (!isOfflineError(err)) return;
        await queueOfflineWrite('table:delete:habit_logs', { match: { id: existing.id } }, 'Odznaczenie nawyku');
      }
      setHabitLogs((prev) => prev.filter((l) => l.id !== existing.id));
    } else {
      const payload = { user_id: userId, habit_id: habitId, date: today, completed: true };
      let logRow: HabitLogRow;
      try {
        const { data, error } = await supabase.from('habit_logs').insert(payload).select().single();
        if (error) throw error;
        logRow = data;
      } catch (err: unknown) {
        if (!isOfflineError(err)) return;
        logRow = { id: crypto.randomUUID(), context_note: null, final_stimulus: null, logged_at: null, ...payload } as HabitLogRow;
        await queueOfflineWrite('table:insert:habit_logs', { payload: logRow }, 'Zaznaczenie nawyku');
      }
      setHabitLogs((prev) => [...prev, logRow]);
      if (habit) {
        void mirrorHabitLogToStream(userId, habit, { completed: true, date: today }).catch((err) => {
          console.warn('[toggleHabit] stream mirror failed', err);
        });
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
