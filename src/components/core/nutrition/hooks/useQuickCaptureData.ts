import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '../../../../lib/notify';
import { getTodayWarsaw, getYesterdayWarsaw } from '../../../../lib/date';
import { supabase } from '../../../../lib/supabase';
import { fetchNutritionDayContext } from '../../../../lib/health/nutritionContext';
import {
  MEAL_TYPES,
  QUICK_CAPTURE_FAVORITES,
  defaultMealType,
  needsReview,
  parseFoodNL,
  quickAddFavorite,
  saveParsedFoodItems,
  type FoodFavoriteRow,
  type ParsedFoodItem,
  confidenceLabel,
} from '../../../../lib/health/foodLogging';

export interface YesterdayFoodEntry {
  id: string;
  name: string;
  brand: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  amount: string | null;
  date: string;
}

import { useSession } from '../../../../store/useStore';

export function useQuickCaptureData(onSaved?: () => void, refreshSignal = 0) {
  const session = useSession();
  const userId = session?.user.id;
  const draftKey = userId ? `vanguard_food_quick_draft_${userId}` : 'vanguard_food_quick_draft_anon';

  const [text, setText] = useState(() => {
    try { return localStorage.getItem(draftKey) || ''; } catch { return ''; }
  });
  const [mealType, setMealType] = useState(defaultMealType());
  const [logDate, setLogDate] = useState(() => getTodayWarsaw());
  const [totals, setTotals] = useState({
    calories: 0, protein: 0,
    targetKcal: null as number | null, targetProtein: null as number | null,
    avgFoodQuality: null as number | null, foodQualityAnalysis: null as string | null,
  });
  const [qualityPending, setQualityPending] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<ParsedFoodItem[] | null>(null);
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [yesterdayEntries, setYesterdayEntries] = useState<YesterdayFoodEntry[]>([]);

  const queryClient = useQueryClient();

  const contextQuery = useQuery({
    queryKey: ['nutrition-context', userId, logDate, refreshSignal],
    queryFn: () => fetchNutritionDayContext(userId!, logDate, session!.access_token),
    enabled: !!userId,
  });

  useEffect(() => {
    const ctx = contextQuery.data;
    if (ctx) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate sync of react-query data to local state
      setTotals({
        calories: ctx.calories, protein: ctx.protein,
        targetKcal: ctx.targetKcal, targetProtein: ctx.targetProtein,
        avgFoodQuality: ctx.avgFoodQuality, foodQualityAnalysis: ctx.foodQualityAnalysis,
      });
    }
  }, [contextQuery.data]);

  const bumpQualityRefresh = useCallback(() => {
    setQualityPending(true);
    window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ['nutrition-context', userId, logDate] }).then(() => setQualityPending(false));
    }, 8000);
  }, [queryClient, userId, logDate]);

  const yesterdayQuery = useQuery({
    queryKey: ['yesterday-entries', userId, mealType],
    queryFn: async () => {
      const todayStr = getTodayWarsaw();
      await supabase.auth.setSession({ access_token: session!.access_token, refresh_token: session!.refresh_token ?? '' });
      const { data: dateData } = await supabase
        .from('daily_food_entries').select('date').eq('user_id', userId!).eq('meal_type', mealType)
        .lt('date', todayStr).order('date', { ascending: false }).limit(1);
      if (!dateData || dateData.length === 0) return [];
      const targetDate = dateData[0].date;
      const { data } = await supabase
        .from('daily_food_entries')
        .select('id, name, brand, calories, protein, carbs, fat, fiber, sugar, amount, date')
        .eq('user_id', userId!).eq('date', targetDate).eq('meal_type', mealType).order('logged_at', { ascending: true });
      return data ?? [];
    },
    enabled: !!userId,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate sync of react-query data to local state
    if (yesterdayQuery.data) setYesterdayEntries(yesterdayQuery.data);
  }, [yesterdayQuery.data]);

  useEffect(() => {
    try {
      if (text.trim()) localStorage.setItem(draftKey, text);
      else localStorage.removeItem(draftKey);
    } catch { /* quota */ }
  }, [text, draftKey]);

  const activePreview = preview?.filter((_, i) => !removed.has(i)) ?? [];

  const handleParse = async () => {
    if (!text.trim() || parsing || !userId) return;
    setParsing(true);
    setPreview(null);
    setRemoved(new Set());
    try {
      const items = await parseFoodNL(text, userId, session!.access_token);
      if (!items.length) { notify('Nie rozpoznano produktów — spróbuj opisać inaczej', 'error'); return; }
      if (!needsReview(items)) {
        await saveParsedFoodItems(userId, items, { date: logDate, mealType });
        setText('');
        await contextQuery.refetch();
        bumpQualityRefresh();
        onSaved?.();
        notify(`Zapisano ${items.length} pozycji`, 'success');
        return;
      }
      setPreview(items);
    } catch (e: unknown) {
      notify((e as Error).message || 'Parsowanie nie powiodło się', 'error');
    } finally { setParsing(false); }
  };

  const handleSavePreview = async () => {
    if (!activePreview.length || saving || !userId) return;
    setSaving(true);
    try {
      await saveParsedFoodItems(userId, activePreview, { date: logDate, mealType });
      setText('');
      setPreview(null);
      setRemoved(new Set());
      await contextQuery.refetch();
      bumpQualityRefresh();
      onSaved?.();
      notify(`Zapisano ${activePreview.length} pozycji`, 'success');
    } catch (e: unknown) {
      notify((e as Error).message || 'Zapis nie powiódł się', 'error');
    } finally { setSaving(false); }
  };

  const handleFavorite = async (fav: Omit<FoodFavoriteRow, 'barcode'> & { barcode?: string | null }) => {
    if (saving || !userId) return;
    setSaving(true);
    try {
      await quickAddFavorite(userId, fav, logDate, mealType);
      await contextQuery.refetch();
      bumpQualityRefresh();
      onSaved?.();
      notify(fav.name, 'success');
    } catch (e: unknown) {
      notify((e as Error).message || 'Błąd', 'error');
    } finally { setSaving(false); }
  };

  const handleLogYesterdayEntry = async (entry: YesterdayFoodEntry) => {
    if (saving || !userId) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('repeat_food_entry', { p_user_id: userId, p_source_entry_id: entry.id, p_date: logDate });
      if (error) throw error;
      await contextQuery.refetch();
      bumpQualityRefresh();
      onSaved?.();
      notify(`Dodano: ${entry.name}`, 'success');
    } catch (e: unknown) {
      notify((e as Error).message || 'Błąd', 'error');
    } finally { setSaving(false); }
  };

  return {
    text, setText, mealType, setMealType, logDate, setLogDate,
    totals, qualityPending, parsing, saving,
    preview, setPreview, removed, setRemoved,
    yesterdayEntries, activePreview,
    MEAL_TYPES, QUICK_CAPTURE_FAVORITES, confidenceLabel,
    handleParse, handleSavePreview, handleFavorite, handleLogYesterdayEntry,
    getYesterdayLabel: (targetDate: string, mt: string) => {
      const yesterday = getYesterdayWarsaw();
      const mealName = mt === 'breakfast' ? 'śniadanie' : mt === 'lunch' ? 'obiad' : mt === 'dinner' ? 'kolację' : 'przekąskę';
      const parts = targetDate.split('-');
      return targetDate === yesterday ? `Wczoraj na ${mealName}` : parts.length === 3 ? `Ostatnio na ${mealName} (${parts[2]}.${parts[1]})` : `Ostatnio na ${mealName}`;
    },
  };
}
