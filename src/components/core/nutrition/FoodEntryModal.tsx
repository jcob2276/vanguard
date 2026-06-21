import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Loader2, ScanLine, Plus, ChevronDown, RotateCcw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getTodayWarsaw, formatWarsawDate } from '../../../lib/date';

interface FoodBase {
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

interface Favorite extends FoodBase {
  id: string;
  use_count: number;
  default_grams: number;
}

interface RecentEntry {
  id: string;
  name: string;
  brand: string | null;
  calories: number | null;
  amount: string | null;
  date: string;
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

function dayLabel(dateStr: string, todayStr: string, yesterdayStr: string): string {
  if (dateStr === todayStr) return 'Dzisiaj';
  if (dateStr === yesterdayStr) return 'Wczoraj';
  const [, m, d] = dateStr.split('-');
  return `${d}.${m}`;
}

export interface FoodEntryModalProps {
  session: any;
  onClose: () => void;
  onSaved?: () => void;
}

export default function FoodEntryModal({ session, onClose, onSaved }: FoodEntryModalProps) {
  const userId = session?.user?.id;
  const [activeTab, setActiveTab] = useState<'favorites' | 'recent'>('favorites');
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodBase[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FoodBase | null>(null);
  const [grams, setGrams] = useState('100');
  const [mealType, setMealType] = useState(defaultMealType());
  const [saving, setSaving] = useState(false);
  const [quickAddingId, setQuickAddingId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerNotice, setScannerNotice] = useState(false);

  const todayStr = getTodayWarsaw();
  const yesterdayStr = formatWarsawDate(new Date(Date.now() - 86400000));

  const loadLists = useCallback(async () => {
    if (!userId) return;
    setLoadingList(true);
    const [favRes, recentRes] = await Promise.all([
      supabase
        .from('food_favorites')
        .select('id, barcode, name, brand, calories, protein, carbs, fat, fiber, sugar, use_count, default_grams')
        .eq('user_id', userId)
        .order('use_count', { ascending: false })
        .order('last_used', { ascending: false })
        .limit(20),
      supabase
        .from('daily_food_entries')
        .select('id, name, brand, calories, amount, date')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(15),
    ]);
    if (favRes.error) console.error('[FoodEntryModal] favorites fetch failed', favRes.error);
    if (recentRes.error) console.error('[FoodEntryModal] recent fetch failed', recentRes.error);
    setFavorites(favRes.data || []);
    setRecent(recentRes.data || []);
    setLoadingList(false);
  }, [userId]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

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
        p_grams: gramsNum,
        p_entry: {
          name: selected.name,
          brand: selected.brand,
          barcode: selected.barcode,
          calories: selected.calories,
          protein: selected.protein,
          carbs: selected.carbs,
          fat: selected.fat,
          fiber: selected.fiber,
          sugar: selected.sugar,
          meal_type: mealType,
        },
      });
      if (rpcError) throw rpcError;
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
      onSaved?.();
      setSelected(null);
      setQuery('');
      setGrams('100');
      loadLists();
    } catch (err) {
      console.error('[FoodEntryModal] save failed', err);
      setError(err instanceof Error ? err.message : 'Zapis nie powiódł się');
    } finally {
      setSaving(false);
    }
  }, [selected, userId, grams, mealType, saving, onSaved, loadLists]);

  const quickAddFavorite = useCallback(async (fav: Favorite) => {
    if (!userId || quickAddingId) return;
    setQuickAddingId(fav.id);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('add_food_entry', {
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
        },
      });
      if (rpcError) throw rpcError;
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
      onSaved?.();
      loadLists();
    } catch (err) {
      console.error('[FoodEntryModal] quick add failed', err);
      setError(err instanceof Error ? err.message : 'Zapis nie powiódł się');
    } finally {
      setQuickAddingId(null);
    }
  }, [userId, quickAddingId, mealType, onSaved, loadLists]);

  const quickRepeatEntry = useCallback(async (entry: RecentEntry) => {
    if (!userId || quickAddingId) return;
    setQuickAddingId(entry.id);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('repeat_food_entry', {
        p_user_id: userId,
        p_source_entry_id: entry.id,
        p_date: getTodayWarsaw(),
      });
      if (rpcError) throw rpcError;
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
      onSaved?.();
      loadLists();
    } catch (err) {
      console.error('[FoodEntryModal] repeat failed', err);
      setError(err instanceof Error ? err.message : 'Zapis nie powiódł się');
    } finally {
      setQuickAddingId(null);
    }
  }, [userId, quickAddingId, onSaved, loadLists]);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-t-[28px] border border-border-custom bg-surface shadow-2xl overflow-hidden animate-fadeIn max-h-[88vh] flex flex-col">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-border-custom shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-black text-text-primary">
              {selected ? 'Ile zjadłeś?' : 'Dodaj posiłek'}
            </span>
            {!selected && (
              <div className="relative">
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  className="appearance-none rounded-full border border-border-custom bg-surface-solid/40 pl-3 pr-6 py-1 text-[10px] font-bold text-text-secondary cursor-pointer outline-none"
                >
                  {MEAL_TYPES.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {!selected ? (
            <>
              <div className="flex items-center gap-2 mb-4 rounded-full border border-border-custom bg-surface-solid/40 pl-1 pr-1.5">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Szukaj produktu..."
                    className="w-full bg-transparent pl-9 pr-2 py-2.5 text-[13px] text-text-primary outline-none placeholder:text-text-muted/40"
                  />
                </div>
                {searching ? (
                  <Loader2 size={15} className="text-text-muted animate-spin mr-1.5" />
                ) : (
                  <button
                    onClick={() => setScannerNotice(true)}
                    className="rounded-full p-2 text-text-muted hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                    title="Skanuj kod"
                  >
                    <ScanLine size={16} />
                  </button>
                )}
              </div>

              {scannerNotice && (
                <p className="mb-3 text-[11px] text-text-muted text-center">
                  Skaner kodów wkrótce — na razie szukaj po nazwie ✦
                </p>
              )}
              {error && <p className="mb-3 text-[11px] text-rose-500">{error}</p>}

              {query.trim().length >= 2 ? (
                <div className="space-y-1.5">
                  {searchResults.length === 0 && !searching && (
                    <p className="text-[12px] text-text-muted py-4 text-center">Brak wyników</p>
                  )}
                  {searchResults.map((r, i) => (
                    <FoodRow
                      key={`${r.barcode || r.name}-${i}`}
                      name={r.name}
                      subtitle={r.brand}
                      calories={r.calories}
                      onTap={() => { setSelected(r); setGrams('100'); }}
                      onQuickAdd={() => { setSelected(r); setGrams('100'); }}
                      quickAddIcon={<Plus size={13} />}
                    />
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex gap-1.5 mb-3">
                    <button
                      onClick={() => setActiveTab('favorites')}
                      className={`rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        activeTab === 'favorites' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      Częste
                    </button>
                    <button
                      onClick={() => setActiveTab('recent')}
                      className={`rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        activeTab === 'recent' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      Ostatnie
                    </button>
                  </div>

                  {loadingList ? (
                    <div className="flex justify-center py-6">
                      <Loader2 size={16} className="text-text-muted animate-spin" />
                    </div>
                  ) : activeTab === 'favorites' ? (
                    favorites.length === 0 ? (
                      <p className="text-[12px] text-text-muted py-4 text-center">
                        Brak częstych — zacznij od wyszukania produktu
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {favorites.map((f) => (
                          <FoodRow
                            key={f.id}
                            name={f.name}
                            subtitle={[f.brand, `${f.default_grams} g`].filter(Boolean).join(' · ')}
                            calories={scale(f.calories, f.default_grams)}
                            loading={quickAddingId === f.id}
                            onTap={() => { setSelected(f); setGrams(String(f.default_grams)); }}
                            onQuickAdd={() => quickAddFavorite(f)}
                            quickAddIcon={<Plus size={13} />}
                          />
                        ))}
                      </div>
                    )
                  ) : recent.length === 0 ? (
                    <p className="text-[12px] text-text-muted py-4 text-center">Brak ostatnich wpisów</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(
                        recent.reduce<Record<string, RecentEntry[]>>((acc, r) => {
                          (acc[r.date] ||= []).push(r);
                          return acc;
                        }, {})
                      ).map(([date, entries]) => (
                        <div key={date}>
                          <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1.5">
                            {dayLabel(date, todayStr, yesterdayStr)}
                          </p>
                          <div className="space-y-1.5">
                            {entries.map((e) => (
                              <FoodRow
                                key={e.id}
                                name={e.name}
                                subtitle={[e.brand, e.amount].filter(Boolean).join(' · ')}
                                calories={e.calories}
                                loading={quickAddingId === e.id}
                                onTap={() => quickRepeatEntry(e)}
                                onQuickAdd={() => quickRepeatEntry(e)}
                                quickAddIcon={<RotateCcw size={12} />}
                              />
                            ))}
                          </div>
                        </div>
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
    </div>,
    document.body
  );
}

function FoodRow({
  name,
  subtitle,
  calories,
  loading,
  onTap,
  onQuickAdd,
  quickAddIcon,
}: {
  name: string;
  subtitle?: string | null;
  calories: number | null;
  loading?: boolean;
  onTap: () => void;
  onQuickAdd: () => void;
  quickAddIcon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border-custom bg-surface-solid/30 px-3 py-2 hover:bg-surface-solid/60 transition-all">
      <button onClick={onTap} className="flex-1 min-w-0 text-left cursor-pointer">
        <p className="text-[13px] font-bold text-text-primary truncate">{name}</p>
        {subtitle && <p className="text-[10px] text-text-muted truncate">{subtitle}</p>}
      </button>
      <span className="text-[11px] font-black text-primary shrink-0">{calories ?? '?'} kcal</span>
      <button
        onClick={onQuickAdd}
        disabled={loading}
        className="shrink-0 rounded-full bg-primary p-1.5 text-white active:scale-90 transition-all cursor-pointer disabled:opacity-50"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : quickAddIcon}
      </button>
    </div>
  );
}
