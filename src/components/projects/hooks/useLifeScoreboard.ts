import { useLifeScoreboardQuery, type SphereScore } from '../../../lib/lifeScoreboardApi';

export type { SphereScore };

export function useLifeScoreboard(userId: string | undefined) {
  const { data, isLoading: loading } = useLifeScoreboardQuery(userId);
  return { data: data ?? null, loading };
}
