import { supabase } from './supabase';

export interface AuditEvent {
  id: string;
  created_at: string;
  event_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string | null;
  related_table: string | null;
  related_id: string | null;
  metadata: Record<string, unknown>;
}

export interface DataCoverage {
  oura_30: number;
  oura_90: number;
  nutrition_30: number;
  nutrition_90: number;
  wins_30: number;
  wins_90: number;
  overall_30: number;
  overall_90: number;
}

export async function fetchSystemHealthData(userId: string): Promise<{
  events: AuditEvent[];
  coverage: DataCoverage | null;
}> {
  const [logsRes, covRes] = await Promise.all([
    supabase
      .from('audit_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.rpc('get_data_coverage', { p_user_id: userId })
  ]);

  if (logsRes.error) throw logsRes.error;
  
  let coverage: DataCoverage | null = null;
  if (!covRes.error) {
    coverage = covRes.data as unknown as DataCoverage;
  } else {
    console.error('[Coverage Error API]', covRes.error);
  }

  return {
    events: (logsRes.data as AuditEvent[]) || [],
    coverage,
  };
}
