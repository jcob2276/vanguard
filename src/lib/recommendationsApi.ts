import { supabase } from './supabase';

export interface OracleRecommendation {
  id: string;
  user_id: string;
  oracle_run_id: string | null;
  recommendation_text: string;
  related_metric: string;
  success_threshold: number | null;
  evaluation_window_days: number;
  status: 'pending' | 'evaluated';
  outcome: 'success' | 'fail' | 'inconclusive' | 'no_data' | null;
  baseline_value: number | null;
  actual_value: number | null;
  created_at: string;
  evaluated_at: string | null;
}

export async function fetchOracleRecommendations(userId: string): Promise<OracleRecommendation[]> {
  const { data, error } = await supabase
    .from('oracle_recommendations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[recommendationsApi] fetchOracleRecommendations failed:', error.message);
    return [];
  }
  return data as OracleRecommendation[];
}
