import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { format, startOfWeek } from 'date-fns';
import { VanguardCore } from '../lib/vanguardCore';

export function useDashboardData() {
  const [data, setData] = useState({
    weeklyCalories: 0,
    todayWin: null,
    proteinToday: 0,
    hasWorkoutToday: false,
    ouraToday: [],
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

      // --- NOWY SILNIK VANGUARD CORE ---
      const core = new VanguardCore(session.user.id, supabase);
      
      // Pobieramy StayFree (Dopamina/Focus) - StayFree is dropped, using mock empty array
      const stayfreeData = [];

      // Pobieramy datę ostatniego treningu
      const { data: lastWorkout } = await supabase
        .from('workout_sessions')
        .select('date')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const signals = await (async () => {
        const { computeSignals } = await import('../lib/vanguardCore');
        return computeSignals(
          stayfreeData || [],
          ouraData?.[0] || null,
          todayData,
          { protein: protData?.protein || 0 },
          lastWorkout?.date || null
        );
      })();

      const { score: realStability, state: realState } = await core.determineState(signals);

      if (!mountedRef.current) return;
      setData({
        weeklyCalories: totalCal,
        todayWin: todayData,
        proteinToday: protData?.protein || 0,
        hasWorkoutToday: !!workoutToday,
        ouraToday: ouraData,
        readiness: ouraData?.[0]?.readiness_score || 0,
        stability: realStability,
        operationalState: realState,
        loading: false
      });

      // 4. Trigger Temporal Link Analysis (Asynchronicznie)
      core.analyzeInterventions().catch(err => console.error('Intervention analysis error:', err));

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const syncYazio = async () => {
    console.log('[syncYazio] kliknięto');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('[syncYazio] brak sesji — zaloguj się ponownie');
      alert('Brak sesji — odśwież stronę i zaloguj się ponownie.');
      return;
    }
    console.log('[syncYazio] sesja ok, wywołuję funkcję...');

    setSyncing(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-yazio`;
      console.log('[syncYazio] POST →', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ userId: session.user.id, days: 2 })
      });

      const res = await response.json();
      console.log('[syncYazio] odpowiedź:', res);
      if (res.success) {
        const dates = (res.results || []).map(r => `${r.date}: ${r.calories ?? 0} kcal`).join('\n');
        alert(`Sync OK\n${dates}`);
        await fetchData();
      } else {
        alert('Błąd synchronizacji: ' + (res.error || 'Nieznany błąd'));
      }
    } catch (err) {
      console.error('[syncYazio] błąd:', err);
      alert('Błąd synchronizacji: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const autoSyncCalendar = async (session) => {
    try {
      const { data: lastEvent } = await supabase
        .from('vanguard_calendar')
        .select('start_time')
        .eq('user_id', session.user.id)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const lastSync = lastEvent ? new Date(lastEvent.start_time).getTime() : 0;

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
