import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { getTodayWarsaw, formatWarsawDate } from '../../../lib/date';
import { useHaptics } from '../../../hooks/useHaptics';
import {
  parseFoodNL,
  saveParsedFoodItems,
  saveFoodCorrection,
  scheduleFoodQualityAnalysis,
  needsReview,
  type ParsedFoodItem as NLFoodItem,
} from '../../../lib/foodLogging';
import { NETWORK_TIMEOUT_MS } from '../../../lib/constants';
import { usePersistentDraft } from '../../../hooks/usePersistentDraft';

export interface FoodBase {
  barcode: string | null;
  name: string;
  brand: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  defaultGrams?: number | null;
}

export interface Favorite extends FoodBase {
  id: string;
  use_count: number;
  default_grams: number;
}

export interface RecentEntry {
  id: string;
  name: string;
  brand: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  amount: string | null;
  date: string;
  meal_type?: string | null;
}

export type NLItem = NLFoodItem;

export function parseGrams(amount: string | null): number {
  if (!amount) return 100;
  const m = amount.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return 100;
  return Math.round(parseFloat(m[1].replace(',', '.')));
}

export function derivePer100(entry: RecentEntry) {
  const g = Math.max(1, parseGrams(entry.amount));
  return {
    calories: (entry.calories ?? 0) * 100 / g,
    protein: (entry.protein ?? 0) * 100 / g,
    carbs: entry.carbs != null ? entry.carbs * 100 / g : null,
    fat: entry.fat != null ? entry.fat * 100 / g : null,
  };
}

export function defaultMealType(): string {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' })).getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export function scale(value: number | null, grams: number): number | null {
  if (value == null) return null;
  return Math.round((value * grams) / 100 * 10) / 10;
}

export function dayLabel(dateStr: string, todayStr: string, yesterdayStr: string): string {
  if (dateStr === todayStr) return 'Dzisiaj';
  if (dateStr === yesterdayStr) return 'Wczoraj';
  const [, m, d] = dateStr.split('-');
  return `${d}.${m}`;
}

