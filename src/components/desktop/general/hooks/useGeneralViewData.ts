/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { getTodayWarsaw, shiftDateStr } from '../../../../lib/date';

interface UseGeneralViewDataOptions {
  userId: string;
  ouraProp?: any[];
}

import { fetchOracleRecommendations, type OracleRecommendation } from '../../../../lib/oracleApi';

export function useGeneralViewData({ userId, ouraProp }: UseGeneralViewDataOptions) {
  const { data, isLoading: loading } = useQuery({
    queryKey: ['general-view-data', userId, !!ouraProp],
    queryFn: async () => {
      if (!userId) return null;
      const today = getTodayWarsaw();
      const since90 = shiftDateStr(today, -89);

      const [s, o, p, w, c, f, r] = await Promise.all([
        supabase
          .from('daily_strain')
          .select('date, recovery_score, strain_score, readiness_level, components')
          .eq('user_id', userId)
          .gte('date', since90)
          .order('date', { ascending: true }),
        ouraProp
          ? Promise.resolve({ data: ouraProp.filter((r) => r.date >= since90), error: null })
          : supabase
              .from('oura_daily_summary')
              .select(
                'date, hrv_avg, rhr_avg, total_sleep_hours, sleep_efficiency, readiness_score'
              )
              .eq('user_id', userId)
              .gte('date', since90)
              .order('date', { ascending: true }),
        supabase
          .from('vanguard_behavioral_patterns')
          .select(
            'pattern_type, title, evidence_text, occurrence_count, confidence, status, last_seen'
          )
          .eq('user_id', userId)
          .in('status', ['active', 'candidate'])
          .order('confidence', { ascending: false })
          .limit(20),
        supabase
          .from('vanguard_wiki_pages')
          .select('title, page_type, status, confidence, summary, tags, last_seen_at')
          .eq('user_id', userId)
          .in('status', ['active', 'needs_review'])
          .order('last_seen_at', { ascending: false })
          .limit(30),
        supabase
          .from('vanguard_curiosity_queue')
          .select(
            'hypothesis, provocation, confidence_score, category, evidence_count, created_at'
          )
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('confidence_score', { ascending: false })
          .limit(15),
        supabase
          .from('confirmed_friction_events')
          .select(
            'occurred_at, friction_type, actual_behavior, immediate_cost, deviation, confidence'
          )
          .eq('user_id', userId)
          .gte('occurred_at', since90 + 'T00:00:00Z')
          .order('occurred_at', { ascending: true }),
        fetchOracleRecommendations(userId)
      ]);

      if (s.error) console.warn('[GeneralView] daily_strain:', s.error.message);
      if (o.error) console.warn('[GeneralView] oura:', o.error.message);

      return {
        strain: s.data || [],
        oura: o.data || [],
        patterns: p.data || [],
        wiki: w.data || [],
        curiosity: c.data || [],
        friction: f.data || [],
        recommendations: r || []
      };
    },
    enabled: !!userId,
  });

  return {
    strain: data?.strain || [],
    oura: data?.oura || [],
    patterns: data?.patterns || [],
    wiki: data?.wiki || [],
    curiosity: data?.curiosity || [],
    friction: data?.friction || [],
    recommendations: data?.recommendations || [],
    loading,
  };
}
