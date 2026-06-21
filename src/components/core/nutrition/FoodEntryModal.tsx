import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getTodayWarsaw } from '../../../lib/date';

interface FoodResult {
  barcode: string | null;
  name: string;
  brand: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
}

interface Favorite extends FoodResult {
  id: string;
  use_count: number;
}

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Śniadanie' },
  { id: 'lunch', label: 'Obiad' },
  { id: 'dinner', label: 'Kolacja' },
  { id: 'snack', label: 'Przekąska' },
];

function defaultMealType(): string {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' })).getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

function scale(value: number | null, grams: number): number | null {
  if (value == null) return null;
  return Math.round((value * grams) / 100 * 10) / 10;
}

export interface FoodEntryModalProps {
  session: any;
  onClose: () => void;
  onSaved?: () => void;
}

export default function FoodEntryModal({ session, onClose, onSaved }: FoodEntryModalProps) {
  const userId = session?.user?.id;
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FoodResult | null>(null);
  const [grams, setGrams] = useState('100');
  const [mealType, setMealType] = useState(defaultMealType());
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error: favError } = await supabase
        .from('food_favorites')
        .select('id, barcode, name, brand, calories, protein, carbs, fat, fiber, sugar, use_count')
        .eq('user_id', userId)
        .order('use_count', { ascending: false })
        .order('last_used', { ascending: false })
        .limit(20);
      if (favError) console.error('[FoodEntryModal] favorites fetch failed', favError);
      setFavorites(data || []);
      setLoadingFavorites(false);
    })();
  }, [userId]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lookup-food?q=${encodeURIComponent(query.trim())}`,
          {
            headers: { Authorization: `Bearer ${authSession?.access_token}` },
            signal: AbortSignal.timeout(15000),
          }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setSearchResults(json.results || []);
      } catch (err) {
        console.error('[FoodEntryModal] search failed', err);
        setError('Wyszukiwanie nie powiodło się');
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const preview = useMemo(() => {
    const gramsNum = parseInt(grams, 10) || 0;
    if (!selected) return null;
    return {
      calories: scale(selected.calories, gramsNum),
      protein: scale(selected.protein, gramsNum),
      carbs: scale(selected.carbs, gramsNum),
      fat: scale(selected.fat, gramsNum),
      fiber: scale(selected.fiber, gramsNum),
      sugar: scale(selected.sugar, gramsNum),
    };
  }, [selected, grams]);

  const save = useCallback(async () => {
    if (!selected || !userId || saving) return;
    const gramsNum = parseInt(grams, 10) || 100;
    setSaving(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('add_food_entry', {
        p_user_id: userId,
        p_date: getTodayWarsaw(),
        p_entry: {
          name: selected.name,
          brand: selected.brand,
          barcode: selected.barcode,
          calories: scale(selected.calories, gramsNum),
          protein: scale(selected.protein, gramsNum),
          carbs: scale(selected.carbs, gramsNum),
          fat: scale(selected.fat, gramsNum),
          fiber: scale(selected.fiber, gramsNum),
          sugar: scale(selected.sugar, gramsNum),
          meal_type: mealType,
          amount: `${gramsNum} g`,
        },
      });
      if (rpcError) throw rpcError;
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
      onSaved?.();
      setSelected(null);
      setQuery('');
      setGrams('100');
    } catch (err) {
      console.error('[FoodEntryModal] save failed', err);
      setError(err instanceof Error ? err.message : 'Zapis nie powiódł się');
    } finally {
      setSaving(false);
    }
  }, [selected, userId, grams, mealType, saving, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-[28px] border border-border-custom bg-surface shadow-2xl overflow-hidden animate-fadeIn max-h-[85vh] flex flex-col">
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-border-custom shrink-0">
          <span className="text-[12px] font-black uppercase tracking-widest text-text-primary">
            {selected ? 'Ile zjadłeś?' : 'Dodaj posiłek'}
          </span>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {!selected ? (
            <>
              <div className="relative mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj produktu..."
                  className="w-full rounded-xl border border-border-custom bg-surface-solid/40 pl-9 pr-3 py-2.5 text-[13px] text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40"
                />
                {searching && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted animate-spin" />
                )}
              </div>

              {error && <p className="mb-3 text-[11px] text-rose-500">{error}</p>}

              {query.trim().length >= 2 ? (
                <div className="space-y-1.5">
                  {searchResults.length === 0 && !searching && (
                    <p className="text-[12px] text-text-muted py-4 text-center">Brak wyników</p>
                  )}
                  {searchResults.map((r, i) => (
                    <button
                      key={`${r.barcode || r.name}-${i}`}
                      onClick={() => setSelected(r)}
                      className="w-full text-left rounded-xl border border-border-custom bg-surface-solid/30 px-3.5 py-2.5 hover:bg-surface-solid/60 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-bold text-text-primary truncate">{r.name}</span>
                        <span className="text-[11px] font-black text-primary shrink-0 ml-2">{r.calories ?? '?'} kcal</span>
                      </div>
                      {r.brand && <span className="text-[10px] text-text-muted">{r.brand}</span>}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-2">Twoje częste</p>
                  {loadingFavorites ? (
                    <div className="flex justify-center py-6">
                      <Loader2 size={16} className="text-text-muted animate-spin" />
                    </div>
                  ) : favorites.length === 0 ? (
                    <p className="text-[12px] text-text-muted py-4 text-center">
                      Brak ulubionych — zacznij od wyszukania produktu
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {favorites.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setSelected(f)}
                          className="w-full text-left rounded-xl border border-border-custom bg-surface-solid/30 px-3.5 py-2.5 hover:bg-surface-solid/60 active:scale-[0.99] transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-bold text-text-primary truncate">{f.name}</span>
                            <span className="text-[11px] font-black text-primary shrink-0 ml-2">{f.calories ?? '?'} kcal</span>
                          </div>
                          {f.brand && <span className="text-[10px] text-text-muted">{f.brand}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setSelected(null)}
                className="text-[11px] font-bold text-text-muted hover:text-text-primary cursor-pointer"
              >
                ← Wstecz
              </button>

              <div>
                <p className="text-[15px] font-black text-text-primary leading-tight">{selected.name}</p>
                {selected.brand && <p className="text-[11px] text-text-muted">{selected.brand}</p>}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  autoFocus
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  className="w-20 rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-[14px] font-bold text-text-primary text-center outline-none focus:border-primary/40"
                />
                <span className="text-[12px] text-text-muted">gram</span>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {MEAL_TYPES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMealType(m.id)}
                    className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      mealType === m.id
                        ? 'bg-primary text-white'
                        : 'border border-border-custom text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {preview && (
                <div className="rounded-xl bg-text-primary/[0.02] border border-border-custom/50 p-3 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-[13px] font-black text-text-primary">{preview.calories ?? '–'}</p>
                    <p className="text-[8px] uppercase text-text-muted">kcal</p>
                  </div>
                  <div>
                    <p className="text-[13px] font-black text-text-primary">{preview.protein ?? '–'}</p>
                    <p className="text-[8px] uppercase text-text-muted">B</p>
                  </div>
                  <div>
                    <p className="text-[13px] font-black text-text-primary">{preview.carbs ?? '–'}</p>
                    <p className="text-[8px] uppercase text-text-muted">W</p>
                  </div>
                  <div>
                    <p className="text-[13px] font-black text-text-primary">{preview.fat ?? '–'}</p>
                    <p className="text-[8px] uppercase text-text-muted">T</p>
                  </div>
                </div>
              )}

              {error && <p className="text-[11px] text-rose-500">{error}</p>}

              <button
                onClick={save}
                disabled={saving}
                className="w-full rounded-2xl bg-primary py-3 text-[12px] font-black uppercase tracking-wider text-white disabled:opacity-50 active:scale-95 transition-all cursor-pointer"
              >
                {saving ? 'Zapisuję...' : savedFlash ? 'Zapisano ✓' : 'Zapisz'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