export interface UseFoodEntryDataProps {
  session: any;
  onClose: () => void;
  onSaved?: () => void;
  initialEditEntry?: RecentEntry;
  initialMealType?: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useFoodEntryData({ session, onClose, onSaved, initialEditEntry, initialMealType, searchInputRef }: UseFoodEntryDataProps) {
  const userId = session?.user?.id;
  const haptics = useHaptics();

  const [activeTab, setActiveTab] = useState<'favorites' | 'recent'>('favorites');
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodBase[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FoodBase | null>(null);
  const [grams, setGrams] = useState('100');
  const [mealType, setMealType] = useState(initialMealType ?? defaultMealType());
  const [saving, setSaving] = useState(false);
  const [quickAddingId, setQuickAddingId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanLookingUp, setScanLookingUp] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RecentEntry | null>(initialEditEntry ?? null);
  const [editGrams, setEditGrams] = useState(initialEditEntry ? String(parseGrams(initialEditEntry.amount)) : '100');
  const [editMealType, setEditMealType] = useState(initialEditEntry?.meal_type ?? defaultMealType());
  const [editPer100, setEditPer100] = useState<{ calories: number; protein: number; carbs: number | null; fat: number | null } | null>(
    initialEditEntry ? derivePer100(initialEditEntry) : null,
  );
  const [editSaving, setEditSaving] = useState(false);
  const [editDeleting, setEditDeleting] = useState(false);

  const [todayTotals, setTodayTotals] = useState<{ calories: number; protein: number } | null>(null);
  const [targets, setTargets] = useState<{ target_kcal: number | null; protein_floor_g: number | null } | null>(null);

  // Manual entry
  const manualDraftKey = (field: string) => userId ? `vanguard_food_manual_${field}_${userId}` : null;
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = usePersistentDraft(manualDraftKey('name'), '');
  const [manualKcal, setManualKcal] = usePersistentDraft(manualDraftKey('kcal'), '');
  const [manualProtein, setManualProtein] = usePersistentDraft(manualDraftKey('protein'), '');
  const [manualCarbs, setManualCarbs] = usePersistentDraft(manualDraftKey('carbs'), '');
  const [manualFat, setManualFat] = usePersistentDraft(manualDraftKey('fat'), '');

  // NL mode
  const [nlMode, setNlMode] = useState(false);
  const [nlText, setNlText] = usePersistentDraft(userId ? `vanguard_food_nl_draft_${userId}` : null, '');
  const [nlParsing, setNlParsing] = useState(false);
  const [nlItems, setNlItems] = useState<NLItem[] | null>(null);
  const [nlSaving, setNlSaving] = useState(false);
  const [nlRemovedIdx, setNlRemovedIdx] = useState<Set<number>>(new Set());

  const todayStr = getTodayWarsaw();
  const yesterdayStr = formatWarsawDate(new Date(Date.now() - 86400000));

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

  useEffect(() => { loadLists(); }, [loadLists]);

  useEffect(() => {
    if (query.trim().length < 2 || !userId) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const libraryPromise = supabase
          .from('food_library')
          .select('name, brand, barcode, calories, protein, carbs, fat, fiber, sugar, default_grams')
          .eq('user_id', userId)
          .ilike('name', `%${query.trim()}%`)
          .limit(10);

        const { data: { session: authSession } } = await supabase.auth.getSession();
        const offPromise = fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lookup-food?q=${encodeURIComponent(query.trim())}`,
          { headers: { Authorization: `Bearer ${authSession?.access_token}` }, signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS) }
        ).then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); });

        const [libraryRes, offJson] = await Promise.all([libraryPromise, offPromise]);
        if (libraryRes.error) console.error('[FoodEntryModal] food_library search failed', libraryRes.error);

        const libraryResults: FoodBase[] = (libraryRes.data || []).map((r) => ({
          name: r.name, brand: r.brand, barcode: r.barcode,
          calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat,
          fiber: r.fiber, sugar: r.sugar, defaultGrams: r.default_grams,
        }));
        const seen = new Set(libraryResults.map((r) => r.name.toLowerCase()));
        const offResults: FoodBase[] = (offJson.results || []).filter((r: FoodBase) => !seen.has(r.name.toLowerCase()));
        setSearchResults([...libraryResults, ...offResults]);
      } catch (err) {
        console.error('[FoodEntryModal] search failed', err);
        setError('Wyszukiwanie nie powiodło się');
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query, userId]);

  const lookupBarcode = useCallback(async (code: string) => {
    setScanLookingUp(true);
    setError(null);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lookup-food?barcode=${encodeURIComponent(code)}`,
        { headers: { Authorization: `Bearer ${authSession?.access_token}` }, signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const result = (json.results || [])[0];
      if (result) {
        setScannerOpen(false);
        setSelected(result);
        setGrams(String(result.defaultGrams ?? 100));
      } else {
        setScannerOpen(false);
        haptics.error();
        setError(`Nie znaleziono kodu — wpisz nazwę produktu`);
        setTimeout(() => { searchInputRef.current?.focus(); }, 50);
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      console.error('[FoodEntryModal] barcode lookup failed', err);
      haptics.error();
      setError('Wyszukiwanie po kodzie nie powiodło się');
    } finally {
      setScanLookingUp(false);
    }
  }, [haptics, searchInputRef]);

  const preview = useMemo(() => {
    const gramsNum = parseInt(grams, 10) || 0;
    if (!selected) return null;
    return {
      calories: scale(selected.calories, gramsNum),
      protein: scale(selected.protein, gramsNum),
      carbs: scale(selected.carbs, gramsNum),
      fat: scale(selected.fat, gramsNum),
    };
  }, [selected, grams]);

  const flashSaved = useCallback(() => {
    haptics.success();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }, [haptics]);

  const afterFoodLog = useCallback(() => {
    if (userId) scheduleFoodQualityAnalysis(userId, getTodayWarsaw());
  }, [userId]);

  const cacheToLibrary = useCallback((food: FoodBase, defaultGrams: number) => {
    if (!userId) return;
    supabase
      .rpc('cache_food_to_library', {
        p_user_id: userId, p_name: food.name, p_brand: food.brand, p_barcode: food.barcode,
        p_calories: food.calories, p_protein: food.protein, p_carbs: food.carbs,
        p_fat: food.fat, p_fiber: food.fiber, p_sugar: food.sugar, p_default_grams: defaultGrams,
      } as any)
      .then(({ error }) => { if (error) console.error('[FoodEntryModal] cacheToLibrary failed', error); });
  }, [userId]);

  const save = useCallback(async () => {
    if (!selected || !userId || saving) return;
    const gramsNum = parseInt(grams, 10) || 100;
    setSaving(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('add_food_entry', {
        p_user_id: userId, p_date: getTodayWarsaw(), p_grams: gramsNum,
        p_entry: {
          name: selected.name, brand: selected.brand, barcode: selected.barcode,
          calories: selected.calories, protein: selected.protein, carbs: selected.carbs,
          fat: selected.fat, fiber: selected.fiber, sugar: selected.sugar, meal_type: mealType,
        },
      });
      if (rpcError) throw rpcError;
      cacheToLibrary(selected, gramsNum);
      afterFoodLog();
      flashSaved();
      onSaved?.();
      setSelected(null); setQuery(''); setGrams('100');
      loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zapis nie powiódł się');
    } finally {
      setSaving(false);
    }
  }, [selected, userId, grams, mealType, saving, onSaved, loadLists, flashSaved, cacheToLibrary, afterFoodLog]);

  const quickAddSearchResult = useCallback(async (food: FoodBase) => {
    if (!userId || quickAddingId) return;
    const key = `srch:${food.name}`;
    setQuickAddingId(key);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('add_food_entry', {
        p_user_id: userId, p_date: getTodayWarsaw(), p_grams: food.defaultGrams ?? 100,
        p_entry: {
          name: food.name, brand: food.brand, barcode: food.barcode,
          calories: food.calories, protein: food.protein, carbs: food.carbs,
          fat: food.fat, fiber: food.fiber, sugar: food.sugar, meal_type: mealType,
        },
      });
      if (rpcError) throw rpcError;
      cacheToLibrary(food, food.defaultGrams ?? 100);
      afterFoodLog();
      flashSaved();
      onSaved?.();
      loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zapis nie powiódł się');
    } finally {
      setQuickAddingId(null);
    }
  }, [userId, quickAddingId, mealType, onSaved, loadLists, flashSaved, cacheToLibrary, afterFoodLog]);

  const quickAddFavorite = useCallback(async (fav: Favorite) => {
    if (!userId || quickAddingId) return;
    setQuickAddingId(fav.id);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('add_food_entry', {
        p_user_id: userId, p_date: getTodayWarsaw(), p_grams: fav.default_grams,
        p_entry: {
          name: fav.name, brand: fav.brand, barcode: fav.barcode,
          calories: fav.calories, protein: fav.protein, carbs: fav.carbs,
          fat: fav.fat, fiber: fav.fiber, sugar: fav.sugar, meal_type: mealType,
        },
      });
      if (rpcError) throw rpcError;
      afterFoodLog();
      flashSaved();
      onSaved?.();
      loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zapis nie powiódł się');
    } finally {
      setQuickAddingId(null);
    }
  }, [userId, quickAddingId, mealType, onSaved, loadLists, flashSaved, afterFoodLog]);

  const quickRepeatEntry = useCallback(async (entry: RecentEntry) => {
    if (!userId || quickAddingId) return;
    setQuickAddingId(entry.id);
    setError(null);
    try {
      const grams = Math.max(1, parseGrams(entry.amount));
      const per100 = derivePer100(entry);
      const { error: rpcError } = await supabase.rpc('add_food_entry', {
        p_user_id: userId, p_date: getTodayWarsaw(), p_grams: grams,
        p_entry: {
          name: entry.name, brand: entry.brand, barcode: null,
          calories: Math.round(per100.calories),
          protein: Math.round(per100.protein * 10) / 10,
          carbs: per100.carbs != null ? Math.round(per100.carbs * 10) / 10 : null,
          fat: per100.fat != null ? Math.round(per100.fat * 10) / 10 : null,
          fiber: null, sugar: null, meal_type: mealType,
        },
      });
      if (rpcError) throw rpcError;
      afterFoodLog();
      flashSaved();
      onSaved?.();
      loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zapis nie powiódł się');
    } finally {
      setQuickAddingId(null);
    }
  }, [userId, quickAddingId, mealType, onSaved, loadLists, flashSaved, afterFoodLog]);

  const saveManual = useCallback(async () => {
    if (!userId || saving || !manualName.trim() || !manualKcal.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('add_food_entry', {
        p_user_id: userId, p_date: getTodayWarsaw(), p_grams: 100,
        p_entry: {
          name: manualName.trim(), brand: null, barcode: null,
          calories: Number(manualKcal) || 0,
          protein: manualProtein.trim() ? Number(manualProtein) : null,
          carbs: manualCarbs.trim() ? Number(manualCarbs) : null,
          fat: manualFat.trim() ? Number(manualFat) : null,
          fiber: null, sugar: null, meal_type: mealType,
        },
      });
      if (rpcError) throw rpcError;
      cacheToLibrary({
        name: manualName.trim(), brand: null, barcode: null,
        calories: Number(manualKcal) || 0,
        protein: manualProtein.trim() ? Number(manualProtein) : null,
        carbs: manualCarbs.trim() ? Number(manualCarbs) : null,
        fat: manualFat.trim() ? Number(manualFat) : null,
        fiber: null, sugar: null,
      }, 100);
      afterFoodLog();
      flashSaved();
      onSaved?.();
      setManualName(''); setManualKcal(''); setManualProtein(''); setManualCarbs(''); setManualFat('');
      setManualMode(false);
      loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zapis nie powiódł się');
    } finally {
      setSaving(false);
    }
  }, [userId, saving, manualName, manualKcal, manualProtein, manualCarbs, manualFat, mealType, onSaved, loadLists, flashSaved, cacheToLibrary, afterFoodLog, setManualName, setManualKcal, setManualProtein, setManualCarbs, setManualFat]);

  const parseNL = useCallback(async () => {
    if (!nlText.trim() || nlParsing || !userId) return;
    setNlParsing(true);
    setError(null);
    setNlItems(null);
    setNlRemovedIdx(new Set());
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const items = await parseFoodNL(nlText.trim(), userId, authSession?.access_token ?? session.access_token);
      if (!items.length) {
        setError('Nie rozpoznano produktów');
        return;
      }
      if (!needsReview(items)) {
        await saveParsedFoodItems(userId, items, { date: getTodayWarsaw(), mealType });
        flashSaved();
        onSaved?.();
        setNlText(''); setNlItems(null); setNlRemovedIdx(new Set()); setNlMode(false);
        loadLists();
        return;
      }
      setNlItems(items);
    } catch (err) {
      console.error('[FoodEntryModal] NL parse failed', err);
      setError('Parsowanie nie powiodło się — spróbuj ponownie');
    } finally {
      setNlParsing(false);
    }
  }, [nlText, nlParsing, userId, session.access_token, mealType, onSaved, loadLists, flashSaved, setNlText]);

