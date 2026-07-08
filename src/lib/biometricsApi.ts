import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from './supabase';
import { getTodayWarsaw } from './date';

export const biometricsKeys = {
  all: ['biometrics'] as const,
  dailyStrainOura: (userId: string) => [...biometricsKeys.all, 'dailyStrainOura', userId] as const,
};

// ── QUERIES ──

export function useDailyStrainOura(userId: string) {
  return useQuery({
    queryKey: biometricsKeys.dailyStrainOura(userId),
    queryFn: async () => {
      const [{ data: strainRows, error: e1 }, { data: ouraRows, error: e2 }] = await Promise.all([
        supabase
          .from('daily_strain')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('oura_daily_summary')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(2),
      ]);

      if (e1) throw new Error(e1.message);
      if (e2) throw new Error(e2.message);

      let ouraRow = null;
      if (ouraRows?.length) {
        const todayStr = getTodayWarsaw();
        ouraRow = ouraRows.find((s) => s.date === todayStr) || ouraRows[0];
      }

      return {
        row: strainRows,
        oura: ouraRow,
      };
    },
    staleTime: 1000 * 60 * 30, // 30 mins cache
    enabled: !!userId,
  });
}

// ── MUTATIONS ──

export function useTriggerOuraSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, accessToken }: { userId: string; accessToken: string }) => {
      const base = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${base}/functions/v1/sync?service=oura`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to sync Oura');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: biometricsKeys.dailyStrainOura(variables.userId) });
    },
  });
}
