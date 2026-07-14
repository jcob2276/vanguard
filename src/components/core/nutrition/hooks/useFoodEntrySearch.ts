import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase, invokeEdge } from '../../../../lib/supabase';
import { NETWORK_TIMEOUT_MS } from '../../../../lib/constants';
import { type FoodBase, scale } from './foodEntryUtils';
import { useHaptics } from '../../../../hooks/useHaptics';

interface UseFoodEntrySearchOptions {
  userId: string | undefined;
  setError: (msg: string | null) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

async function searchFood(query: string, userId: string): Promise<FoodBase[]> {
  const libraryPromise = supabase
    .from('food_library')
    .select('name, brand, barcode, calories, protein, carbs, fat, fiber, sugar, default_grams')
    .eq('user_id', userId)
    .ilike('name', `%${query.trim()}%`)
    .limit(10);

  const offPromise = invokeEdge<{ results: FoodBase[] }>(
    `lookup-food?q=${encodeURIComponent(query.trim())}`,
    {
      method: 'GET',
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    }
  );

  const [libraryRes, offJson] = await Promise.all([libraryPromise, offPromise]);
  if (libraryRes.error) {
    console.error('[FoodEntryModal] food_library search failed', libraryRes.error);
  }

  const libraryResults: FoodBase[] = (libraryRes.data || []).map((r) => ({
    name: r.name,
    brand: r.brand,
    barcode: r.barcode,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    fiber: r.fiber,
    sugar: r.sugar,
    defaultGrams: r.default_grams,
  }));
  const seen = new Set(libraryResults.map((r) => r.name.toLowerCase()));
  const offResults: FoodBase[] = (offJson.results || []).filter(
    (r: FoodBase) => !seen.has(r.name.toLowerCase())
  );
  return [...libraryResults, ...offResults];
}

async function lookupBarcodeApi(code: string): Promise<FoodBase | null> {
  const json = await invokeEdge<{ results: FoodBase[] }>(
    `lookup-food?barcode=${encodeURIComponent(code)}`,
    {
      method: 'GET',
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    }
  );
  return (json.results || [])[0] ?? null;
}

export function useFoodEntrySearch({
  userId,
  setError,
  searchInputRef,
}: UseFoodEntrySearchOptions) {
  const haptics = useHaptics();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FoodBase | null>(null);
  const [grams, setGrams] = useState('100');
  const [scannerOpen, setScannerOpen] = useState(false);

  // Debounced search query — empty when input is too short
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    if (query.trim().length < 2) {
      // Defer the clear to avoid synchronous setState in effect
      const t = setTimeout(() => setDebouncedQuery(''), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const searchQuery = useQuery({
    queryKey: ['food-entry-search', userId, debouncedQuery],
    queryFn: () => searchFood(debouncedQuery, userId!),
    enabled: !!userId && debouncedQuery.length >= 2,
  });

  const barcodeMutation = useMutation({
    mutationFn: lookupBarcodeApi,
    onSuccess: (result) => {
      if (result) {
        setScannerOpen(false);
        setSelected(result);
        setGrams(String(result.defaultGrams ?? 100));
      } else {
        setScannerOpen(false);
        haptics.error();
        setError('Nie znaleziono kodu — wpisz nazwę produktu');
        setTimeout(() => { searchInputRef.current?.focus(); }, 50);
        setTimeout(() => setError(null), 3000);
      }
    },
    onError: () => {
      haptics.error();
      setError('Wyszukiwanie po kodzie nie powiodło się');
    },
  });

  const lookupBarcode = useCallback(async (code: string) => {
    setError(null);
    await barcodeMutation.mutateAsync(code);
  }, [barcodeMutation, setError]);

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

  return {
    query,
    setQuery,
    searchResults: searchQuery.data ?? [],
    setSearchResults: () => { /* managed by react-query */ },
    searching: searchQuery.isLoading,
    selected,
    setSelected,
    grams,
    setGrams,
    scannerOpen,
    setScannerOpen,
    scanLookingUp: barcodeMutation.isPending,
    setScanLookingUp: () => { /* managed by mutation */ },
    lookupBarcode,
    preview,
  };
}