  const saveNLItems = useCallback(async () => {
    if (!userId || !nlItems || nlSaving) return;
    const toSave = nlItems.filter((_, i) => !nlRemovedIdx.has(i));
    if (!toSave.length) return;
    setNlSaving(true);
    setError(null);
    try {
      await saveParsedFoodItems(userId, toSave, { date: getTodayWarsaw(), mealType });
      flashSaved();
      onSaved?.();
      setNlText(''); setNlItems(null); setNlRemovedIdx(new Set()); setNlMode(false);
      loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zapis nie powiódł się');
    } finally {
      setNlSaving(false);
    }
  }, [userId, nlItems, nlRemovedIdx, nlSaving, mealType, onSaved, loadLists, flashSaved, setNlText]);

  const editPreview = useMemo(() => {
    if (!editPer100) return null;
    const g = parseInt(editGrams, 10) || 0;
    return {
      calories: Math.round(editPer100.calories * g / 100),
      protein: Math.round(editPer100.protein * g / 100 * 10) / 10,
      carbs: editPer100.carbs != null ? Math.round(editPer100.carbs * g / 100 * 10) / 10 : null,
      fat: editPer100.fat != null ? Math.round(editPer100.fat * g / 100 * 10) / 10 : null,
    };
  }, [editGrams, editPer100]);

