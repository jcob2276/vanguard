import { getTodayWarsaw } from '../lib/date';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { startOfWeek } from 'date-fns';
import { VanguardCore, computeSignals } from '../lib/vanguardCore';
import type { Tables } from '../lib/database.types';

type DashboardData = {
  weeklyCalories: number;
  todayWin: Tables<'daily_wins'> | null;
  proteinToday: number;
  hasWorkoutToday: boolean;
  ouraToday: Tables<'oura_daily_summary'>[];
  readiness: number;
  stability: number;
  operationalState: string;
  loading: boolean;
  error?: string;
};

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>({
    weeklyCalories: 0,
    todayWin: null,
    proteinToday: 0,
    hasWorkoutToday: false,
    ouraToday: [],
    readiness: 0,
    stability: 0,
    operationalState: '',
    loading: true
  });

  const mountedRef = useRef(true);
  const { setSyncing } = useStore();

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    try {
      let totalCal = 0;
      let todayData = null;

      const today = getTodayWarsaw();
      const todayDate = new Date(today + 'T12:00:00');
      const mondayDate = startOfWeek(todayDate, { weekStartsOn: 1 });
      const monday = mondayDate.toLocaleDateString('en-CA');

      const [
        nutritionRes,
        tDataRes,
        protDataRes,
        workoutTodayRes,
        ouraDataRes,
        lastWorkoutRes
      ] = await Promise.all([
        supabase.from('daily_nutrition').select('calories').eq('user_id', session.user.id).gte('date', monday),
        supabase.from('daily_wins').select('*').eq('user_id', session.user.id).eq('date', today).maybeSingle(),
        supabase.from('daily_nutrition').select('protein').eq('user_id', session.user.id).eq('date', today).maybeSingle(),
        supabase.from('workout_sessions').select('id').eq('user_id', session.user.id).eq('date', today).limit(1).maybeSingle(),
        supabase.from('oura_daily_summary').select('*').eq('user_id', session.user.id).order('date', { ascending: false }).limit(30),
        supabase.from('workout_sessions').select('date').eq('user_id', session.user.id).order('date', { ascending: false }).limit(1).maybeSingle()
      ]);

      const nutrition = nutritionRes.data;
      const tData = tDataRes.data;
      const protData = protDataRes.data;
      const workoutToday = workoutTodayRes.data;
      const ouraData = ouraDataRes.data;
      const lastWorkout = lastWorkoutRes.data;

      totalCal = nutrition?.reduce((sum, n) => sum + (n.calories || 0), 0) || 0;
      todayData = tData;

      // --- NOWY SILNIK VANGUARD CORE ---
      const core = new VanguardCore(session.user.id, supabase);

      const signals = computeSignals(
        ouraData?.[0] || null,
        todayData,
        { protein: protData?.protein || 0 },
        lastWorkout?.date || null
      );

      const { score: realStability, state: realState } = await core.determineState(signals);

      if (!mountedRef.current) return;
      setData({
        weeklyCalories: totalCal,
        todayWin: todayData,
        proteinToday: protData?.protein || 0,
        hasWorkoutToday: !!workoutToday,
        ouraToday: ouraData || [],
        readiness: ouraData?.[0]?.readiness_score || 0,
        stability: realStability,
        operationalState: realState,
        loading: false
      });

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setData(prev => ({ ...prev, loading: false, error: err instanceof Error ? err.message : 'Unknown error' }));
    }
  };

  const syncYazio = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('[syncYazio] brak sesji — zaloguj się ponownie');
      alert('Brak sesji — odśwież stronę i zaloguj się ponownie.');
      return;
    }

    setSyncing(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-yazio`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ userId: session.user.id, days: 2 })
      });

      const res = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(res.error || `HTTP ${response.status}`);
      if (res.success) {
        const dates = (res.results || []).map((r: any) => `${r.date}: ${r.calories ?? 0} kcal`).join('\n');
        alert(`Sync OK\n${dates}`);
        await fetchData();
      } else {
        alert('Błąd synchronizacji: ' + (res.error || 'Nieznany błąd'));
      }
    } catch (err: any) {
      console.error('[syncYazio] błąd:', err);
      alert('Błąd synchronizacji: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const autoSyncCalendar = async (session: any) => {
    try {
      const { data: lastEvent } = await supabase
        .from('vanguard_calendar')
        .select('start_time')
        .eq('user_id', session.user.id)
        .lte('start_time', new Date().toISOString())
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const lastSync = lastEvent?.start_time ? new Date(lastEvent.start_time).getTime() : 0;

      if (lastSync < twoHoursAgo) {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-calendar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ userId: session.user.id })
        });
      }
    } catch (_e) {
      // silent — calendar sync nie może blokować ładowania dashboardu
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) autoSyncCalendar(session);
    });
    return () => { mountedRef.current = false; };
  }, []);

  return { ...data, syncYazio, refresh: fetchData };
}
