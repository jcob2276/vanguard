import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

export type TimeBudget = Database['public']['Tables']['vanguard_time_budgets']['Row'];

export function useTimeBudgets(userId: string) {
  const [budgets, setBudgets] = useState<TimeBudget[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBudgets = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vanguard_time_budgets')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      setBudgets(data || []);
    } catch (err: unknown) {
      console.error('[Background Error]', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const saveBudget = useCallback(async (category: string, minHours: number | null, maxHours: number | null) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('vanguard_time_budgets')
        .upsert({
          user_id: userId,
          category,
          min_hours: minHours,
          max_hours: maxHours,
        }, {
          onConflict: 'user_id,category'
        })
        .select();

      if (error) throw error;
      
      setBudgets(prev => {
        const index = prev.findIndex(b => b.category === category);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data[0];
          return updated;
        } else {
          return [...prev, data[0]];
        }
      });
    } catch (err: unknown) {
      console.error('Error saving time budget:', err);
      throw err;
    }
  }, [userId]);

  useEffect(() => {
    void fetchBudgets();
  }, [fetchBudgets]);

  return { budgets, loading, saveBudget, refresh: fetchBudgets };
}