  const openEditEntry = useCallback((entry: RecentEntry) => {
    setEditingEntry(entry);
    setEditGrams(String(parseGrams(entry.amount)));
    setEditMealType(entry.meal_type ?? defaultMealType());
    setEditPer100(derivePer100(entry));
    setError(null);
  }, []);

  const saveEntryEdit = useCallback(async () => {
    if (!editingEntry || !userId || editSaving || !editPreview) return;
    setEditSaving(true);
    setError(null);
    try {
      const newGrams = parseInt(editGrams, 10) || 100;
      const { error: updErr } = await supabase.rpc('update_food_entry', {
        p_user_id: userId,
        p_entry_id: editingEntry.id,
        p_entry: {
          calories: editPreview.calories, protein: editPreview.protein,
          carbs: editPreview.carbs, fat: editPreview.fat,
          meal_type: editMealType, amount: `${newGrams} g`,
        },
      });
      if (updErr) throw updErr;
      const origGrams = parseGrams(editingEntry.amount);
      if (Math.abs(newGrams - origGrams) >= 5) {
        saveFoodCorrection(userId, editingEntry.name, newGrams).catch((e) =>
          console.warn('[FoodEntryModal] saveFoodCorrection failed', e),
        );
      }
      setEditingEntry(null);
      onSaved?.();
      loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktualizacja nie powiodła się');
    } finally {
      setEditSaving(false);
    }
  }, [editingEntry, userId, editGrams, editMealType, editPreview, editSaving, onSaved, loadLists]);

