import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type {
  BehaviorEffectResult,
  CorrelationResult,
  CorrelationStats,
} from '@vanguard/domain';

export interface CorrelationsData {
  correlations: CorrelationResult[];
  behaviors: BehaviorEffectResult[];
  coverage: Record<string, number>;
  stats: CorrelationStats | null;
}

const correlationsKeys = {
  all: ['correlations'] as const,
  forUser: (userId: string, includeWeak: boolean) => [...correlationsKeys.all, userId, includeWeak] as const,
};

async function fetchCorrelationsData(userId: string, includeWeak: boolean): Promise<CorrelationsData> {
  const payload = { user_id: userId, include_weak: includeWeak };
  const [corrRes, behRes] = await Promise.all([
    supabase.functions.invoke('vanguard-nightly?action=compute-correlations', { body: payload }),
    supabase.functions.invoke('compute-behavior-effects', { body: payload }),
  ]);
  if (corrRes.error) throw corrRes.error;
  if (behRes.error) throw behRes.error;
  if (corrRes.data?.error) throw new Error(corrRes.data.error);
  if (behRes.data?.error) throw new Error(behRes.data.error);

  return {
    correlations: corrRes.data?.results ?? [],
    coverage: corrRes.data?.coverage ?? {},
    stats: corrRes.data?.stats ?? null,
    behaviors: behRes.data?.results ?? [],
  };
}

export function useCorrelationsQuery(userId: string | undefined, includeWeak: boolean) {
  return useQuery({
    queryKey: correlationsKeys.forUser(userId || '', includeWeak),
    queryFn: () => fetchCorrelationsData(userId as string, includeWeak),
    enabled: !!userId,
  });
}
