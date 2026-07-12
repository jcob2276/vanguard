import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { getTodayWarsaw } from '../../../../lib/date';
import type { Favorite, RecentEntry } from './foodEntryUtils';

export const foodEntryListsKeys = {
  all: ['food-entry-lists'] as const,
  favorites: (userId: string) => [...foodEntryListsKeys.all, 'favorites', userId] as const,
  recent: (userId: string) => [...foodEntryListsKeys.all, 'recent', userId] as const,
  todayTotals: (userId: string) => [...foodEntryListsKeys.all, 'today', userId] as const,
  targets: (userId: string) => [...foodEntryListsKeys.all, 'targets', userId] as const,
};

async function fetchFavorites(userId: string): Promise<Favorite[]> {
  const { data, error } = await supabase
    .from('food_favorites')
    .select('id, barcode, name, brand, calories, protein, carbs, fat, fiber, sugar, use_count, default_grams')
    .eq('user_id', userId)
    .order('use_count', { ascending: false })
    .order('last_used', { ascending: false })
    .limit(20);
  if (error) console.error('[FoodEntryModal] favorites fetch failed', error);
  return data ?? [];
}

async function fetchRecent(userId: string): Promise<RecentEntry[]> {
  const { data, error } = await supabase
    .from('daily_food_entries')
    .select('id, name, brand, calories, protein, carbs, fat, amount, date')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(15);
  if (error) console.error('[FoodEntryModal] recent fetch failed', error);
  return data ?? [];
}

async function fetchTodayTotals(userId: string) {
  const { data } = await supabase
    .from('daily_nutrition')
    .select('calories, protein')
    .eq('user_id', userId)
    .eq('date', getTodayWarsaw())
    .maybeSingle();
  return data ? { calories: data.calories ?? 0, protein: data.protein ?? 0 } : { calories: 0, protein: 0 };
}

async function fetchTargets(userId: string) {
  const { data } = await supabase
    .from('nutrition_targets')
    .select('target_kcal, protein_floor_g')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export function useFoodEntryLists(userId: string | undefined) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'favorites' | 'recent'>('favorites');

  const favQuery = useQuery({
    queryKey: foodEntryListsKeys.favorites(userId ?? ''),
    queryFn: () => fetchFavorites(userId!),
    enabled: !!userId,
  });

  const recentQuery = useQuery({
    queryKey: foodEntryListsKeys.recent(userId ?? ''),
    queryFn: () => fetchRecent(userId!),
    enabled: !!userId,
  });

  const todayQuery = useQuery({
    queryKey: foodEntryListsKeys.todayTotals(userId ?? ''),
    queryFn: () => fetchTodayTotals(userId!),
    enabled: !!userId,
  });

  const targetsQuery = useQuery({
    queryKey: foodEntryListsKeys.targets(userId ?? ''),
    queryFn: () => fetchTargets(userId!),
    enabled: !!userId,
  });

  const loadLists = useCallback(async () => {
    if (!userId) return;
    await queryClient.invalidateQueries({ queryKey: foodEntryListsKeys.all });
  }, [queryClient, userId]);

  return {
    activeTab,
    setActiveTab,
    favorites: favQuery.data ?? [],
    setFavorites: () => { /* managed by react-query */ },
    recent: recentQuery.data ?? [],
    setRecent: () => { /* managed by react-query */ },
    loadingList: favQuery.isLoading || recentQuery.isLoading,
    todayTotals: todayQuery.data ?? null,
    targets: targetsQuery.data ?? null,
    loadLists,
  };
}
