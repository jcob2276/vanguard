import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useGoalSpineInvalidation } from '../../../hooks/useGoalSpineInvalidation';
import type { Session } from '@supabase/supabase-js';
import {
  useDashboardQuery,
  getLastCalendarEventStartTime,
  syncUserCalendar,
} from '../../../lib/dashboardApi';
import { dashboardKeys } from '../../../lib/queryKeys';

export function useDashboardData(sessionProp?: Session | null) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(sessionProp?.user.id ?? null);

  useEffect(() => {
    if (sessionProp) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate sync of session prop to local state
      setUserId(sessionProp.user.id);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserId(session.user.id);
    });
  }, [sessionProp]);

  const query = useDashboardQuery(userId);

  const refresh = useCallback(async () => {
    if (userId) {
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.main(userId) });
    }
  }, [queryClient, userId]);

  const autoSyncCalendar = async (session: Session) => {
    try {
      const lastSyncStr = await getLastCalendarEventStartTime(session.user.id);
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const lastSync = lastSyncStr ? new Date(lastSyncStr).getTime() : 0;

      if (lastSyncStr && lastSync < twoHoursAgo) {
        await syncUserCalendar(session.user.id);
      }
    } catch (_e: unknown) {
      // silent
    }
  };

  useEffect(() => {
    if (userId) {
      if (sessionProp) {
        void autoSyncCalendar(sessionProp);
      } else {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) autoSyncCalendar(session);
        });
      }
    }
  }, [userId, sessionProp]);

  useGoalSpineInvalidation(refresh);

  const fallbackData = {
    weeklyCalories: 0,
    todayWin: null,
    proteinToday: 0,
    hasWorkoutToday: false,
    ouraToday: [],
    readiness: 0,
  };

  const d = query.data || fallbackData;

  return {
    ...d,
    loading: query.isLoading,
    refresh,
  };
}
