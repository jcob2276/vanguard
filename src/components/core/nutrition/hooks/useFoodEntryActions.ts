import { useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { getTodayWarsaw } from '../../../../lib/date';
import { rpcWithOfflineFallback } from '../../../../lib/offlineQueue';
import { notify } from '../../../../lib/notify';
import {
  scheduleFoodQualityAnalysis,
} from '../../../../lib/health/foodLogging';
import { foodTrustMeta } from '../../../../lib/health/foodTrust';
import {
  type FoodBase,
  type Favorite,
  type RecentEntry,
  parseGrams,
  derivePer100,
} from './foodEntryUtils';

interface UseFoodEntryActionsOptions {
  userId: string | undefined;
  mealType: string;
  saving: boolean;
  setSaving: (v: boolean) => void;
  quickAddingId: string | null;
  setQuickAddingId: (v: string | null) => void;
  setError: (msg: string | null) => void;
  search: {
    selected: FoodBase | null;
    setSelected: (v: FoodBase | null) => void;
    grams: string;
    setGrams: (v: string) => void;
    setQuery: (v: string) => void;
  };
  lists: {
    loadLists: () => Promise<void>;
  };
  flashSaved: () => void;
  onSaved?: () => void;
}

export function useFoodEntryActions({
  userId,
  mealType,
  saving,
  setSaving,
  quickAddingId,
  setQuickAddingId,
  setError,
  search,
  lists,
  flashSaved,
  onSaved,
}: UseFoodEntryActionsOptions) {

  const afterFoodLog = useCallback(() => {
    if (userId) scheduleFoodQualityAnalysis(userId, getTodayWarsaw());
  }, [userId]);

  const cacheToLibrary = useCallback(
    (food: FoodBase, defaultGrams: number) => {
      if (!userId) return;
      supabase
        .rpc('cache_food_to_library', {
          p_user_id: userId,
          p_name: food.name,
          p_brand: food.brand,
          p_barcode: food.barcode,
          p_calories: food.calories,
          p_protein: food.protein,
          p_carbs: food.carbs,
          p_fat: food.fat,
          p_fiber: food.fiber,
          p_sugar: food.sugar,
          p_default_grams: defaultGrams,
        } as never)
        .then(({ error }) => {
          if (error) {
            console.error('[FoodEntryModal] cacheToLibrary failed', error);
          }
        });
    },
    [userId]
  );

  const save = useCallback(async () => {
    if (!search.selected || !userId || saving) return;
    const gramsNum = parseInt(search.grams, 10) || 100;
    setSaving(true);
    setError(null);
    try {
      const { queued } = await rpcWithOfflineFallback(
        'add_food_entry',
        {
          p_user_id: userId,
          p_date: getTodayWarsaw(),
          p_grams: gramsNum,
          p_entry: {
            name: search.selected.name,
            brand: search.selected.brand,
            barcode: search.selected.barcode,
            calories: search.selected.calories,
            protein: search.selected.protein,
            carbs: search.selected.carbs,
            fat: search.selected.fat,
            fiber: search.selected.fiber,
            sugar: search.selected.sugar,
            meal_type: mealType,
            parse_meta: foodTrustMeta(search.selected),
          },
        },
        'Posiłek'
      );
      if (queued) {
        notify(
          'Brak sieci — posiłek zapisany lokalnie, zsynchronizuje się automatycznie',
          'info'
        );
      } else {
        cacheToLibrary(search.selected, gramsNum);
        afterFoodLog();
      }
      flashSaved();
      onSaved?.();
      search.setSelected(null);
      search.setQuery('');
      search.setGrams('100');
      await lists.loadLists();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? (err as Error).message : 'Zapis nie powiódł się'
      );
    } finally {
      setSaving(false);
    }
  }, [
    search,
    userId,
    mealType,
    saving,
    setSaving,
    setError,
    onSaved,
    lists,
    flashSaved,
    cacheToLibrary,
    afterFoodLog,
  ]);

  const quickAddSearchResult = useCallback(
    async (food: FoodBase) => {
      if (!userId || quickAddingId) return;
      const key = `srch:${food.name}`;
      setQuickAddingId(key);
      setError(null);
      try {
        const { queued } = await rpcWithOfflineFallback(
          'add_food_entry',
          {
            p_user_id: userId,
            p_date: getTodayWarsaw(),
            p_grams: food.defaultGrams ?? 100,
            p_entry: {
              name: food.name,
              brand: food.brand,
              barcode: food.barcode,
              calories: food.calories,
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
              fiber: food.fiber,
              sugar: food.sugar,
              meal_type: mealType,
              parse_meta: foodTrustMeta(food),
            },
          },
          'Posiłek'
        );
        if (queued) {
          notify(
            'Brak sieci — posiłek zapisany lokalnie, zsynchronizuje się automatycznie',
            'info'
          );
        } else {
          cacheToLibrary(food, food.defaultGrams ?? 100);
          afterFoodLog();
        }
        flashSaved();
        onSaved?.();
        await lists.loadLists();
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? (err as Error).message
            : 'Zapis nie powiódł się'
        );
      } finally {
        setQuickAddingId(null);
      }
    },
    [
      userId,
      quickAddingId,
      setQuickAddingId,
      mealType,
      onSaved,
      lists,
      flashSaved,
      cacheToLibrary,
      afterFoodLog,
      setError,
    ]
  );

  const quickAddFavorite = useCallback(
    async (fav: Favorite) => {
      if (!userId || quickAddingId) return;
      setQuickAddingId(fav.id);
      setError(null);
      try {
        const { queued } = await rpcWithOfflineFallback(
          'add_food_entry',
          {
            p_user_id: userId,
            p_date: getTodayWarsaw(),
            p_grams: fav.default_grams,
            p_entry: {
              name: fav.name,
              brand: fav.brand,
              barcode: fav.barcode,
              calories: fav.calories,
              protein: fav.protein,
              carbs: fav.carbs,
              fat: fav.fat,
              fiber: fav.fiber,
              sugar: fav.sugar,
              meal_type: mealType,
              parse_meta: foodTrustMeta({ ...fav, source: 'confirmed' }),
            },
          },
          'Posiłek'
        );
        if (queued) {
          notify(
            'Brak sieci — posiłek zapisany lokalnie, zsynchronizuje się automatycznie',
            'info'
          );
        } else {
          afterFoodLog();
        }
        flashSaved();
        onSaved?.();
        await lists.loadLists();
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? (err as Error).message
            : 'Zapis nie powiódł się'
        );
      } finally {
        setQuickAddingId(null);
      }
    },
    [
      userId,
      quickAddingId,
      setQuickAddingId,
      mealType,
      onSaved,
      lists,
      flashSaved,
      afterFoodLog,
      setError,
    ]
  );

  const quickRepeatEntry = useCallback(
    async (entry: RecentEntry) => {
      if (!userId || quickAddingId) return;
      setQuickAddingId(entry.id);
      setError(null);
      try {
        const grams = Math.max(1, parseGrams(entry.amount));
        const per100 = derivePer100(entry);
        const { queued } = await rpcWithOfflineFallback(
          'add_food_entry',
          {
            p_user_id: userId,
            p_date: getTodayWarsaw(),
            p_grams: grams,
            p_entry: {
              name: entry.name,
              brand: entry.brand,
              barcode: null,
              calories: Math.round(per100.calories),
              protein: Math.round(per100.protein * 10) / 10,
              carbs:
                per100.carbs != null ? Math.round(per100.carbs * 10) / 10 : null,
              fat: per100.fat != null ? Math.round(per100.fat * 10) / 10 : null,
              fiber: null,
              sugar: null,
              meal_type: mealType,
              parse_meta: foodTrustMeta({ ...entry, source: 'history' }),
            },
          },
          'Posiłek'
        );
        if (queued) {
          notify(
            'Brak sieci — posiłek zapisany lokalnie, zsynchronizuje się automatycznie',
            'info'
          );
        } else {
          afterFoodLog();
        }
        flashSaved();
        onSaved?.();
        await lists.loadLists();
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? (err as Error).message
            : 'Zapis nie powiódł się'
        );
      } finally {
        setQuickAddingId(null);
      }
    },
    [
      userId,
      quickAddingId,
      setQuickAddingId,
      mealType,
      onSaved,
      lists,
      flashSaved,
      afterFoodLog,
      setError,
    ]
  );

  return {
    save,
    quickAddSearchResult,
    quickAddFavorite,
    quickRepeatEntry,
  };
}
