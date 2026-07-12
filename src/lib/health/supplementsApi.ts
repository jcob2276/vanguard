import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { isOfflineError, queueOfflineWrite } from '../offlineQueue';
import {
  fetchSupplements,
  fetchSupplementLogsSince,
  saveSupplement,
  type Supplement,
  type SupplementLog,
} from './supplementsClient';

const supplementsKeys = {
  all: ['supplements'] as const,
  list: (userId: string) => [...supplementsKeys.all, 'list', userId] as const,
  logs: (userId: string, sinceDate: string) => [...supplementsKeys.all, 'logs', userId, sinceDate] as const,
};

// ── QUERIES ──

export function useSupplements(userId: string) {
  return useQuery({
    queryKey: supplementsKeys.list(userId),
    queryFn: () => fetchSupplements(userId),
    enabled: !!userId,
  });
}

export function useSupplementLogs(userId: string, sinceDate: string) {
  return useQuery({
    queryKey: supplementsKeys.logs(userId, sinceDate),
    queryFn: () => fetchSupplementLogsSince(userId, sinceDate),
    enabled: !!userId && !!sinceDate,
  });
}

// ── MUTATIONS ──

export function useToggleSupplement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      supplementId,
      date,
      sinceDate: _sinceDate,
      existingLog,
    }: {
      userId: string;
      supplementId: string;
      date: string;
      sinceDate: string;
      existingLog?: SupplementLog | null;
    }) => {
      if (existingLog) {
        try {
          const { error } = await supabase
            .from('supplement_logs')
            .delete()
            .eq('user_id', userId)
            .eq('supplement_id', supplementId)
            .eq('date', date);
          if (error) throw error;
        } catch (err: unknown) {
          if (!isOfflineError(err)) throw err;
          await queueOfflineWrite(
            'table:delete:supplement_logs',
            { match: { user_id: userId, supplement_id: supplementId, date } },
            'Odznaczenie suplementu'
          );
        }
        return { deletedLogId: existingLog.id };
      } else {
        const payload = {
          user_id: userId,
          supplement_id: supplementId,
          quantity: 1,
          date,
        };
        let newLog: SupplementLog;
        try {
          const { data, error } = await supabase
            .from('supplement_logs')
            .insert(payload)
            .select()
            .single();
          if (error) throw error;
          newLog = data;
        } catch (err: unknown) {
          if (!isOfflineError(err)) throw err;
          newLog = { id: crypto.randomUUID(), logged_at: new Date().toISOString(), note: null, ...payload };
          await queueOfflineWrite('table:insert:supplement_logs', { payload: newLog }, 'Zaznaczenie suplementu');
        }
        return { newLog };
      }
    },
    onSuccess: (result, variables) => {
      queryClient.setQueryData<SupplementLog[]>(
        supplementsKeys.logs(variables.userId, variables.sinceDate),
        (old) => {
          const base = old || [];
          if (result.deletedLogId) {
            return base.filter((l) => l.id !== result.deletedLogId);
          }
          if (result.newLog) {
            return [result.newLog, ...base];
          }
          return base;
        }
      );
    },
  });
}

export function useSaveSupplement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      supplement,
    }: {
      userId: string;
      supplement: Omit<Supplement, 'id' | 'user_id' | 'created_at' | 'reminder_sent_date'> & { id?: string; reminder_sent_date?: string | null };
    }) => {
      try {
        const data = await saveSupplement(userId, supplement);
        return data;
      } catch (err: unknown) {
        if (!isOfflineError(err)) throw err;
        // Offline support for creating/updating supplements
        if (supplement.id) {
          await queueOfflineWrite(
            'table:update:supplements',
            { match: { id: supplement.id }, payload: supplement },
            'Edycja suplementu'
          );
          return { id: supplement.id, user_id: userId, created_at: new Date().toISOString(), ...supplement } as Supplement;
        } else {
          const id = crypto.randomUUID();
          const local = { id, user_id: userId, created_at: new Date().toISOString(), ...supplement } as Supplement;
          await queueOfflineWrite('table:insert:supplements', { payload: local }, 'Dodanie suplementu');
          return local;
        }
      }
    },
    onSuccess: (savedSup, variables) => {
      queryClient.setQueryData<Supplement[]>(supplementsKeys.list(variables.userId), (old) => {
        const base = old || [];
        const existingIdx = base.findIndex((s) => s.id === savedSup.id);
        if (existingIdx !== -1) {
          const next = [...base];
          next[existingIdx] = savedSup;
          return next;
        }
        return [...base, savedSup];
      });
    },
  });
}
