import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { NETWORK_TIMEOUT_MS } from '../../../../lib/constants';
import { type FoodBase, scale } from './foodEntryUtils';
import { useHaptics } from '../../../../hooks/useHaptics';

interface UseFoodEntrySearchOptions {
  userId: string | undefined;
  setError: (msg: string | null) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useFoodEntrySearch({
  userId,
  setError,
  searchInputRef,
}: UseFoodEntrySearchOptions) {
  const haptics = useHaptics();

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodBase[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FoodBase | null>(null);
  const [grams, setGrams] = useState('100');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanLookingUp, setScanLookingUp] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2 || !userId) {
      void (async () => {
        setSearchResults([]);
      })();
      return;
    }
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
          {
            headers: { Authorization: `Bearer ${authSession?.access_token}` },
            signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
          }
        ).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        });

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
        setSearchResults([...libraryResults, ...offResults]);
      } catch (err: unknown) {
        console.error('[FoodEntryModal] search failed', err);
        setError('Wyszukiwanie nie powiodło się');
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query, userId, setError]);

  const lookupBarcode = useCallback(async (code: string) => {
    setScanLookingUp(true);
    setError(null);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lookup-food?barcode=${encodeURIComponent(code)}`,
        {
          headers: { Authorization: `Bearer ${authSession?.access_token}` },
          signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
        }
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
    } catch (err: unknown) {
      console.error('[FoodEntryModal] barcode lookup failed', err);
      haptics.error();
      setError('Wyszukiwanie po kodzie nie powiodło się');
    } finally {
      setScanLookingUp(false);
    }
  }, [haptics, searchInputRef, setError]);

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
    searchResults,
    setSearchResults,
    searching,
    selected,
    setSelected,
    grams,
    setGrams,
    scannerOpen,
    setScannerOpen,
    scanLookingUp,
    setScanLookingUp,
    lookupBarcode,
    preview,
  };
}
