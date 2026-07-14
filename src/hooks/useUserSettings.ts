import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { userSettingsKeys } from '../lib/queryKeys';
import { upsertUserSettings } from '../lib/userSettingsApi';
import type { Tables, TablesInsert } from '../lib/database.types';

export function useUserSettings(userId: string | undefined) {
  return useQuery<Tables<'user_settings'> | null>({
    queryKey: userId ? userSettingsKeys.detail(userId) : ['user-settings', null],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[useUserSettings] fetch settings failed:', error.message);
        throw new Error(error.message);
      }
      return data;
    },
    enabled: !!userId,
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: TablesInsert<'user_settings'>) => {
      await upsertUserSettings(settings);
    },
    onSuccess: (_, variables) => {
      if (variables.user_id) {
        void queryClient.invalidateQueries({
          queryKey: userSettingsKeys.detail(variables.user_id),
        });
      }
    },
  });
}
