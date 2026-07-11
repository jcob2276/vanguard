import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { getTodayWarsaw } from '../../../../lib/date';
import type { Favorite, RecentEntry } from './foodEntryUtils';

export function useFoodEntryLists(userId: string | undefined) {
  const [activeTab, setActiveTab] = useState<'favorites' | 'recent'>('favorites');
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [todayTotals, setTodayTotals] = useState<{ calories: number; protein: number } | null>(null);
  const [targets, setTargets] = useState<{ target_kcal: number | null; protein_floor_g: number | null } | null>(null);

  const loadLists = useCallback(async () => {
    if (!userId) return;
    setLoadingList(true);
    const [favRes, recentRes, todayRes, targetRes] = await Promise.all([
      supabase
        .from('food_favorites')
        .select('id, barcode, name, brand, calories, protein, carbs, fat, fiber, sugar, use_count, default_grams')
        .eq('user_id', userId)
        .order('use_count', { ascending: false })
        .order('last_used', { ascending: false })
        .limit(20),
      supabase
        .from('daily_food_entries')
        .select('id, name, brand, calories, protein, carbs, fat, amount, date')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('daily_nutrition')
        .select('calories, protein')
        .eq('user_id', userId)
        .eq('date', getTodayWarsaw())
        .maybeSingle(),
      supabase
        .from('nutrition_targets')
        .select('target_kcal, protein_floor_g')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (favRes.error) console.error('[FoodEntryModal] favorites fetch failed', favRes.error);
    if (recentRes.error) console.error('[FoodEntryModal] recent fetch failed', recentRes.error);
    setFavorites(favRes.data || []);
    setRecent(recentRes.data || []);
    setTodayTotals(todayRes.data ? { calories: todayRes.data.calories ?? 0, protein: todayRes.data.protein ?? 0 } : { calories: 0, protein: 0 });
    setTargets(targetRes.data ?? null);
    setLoadingList(false);
  }, [userId]);

  useEffect(() => {
    void (async () => { await loadLists(); })();
  }, [loadLists]);

  return {
    activeTab,
    setActiveTab,
    favorites,
    setFavorites,
    recent,
    setRecent,
    loadingList,
    todayTotals,
    targets,
    loadLists,
  };
}
