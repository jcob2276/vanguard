import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { lookupFoodBarcode, searchExternalFoods, searchPrivateFoodLibrary } from '../../../../lib/health/foodSearch';
import { type FoodBase, scale } from './foodEntryUtils';
import { useHaptics } from '../../../../hooks/useHaptics';

interface UseFoodEntrySearchOptions {
  userId: string | undefined;
  setError: (msg: string | null) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useFoodEntrySearch({ userId, setError, searchInputRef }: UseFoodEntrySearchOptions) {
  const haptics = useHaptics();
  const [query, setQueryState] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<FoodBase | null>(null);
  const [grams, setGrams] = useState('100');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [externalResults, setExternalResults] = useState<FoodBase[]>([]);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setExternalResults([]);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(() => setDebouncedQuery(trimmed.length >= 2 ? trimmed : ''), 220);
    return () => clearTimeout(timer);
  }, [query]);

  const localQuery = useQuery({
    queryKey: ['food-private-search', userId, debouncedQuery],
    queryFn: () => searchPrivateFoodLibrary(userId!, debouncedQuery),
    enabled: !!userId && debouncedQuery.length >= 2,
  });

  const externalMutation = useMutation({
    mutationFn: () => searchExternalFoods(query),
    onSuccess: (response) => {
      setExternalResults(response.results);
      if (response.status !== 'ok') {
        setError('Baza zewnętrzna jest chwilowo niedostępna. Twoja biblioteka nadal działa.');
      } else if (response.results.length === 0 && response.incompleteCount > 0) {
        setError('Znaleziono produkt, ale bez kalorii na etykiecie. Zeskanuj etykietę, żeby zapisać go bez zgadywania.');
      }
    },
    onError: () => setError('Baza zewnętrzna jest chwilowo niedostępna. Twoja biblioteka nadal działa.'),
  });

  const searchExternal = useCallback(() => {
    setError(null);
    externalMutation.mutate();
  }, [externalMutation, setError]);

  const barcodeMutation = useMutation({
    mutationFn: lookupFoodBarcode,
    onSuccess: (result) => {
      setScannerOpen(false);
      if (result) {
        setSelected(result);
        setGrams(String(result.defaultGrams ?? 100));
        return;
      }
      haptics.error();
      setError('Nie znaleziono kodu — wpisz nazwę lub zeskanuj etykietę');
      setTimeout(() => searchInputRef.current?.focus(), 50);
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
      calories: scale(selected.calories, gramsNum), protein: scale(selected.protein, gramsNum),
      carbs: scale(selected.carbs, gramsNum), fat: scale(selected.fat, gramsNum),
    };
  }, [selected, grams]);

  return {
    query, setQuery,
    searchResults: [...(localQuery.data ?? []), ...externalResults],
    searching: localQuery.isLoading,
    externalSearching: externalMutation.isPending,
    externalSearched: externalMutation.isSuccess,
    searchExternal,
    selected, setSelected, grams, setGrams, scannerOpen, setScannerOpen,
    scanLookingUp: barcodeMutation.isPending, lookupBarcode, preview,
  };
}
