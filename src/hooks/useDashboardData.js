import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { format, startOfWeek } from 'date-fns';
import { useStore } from '../store/useStore';

export function useDashboardData() {
  const { session, setSyncing } = useStore();
  const [data, setData] = useState({
    mspFeedbackMap: {},
    lastDayASession: null,
    weeklyCalories: 0,
    todayWin: null,
    loading: true
  });

  const fetchData = useCallback(async () => {
    if (!session) return;
    
    try {
      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('*, exercise_logs(*)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      const feedbackMap = {};
      let totalCal = 0;
      let lastA = null;
      let todayData = null;

      if (sessions && sessions.length > 0) {
        sessions.forEach(s => {
          if (feedbackMap[s.workout_day] === undefined) {
            feedbackMap[s.workout_day] = s.msp_passed;
          }
        });

        const lastAEntry = sessions.find(s => s.workout_day === 'A');
        if (lastAEntry) {
          lastA = {
            ...lastAEntry,
            benchLogs: lastAEntry.exercise_logs.filter(l => l.exercise_name.includes('Wyciskanie płaskie'))
          };
        }
      }

      const monday = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const { data: nutrition } = await supabase
        .from('daily_nutrition')
        .select('calories')
        .gte('date', monday);
      
      totalCal = nutrition?.reduce((sum, n) => sum + (n.calories || 0), 0) || 0;

      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: tData } = await supabase
        .from('daily_wins')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', today)
        .maybeSingle();
      
      todayData = tData;

      const { data: protData } = await supabase
        .from('daily_nutrition')
        .select('protein')
        .eq('date', today)
        .maybeSingle();

      const { data: workoutToday } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq('date', today)
        .maybeSingle();

      const { data: ouraData } = await supabase
        .from('oura_daily_summary')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .limit(30);

      const { data: settings } = await supabase
        .from('user_settings')
        .select('disciplined_streak')
        .eq('user_id', session.user.id)
        .maybeSingle();

      setData({
        mspFeedbackMap: feedbackMap,
        lastDayASession: lastA,
        weeklyCalories: totalCal,
        todayWin: todayData,
        proteinToday: protData?.protein || 0,
        hasWorkoutToday: !!workoutToday,
        ouraToday: ouraData,
        streak: settings?.disciplined_streak || 0,
        loading: false
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [session]);

  const syncYazio = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-yazio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ userId: session.user.id })
      });
      const res = await response.json();
      if (res.success) {
        await fetchData();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      console.error('Yazio Sync Error:', err);
      alert('Błąd synchronizacji: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...data, refresh: fetchData, syncYazio };
}
