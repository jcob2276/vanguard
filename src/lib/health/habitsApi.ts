import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getTodayWarsaw } from '../date';
import { isOfflineError, queueOfflineWrite } from '../offlineQueue';
import { mirrorHabitLogToStream } from '../behavior/behaviorEvidence';
import type { Database } from '../database.types';

export type HabitRow = Database['public']['Tables']['habits']['Row'];
export type HabitLogRow = Database['public']['Tables']['habit_logs']['Row'];

const habitsKeys = {
  all: ['habits'] as const,
  list: (userId: string) => [...habitsKeys.all, 'list', userId] as const,
  logs: (userId: string) => [...habitsKeys.all, 'logs', userId] as const,
  logsSince: (userId: string, sinceDate: string) => [...habitsKeys.all, 'logs', userId, sinceDate] as const,
};

// ── QUERIES ──

export function useHabits(userId: string) {
  return useQuery({
    queryKey: habitsKeys.list(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!userId,
  });
}

export function useHabitLogs(userId: string, sinceDate: string) {
  return useQuery({
    queryKey: habitsKeys.logsSince(userId, sinceDate),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', sinceDate);
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!userId && !!sinceDate,
  });
}

// ── MUTATIONS ──

export function useAddHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, name, icon, is_positive }: { userId: string; name: string; icon: string; is_positive: boolean }) => {
      const payload = { user_id: userId, name: name.trim(), icon, is_positive };
      try {
        const { data, error } = await supabase.from('habits').insert(payload).select().single();
        if (error) throw error;
        return data;
      } catch (err: unknown) {
        if (!isOfflineError(err)) throw err;
        const local = { id: crypto.randomUUID(), ...payload } as HabitRow;
        await queueOfflineWrite('table:insert:habits', { payload: local }, 'Dodanie nawyku');
        return local;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData<HabitRow[]>(habitsKeys.list(variables.userId), (old) => [...(old || []), data]);
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId: _userId, id }: { userId: string; id: string }) => {
      try {
        const { error } = await supabase.from('habits').delete().eq('id', id);
        if (error) throw error;
      } catch (err: unknown) {
        if (!isOfflineError(err)) throw err;
        await queueOfflineWrite('table:delete:habits', { match: { id } }, 'Usunięcie nawyku');
      }
      return id;
    },
    onSuccess: (deletedId, variables) => {
      queryClient.setQueryData<HabitRow[]>(habitsKeys.list(variables.userId), (old) => (old || []).filter(h => h.id !== deletedId));
    },
  });
}

export function useToggleHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      habitId,
      habit,
      existingLog,
      sinceDate: _sinceDate,
    }: {
      userId: string;
      habitId: string;
      habit?: HabitRow;
      existingLog?: HabitLogRow;
      sinceDate: string;
    }) => {
      const today = getTodayWarsaw();
      if (existingLog) {
        try {
          const { error } = await supabase.from('habit_logs').delete().eq('id', existingLog.id);
          if (error) throw error;
        } catch (err: unknown) {
          if (!isOfflineError(err)) throw err;
          await queueOfflineWrite('table:delete:habit_logs', { match: { id: existingLog.id } }, 'Odznaczenie nawyku');
        }
        return { deletedLogId: existingLog.id };
      } else {
        const payload = { user_id: userId, habit_id: habitId, date: today, completed: true };
        let logRow: HabitLogRow;
        try {
          const { data, error } = await supabase.from('habit_logs').insert(payload).select().single();
          if (error) throw error;
          logRow = data;
        } catch (err: unknown) {
          if (!isOfflineError(err)) throw err;
          logRow = { id: crypto.randomUUID(), context_note: null, final_stimulus: null, logged_at: null, ...payload } as HabitLogRow;
          await queueOfflineWrite('table:insert:habit_logs', { payload: logRow }, 'Zaznaczenie nawyku');
        }

        if (habit) {
          void mirrorHabitLogToStream(userId, habit, { completed: true, date: today }).catch(async (streamErr) => {
            console.warn('[useToggleHabit] stream mirror failed, checking for offline', streamErr);
            if (isOfflineError(streamErr)) {
              const kind = habit.is_positive === false ? 'unikać' : 'wzmacniać';
              const parts = [`[Nawyk/${habit.name}] (${kind}, ${today})`];
              const streamPayload = {
                user_id: userId,
                content: parts.join(' · '),
                source: 'habit_log',
                category: habit.is_positive === false ? 'behavior' : 'habit',
                classification: 'habit_log',
                metadata: {
                  habit_name: habit.name,
                  is_positive: habit.is_positive !== false,
                  date: today,
                },
              };
              await queueOfflineWrite('table:insert:vanguard_stream', { payload: streamPayload }, 'Zapis zdarzenia do strumienia');
            }
          });
        }
        return { newLog: logRow };
      }
    },
    onSuccess: (result, variables) => {
      queryClient.setQueryData<HabitLogRow[]>(habitsKeys.logsSince(variables.userId, variables.sinceDate), (old) => {
        const base = old || [];
        if (result.deletedLogId) {
          return base.filter((l) => l.id !== result.deletedLogId);
        }
        if (result.newLog) {
          return [...base, result.newLog];
        }
        return base;
      });
    },
  });
}
