import { useCallback, useEffect, useState } from 'react';
import { listProjects } from '../lib/projects';
import { supabase } from '../lib/supabase';
import { lifeGoalDisplayRowsFromProjects, type LifeGoalDisplayRow } from '../lib/lifeGoals';
import type { Tables } from '../lib/database.types';

type ProjectRow = Pick<
  Tables<'projects'>,
  'id' | 'name' | 'goal' | 'deadline' | 'color' | 'dream_id' | 'status'
>;
type DreamRow = Pick<Tables<'dreams'>, 'id' | 'life_goal'>;

export function useLifeGoals(userId: string) {
  const [displayRows, setDisplayRows] = useState<LifeGoalDisplayRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [projects, dreamsRes, kpisRes] = await Promise.all([
        listProjects(userId),
        supabase.from('dreams').select('id, life_goal').eq('user_id', userId),
        supabase.from('goal_kpis').select('id, project_id, name, current_value, target, unit').eq('user_id', userId),
      ]);
      if (dreamsRes.error) throw dreamsRes.error;
      if (kpisRes.error) throw kpisRes.error;
      setDisplayRows(lifeGoalDisplayRowsFromProjects(
        (projects ?? []) as ProjectRow[],
        (dreamsRes.data ?? []) as DreamRow[],
        kpisRes.data ?? [],
      ));
    } catch {
      setDisplayRows([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { displayRows, loading, refresh };
}
