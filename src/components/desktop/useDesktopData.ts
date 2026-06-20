import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export function useDesktopData(userId: string | undefined) {
  const [s, setS] = useState<{
    loading: boolean;
    oura: any[];
    nutrition: any[];
    sessions: any[];
    body: any[];
    strain: any | null;
    strava: any[];
    projects: any[];
    moves: any[];
    goals: any | null;
    sprintGoals: any[];
    stream: any[];
    patterns: any[];
    wins: any[];
    wiki: any[];
    knowledge: any[];
    lenieLogs: any[];
    habits: any[];
    habitLogs: any[];
  }>({
    loading: true,
    oura: [],
    nutrition: [],
    sessions: [],
    body: [],
    strain: null,
    strava: [],
    projects: [],
    moves: [],
    goals: null,
    sprintGoals: [],
    stream: [],
    patterns: [],
    wins: [],
    wiki: [],
    knowledge: [],
    lenieLogs: [],
    habits: [],
    habitLogs: [],
  });

  const load = useCallback(async () => {
    if (!userId) return;
    setS(p => ({ ...p, loading: true }));
    const { data, error } = await supabase.rpc('get_desktop_dashboard_data', { p_user_id: userId });
    if (error) {
      console.error('Error loading dashboard data:', error);
      setS(p => ({ ...p, loading: false }));
      return;
    }
    const d = data as any;
    setS({
      loading: false,
      oura: d?.oura || [],
      nutrition: d?.nutrition || [],
      sessions: d?.sessions || [],
      body: d?.body || [],
      strain: d?.strain || null,
      strava: d?.strava || [],
      projects: d?.projects || [],
      moves: d?.moves || [],
      goals: d?.goals || null,
      sprintGoals: d?.sprintGoals || [],
      stream: d?.stream || [],
      patterns: d?.patterns || [],
      wins: d?.wins || [],
      wiki: d?.wiki || [],
      knowledge: d?.knowledge || [],
      lenieLogs: d?.lenieLogs || [],
      habits: d?.habits || [],
      habitLogs: d?.habitLogs || [],
    });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...s, refresh: load };
}