  const deleteEntry = useCallback(async () => {
    if (!editingEntry || !userId || editDeleting) return;
    haptics.light();
    setEditDeleting(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('remove_food_entry', {
        p_user_id: userId, p_entry_id: editingEntry.id,
      });
      if (rpcError) throw rpcError;
      setEditingEntry(null);
      onSaved?.();
      loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Usunięcie nie powiodło się');
    } finally {
      setEditDeleting(false);
    }
  }, [editingEntry, userId, editDeleting, onSaved, loadLists, haptics]);

  return {
    userId,
    activeTab, setActiveTab,
    favorites, setFavorites,
    recent, setRecent,
    loadingList,
    query, setQuery,
    searchResults, setSearchResults,
    searching,
    selected, setSelected,
    grams, setGrams,
    mealType, setMealType,
    saving,
    quickAddingId,
    savedFlash,
    error, setError,
    scannerOpen, setScannerOpen,
    scanLookingUp, setScanLookingUp,
    editingEntry, setEditingEntry,
    editGrams, setEditGrams,
    editMealType, setEditMealType,
    editPer100, setEditPer100,
    editSaving,
    editDeleting,
    todayTotals,
    targets,
    manualMode, setManualMode,
    manualName, setManualName,
    manualKcal, setManualKcal,
    manualProtein, setManualProtein,
    manualCarbs, setManualCarbs,
    manualFat, setManualFat,
    nlMode, setNlMode,
    nlText, setNlText,
    nlParsing,
    nlItems, setNlItems,
    nlSaving,
    nlRemovedIdx, setNlRemovedIdx,
    preview,
    editPreview,
    openEditEntry,
    save,
    quickAddSearchResult,
    quickAddFavorite,
    quickRepeatEntry,
    saveManual,
    parseNL,
    saveNLItems,
    saveEntryEdit,
    deleteEntry,
    todayStr,
    yesterdayStr,
    lookupBarcode
  };
}
