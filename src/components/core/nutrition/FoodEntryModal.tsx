import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Loader2, ScanLine, Plus, ChevronDown, RotateCcw, Keyboard, PenLine, Sparkles, Trash2, Check } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getTodayWarsaw, formatWarsawDate } from '../../../lib/date';

declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => {
      detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
    };
  }
}

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
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  amount: string | null;
  date: string;
  meal_type?: string | null;
}

function parseGrams(amount: string | null): number {
  if (!amount) return 100;
  const m = amount.match(/(\d+(?:\.\d+)?)/);
  return m ? Math.round(parseFloat(m[1])) : 100;
}

function derivePer100(entry: RecentEntry) {
  const g = parseGrams(entry.amount) || 100;
  return {
    calories: (entry.calories ?? 0) * 100 / g,
    protein: (entry.protein ?? 0) * 100 / g,
    carbs: entry.carbs != null ? entry.carbs * 100 / g : null,
    fat: entry.fat != null ? entry.fat * 100 / g : null,
  };
}

interface NLItem {
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number | null;
  fat: number | null;
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
  initialEditEntry?: RecentEntry;
  initialMealType?: string;
}

type Screen = 'browse' | 'portion' | 'edit' | 'manual' | 'nl';

export default function FoodEntryModal({ session, onClose, onSaved, initialEditEntry, initialMealType }: FoodEntryModalProps) {
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

  // Manual entry
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualKcal, setManualKcal] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');

  // NL mode
  const [nlMode, setNlMode] = useState(false);
  const [nlText, setNlText] = useState('');
  const [nlParsing, setNlParsing] = useState(false);
  const [nlItems, setNlItems] = useState<NLItem[] | null>(null);
  const [nlSaving, setNlSaving] = useState(false);
  const [nlRemovedIdx, setNlRemovedIdx] = useState<Set<number>>(new Set());

  const todayStr = getTodayWarsaw();
  const yesterdayStr = formatWarsawDate(new Date(Date.now() - 86400000));

  const screen: Screen = editingEntry
    ? 'edit'
    : nlMode
    ? 'nl'
    : manualMode
    ? 'manual'
    : selected
    ? 'portion'
    : 'browse';

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
        .select('id, name, brand, calories, protein, carbs, fat, amount, date')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(15),
    ]);
    if (favRes.error) console.error('[FoodEntryModal] favorites fetch failed', favRes.error);
    if (recentRes.error) console.error('[FoodEntryModal] recent fetch failed', recentRes.error);
    setFavorites(favRes.data || []);
    setRecent(recentRes.data || []);
    setLoadingList(false);
  }, [userId]);

  useEffect(() => { loadLists(); }, [loadLists]);

  useEffect(() => {
    if (query.trim().length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lookup-food?q=${encodeURIComponent(query.trim())}`,
          { headers: { Authorization: `Bearer ${authSession?.access_token}` }, signal: AbortSignal.timeout(15000) }
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

  const lookupBarcode = useCallback(async (code: string) => {
    setScanLookingUp(true);
    setError(null);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lookup-food?barcode=${encodeURIComponent(code)}`,
        { headers: { Authorization: `Bearer ${authSession?.access_token}` }, signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const result = (json.results || [])[0];
      if (result) { setScannerOpen(false); setSelected(result); setGrams('100'); }
      else setError(`Nie znaleziono produktu dla kodu ${code}`);
    } catch (err) {
      console.error('[FoodEntryModal] barcode lookup failed', err);
      setError('Wyszukiwanie po kodzie nie powiodło się');
    } finally {
      setScanLookingUp(false);
    }
  }, []);

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

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const flashSaved = useCallback(() => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }, []);

  // ── Save from portion selector ────────────────────────────────────────────────
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
      flashSaved();
      onSaved?.();
      setSelected(null); setQuery(''); setGrams('100');
      loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zapis nie powiódł się');
    } finally {
      setSaving(false);
    }
  }, [selected, userId, grams, mealType, saving, onSaved, loadLists, flashSaved]);

  // ── Quick-add from search results (1 tap, 100g default) ──────────────────────
  const quickAddSearchResult = useCallback(async (food: FoodBase) => {
    if (!userId || quickAddingId) return;
    const key = `srch:${food.name}`;
    setQuickAddingId(key);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('add_food_entry', {
        p_user_id: userId, p_date: getTodayWarsaw(), p_grams: 100,
        p_entry: {
          name: food.name, brand: food.brand, barcode: food.barcode,
          calories: food.calories, protein: food.protein, carbs: food.carbs,
          fat: food.fat, fiber: food.fiber, sugar: food.sugar, meal_type: mealType,
        },
      });
      if (rpcError) throw rpcError;
      flashSaved();
      onSaved?.();
      loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zapis nie powiódł się');
    } finally {
      setQuickAddingId(null);
    }
  }, [userId, quickAddingId, mealType, onSaved, loadLists, flashSaved]);

  // ── Quick-add favorite ────────────────────────────────────────────────────────
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
      flashSaved();
      onSaved?.();
      loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zapis nie powiódł się');
    } finally {
      setQuickAddingId(null);
    }
  }, [userId, quickAddingId, mealType, onSaved, loadLists, flashSaved]);

  // ── Repeat recent entry ───────────────────────────────────────────────────────
  const quickRepeatEntry = useCallback(async (entry: RecentEntry) => {
    if (!userId || quickAddingId) return;
    setQuickAddingId(entry.id);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('repeat_food_entry', {
        p_user_id: userId, p_source_entry_id: entry.id, p_date: getTodayWarsaw(),
      });
      if (rpcError) throw rpcError;
      flashSaved();
      onSaved?.();
      loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zapis nie powiódł się');
    } finally {
      setQuickAddingId(null);
    }
  }, [userId, quickAddingId, onSaved, loadLists, flashSaved]);

  // ── Manual entry ──────────────────────────────────────────────────────────────
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
  }, [userId, saving, manualName, manualKcal, manualProtein, manualCarbs, manualFat, mealType, onSaved, loadLists, flashSaved]);

  // ── NL parse ──────────────────────────────────────────────────────────────────
  const parseNL = useCallback(async () => {
    if (!nlText.trim() || nlParsing) return;
    setNlParsing(true);
    setError(null);
    setNlItems(null);
    setNlRemovedIdx(new Set());
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-food-nl`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${authSession?.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: nlText.trim() }),
          signal: AbortSignal.timeout(30000),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setNlItems(json.items || []);
    } catch (err) {
      console.error('[FoodEntryModal] NL parse failed', err);
      setError('Parsowanie nie powiodło się — spróbuj ponownie');
    } finally {
      setNlParsing(false);
    }
  }, [nlText, nlParsing]);

  // ── NL bulk save ──────────────────────────────────────────────────────────────
  const saveNLItems = useCallback(async () => {
    if (!userId || !nlItems || nlSaving) return;
    const toSave = nlItems.filter((_, i) => !nlRemovedIdx.has(i));
    if (!toSave.length) return;
    setNlSaving(true);
    setError(null);
    try {
      const today = getTodayWarsaw();
      // Sequential to avoid advisory lock contention on the same (user, date) key.
      // add_food_entry expects p_entry as per-100g values and scales by p_grams/100 —
      // but item.calories/protein/carbs/fat are already scaled to item.grams, so they
      // must be converted back to per-100g here. Sending them as-is with p_grams:100
      // (as before) reproduced the right logged total but poisoned food_favorites with
      // the wrong per-100g density, corrupting any future re-add at a different grams.
      for (const item of toSave) {
        const scale100 = item.grams > 0 ? 100 / item.grams : 1;
        const { error: rpcError } = await supabase.rpc('add_food_entry', {
          p_user_id: userId, p_date: today, p_grams: item.grams,
          p_entry: {
            name: item.name, brand: null, barcode: null,
            calories: Math.round(item.calories * scale100),
            protein: Math.round(item.protein * scale100 * 10) / 10,
            carbs: item.carbs != null ? Math.round(item.carbs * scale100 * 10) / 10 : null,
            fat: item.fat != null ? Math.round(item.fat * scale100 * 10) / 10 : null,
            fiber: null, sugar: null, meal_type: mealType,
          },
        });
        if (rpcError) throw rpcError;
      }
      flashSaved();
      onSaved?.();
      setNlText(''); setNlItems(null); setNlRemovedIdx(new Set()); setNlMode(false);
      loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zapis nie powiódł się');
    } finally {
      setNlSaving(false);
    }
  }, [userId, nlItems, nlRemovedIdx, nlSaving, mealType, onSaved, loadLists, flashSaved]);

  // ── Edit existing entry ───────────────────────────────────────────────────────
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

  // Updates the row in place via update_food_entry — keeps the same id and logged_at
  // (so the entry doesn't jump to the bottom of today's/recent list), unlike the old
  // remove+add approach which also pointlessly bumped the favorites cache.
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
  }, [editingEntry, userId, editDeleting, onSaved, loadLists]);

  const nlActiveCount = nlItems ? nlItems.filter((_, i) => !nlRemovedIdx.has(i)).length : 0;

  const headerTitle =
    screen === 'edit' ? 'Edytuj wpis'
    : screen === 'nl' ? 'Opisz posiłek'
    : screen === 'manual' ? 'Wpisz ręcznie'
    : screen === 'portion' ? 'Ile zjadłeś?'
    : savedFlash ? '✓ Dodano!' : 'Dodaj posiłek';

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-t-[28px] border border-border-custom bg-surface shadow-2xl overflow-hidden animate-fadeIn max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-border-custom shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-[15px] font-black transition-colors ${savedFlash && screen === 'browse' ? 'text-emerald-400' : 'text-text-primary'}`}>
              {headerTitle}
            </span>
            {screen === 'browse' && (
              <div className="relative">
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  className="appearance-none rounded-full border border-border-custom bg-surface-solid/40 pl-3 pr-6 py-1 text-[10px] font-bold text-text-secondary cursor-pointer outline-none"
                >
                  {MEAL_TYPES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
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

          {/* ── Edit screen ───────────────────────────────────────── */}
          {screen === 'edit' && editingEntry && (
            <div className="space-y-4">
              <button onClick={() => setEditingEntry(null)} className="text-[11px] font-bold text-text-muted hover:text-text-primary cursor-pointer">← Wstecz</button>
              <div>
                <p className="text-[15px] font-black text-text-primary leading-tight">{editingEntry.name}</p>
                {editingEntry.brand && <p className="text-[11px] text-text-muted">{editingEntry.brand}</p>}
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted block mb-1">Gramatura</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" inputMode="numeric" autoFocus
                    value={editGrams}
                    onChange={(e) => setEditGrams(e.target.value)}
                    className="w-24 rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-[14px] font-bold text-text-primary text-center outline-none focus:border-primary/40"
                  />
                  <span className="text-[12px] text-text-muted">gram</span>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {MEAL_TYPES.map((m) => (
                  <button key={m.id} onClick={() => setEditMealType(m.id)}
                    className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${editMealType === m.id ? 'bg-primary text-white' : 'border border-border-custom text-text-muted'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
              {editPreview && (
                <div className="rounded-xl bg-text-primary/[0.02] border border-border-custom/50 p-3 grid grid-cols-4 gap-2 text-center">
                  {([['kcal', editPreview.calories], ['B', editPreview.protein], ['W', editPreview.carbs], ['T', editPreview.fat]] as [string, number | null][]).map(([label, val]) => (
                    <div key={label}>
                      <p className="text-[13px] font-black text-text-primary">{val ?? '–'}</p>
                      <p className="text-[8px] uppercase text-text-muted">{label}</p>
                    </div>
                  ))}
                </div>
              )}
              {error && <p className="text-[11px] text-rose-500">{error}</p>}
              <div className="flex gap-2">
                <button onClick={deleteEntry} disabled={editDeleting || editSaving}
                  className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[12px] font-black uppercase tracking-wider text-rose-500 disabled:opacity-50 active:scale-95 transition-all cursor-pointer">
                  {editDeleting ? <Loader2 size={14} className="animate-spin" /> : 'Usuń'}
                </button>
                <button onClick={saveEntryEdit} disabled={editSaving || editDeleting}
                  className="flex-1 rounded-2xl bg-primary py-3 text-[12px] font-black uppercase tracking-wider text-white disabled:opacity-50 active:scale-95 transition-all cursor-pointer">
                  {editSaving ? 'Zapisuję...' : 'Zapisz'}
                </button>
              </div>
            </div>
          )}

          {/* ── NL screen ─────────────────────────────────────────── */}
          {screen === 'nl' && (
            <div className="space-y-4">
              <button onClick={() => { setNlMode(false); setNlItems(null); setError(null); }}
                className="text-[11px] font-bold text-text-muted hover:text-text-primary cursor-pointer">← Wstecz</button>

              <div className="flex gap-1.5 flex-wrap mb-1">
                {MEAL_TYPES.map((m) => (
                  <button key={m.id} onClick={() => setMealType(m.id)}
                    className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${mealType === m.id ? 'bg-primary text-white' : 'border border-border-custom text-text-muted'}`}>
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <textarea
                  autoFocus
                  value={nlText}
                  onChange={(e) => { setNlText(e.target.value); if (nlItems) { setNlItems(null); setNlRemovedIdx(new Set()); } }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); parseNL(); } }}
                  placeholder={'Opisz co zjadłeś, np.:\n"2 jajka ugotowane, twaróg 150g, kawa z mlekiem"\n"miseczka owsianki z bananem i jogurtem"'}
                  rows={4}
                  className="w-full rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2.5 text-[13px] text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40 resize-none"
                />
                <span className="absolute bottom-2 right-2 text-[9px] text-text-muted/40">Ctrl+Enter</span>
              </div>

              <button
                onClick={parseNL}
                disabled={!nlText.trim() || nlParsing}
                className="w-full rounded-2xl border border-primary/30 bg-primary/[0.08] py-2.5 text-[12px] font-black uppercase tracking-wider text-primary disabled:opacity-40 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {nlParsing ? <><Loader2 size={14} className="animate-spin" />Parsowanie...</> : <><Sparkles size={14} />Parsuj</>}
              </button>

              {error && <p className="text-[11px] text-rose-500">{error}</p>}

              {/* Parsed items preview */}
              {nlItems && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">
                    Znalezione ({nlActiveCount}/{nlItems.length})
                  </p>
                  {nlItems.map((item, i) => {
                    const removed = nlRemovedIdx.has(i);
                    return (
                      <div key={i} className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all ${removed ? 'opacity-30 border-border-custom/30 bg-transparent' : 'border-border-custom bg-surface-solid/20'}`}>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] font-semibold truncate ${removed ? 'line-through text-text-muted' : 'text-text-primary'}`}>{item.name}</p>
                          <p className="text-[9px] text-text-muted">{item.grams}g</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[11px] font-black text-text-secondary">{item.calories} kcal</p>
                          <p className="text-[9px] text-text-muted">
                            {item.protein}B · {item.carbs ?? '?'}W · {item.fat ?? '?'}T
                          </p>
                        </div>
                        <button
                          onClick={() => setNlRemovedIdx(prev => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            return next;
                          })}
                          className="shrink-0 rounded-full p-1 transition-all cursor-pointer text-text-muted hover:text-rose-400 hover:bg-rose-500/10"
                        >
                          {removed ? <Check size={13} className="text-emerald-400" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    );
                  })}

                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-2">
                      {(() => {
                        const active = nlItems.filter((_, i) => !nlRemovedIdx.has(i));
                        const totKcal = active.reduce((s, item) => s + item.calories, 0);
                        const totB = Math.round(active.reduce((s, item) => s + item.protein, 0) * 10) / 10;
                        const totW = Math.round(active.reduce((s, item) => s + (item.carbs ?? 0), 0) * 10) / 10;
                        const totT = Math.round(active.reduce((s, item) => s + (item.fat ?? 0), 0) * 10) / 10;
                        return (
                          <span className="text-[10px] text-text-muted">
                            Łącznie: <span className="font-black text-text-secondary">{totKcal} kcal</span>
                            {' · '}<span className="font-bold text-primary">{totB}B</span>
                            {' · '}<span className="font-bold text-amber-400">{totW}W</span>
                            {' · '}<span className="font-bold text-text-secondary">{totT}T</span>
                          </span>
                        );
                      })()}
                    </div>
                    <button
                      onClick={saveNLItems}
                      disabled={nlSaving || nlActiveCount === 0}
                      className="w-full rounded-2xl bg-primary py-3 text-[12px] font-black uppercase tracking-wider text-white disabled:opacity-50 active:scale-95 transition-all cursor-pointer"
                    >
                      {nlSaving ? 'Zapisuję...' : `Dodaj ${nlActiveCount} ${nlActiveCount === 1 ? 'produkt' : nlActiveCount < 5 ? 'produkty' : 'produktów'}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Manual entry screen ───────────────────────────────── */}
          {screen === 'manual' && (
            <div className="space-y-4">
              <button onClick={() => { setManualMode(false); setError(null); }}
                className="text-[11px] font-bold text-text-muted hover:text-text-primary cursor-pointer">← Wstecz</button>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted block mb-1">Nazwa</label>
                <input type="text" autoFocus value={manualName} onChange={(e) => setManualName(e.target.value)}
                  placeholder="np. Pizza Margherita, Sałatka grecka..."
                  className="w-full rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2.5 text-[13px] text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted block mb-1">Kcal *</label>
                  <input type="number" inputMode="numeric" value={manualKcal} onChange={(e) => setManualKcal(e.target.value)} placeholder="0"
                    className="w-full rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-[14px] font-bold text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/30" />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted block mb-1">Białko g</label>
                  <input type="number" inputMode="numeric" value={manualProtein} onChange={(e) => setManualProtein(e.target.value)} placeholder="0"
                    className="w-full rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-[14px] font-bold text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted block mb-1">Węgle g</label>
                  <input type="number" inputMode="numeric" value={manualCarbs} onChange={(e) => setManualCarbs(e.target.value)} placeholder="opcjonalne"
                    className="w-full rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-[13px] text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/30" />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted block mb-1">Tłuszcze g</label>
                  <input type="number" inputMode="numeric" value={manualFat} onChange={(e) => setManualFat(e.target.value)} placeholder="opcjonalne"
                    className="w-full rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-[13px] text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/30" />
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {MEAL_TYPES.map((m) => (
                  <button key={m.id} onClick={() => setMealType(m.id)}
                    className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${mealType === m.id ? 'bg-primary text-white' : 'border border-border-custom text-text-muted'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
              {error && <p className="text-[11px] text-rose-500">{error}</p>}
              <button onClick={saveManual} disabled={saving || !manualName.trim() || !manualKcal.trim()}
                className="w-full rounded-2xl bg-primary py-3 text-[12px] font-black uppercase tracking-wider text-white disabled:opacity-50 active:scale-95 transition-all cursor-pointer">
                {saving ? 'Zapisuję...' : savedFlash ? 'Zapisano ✓' : 'Zapisz'}
              </button>
            </div>
          )}

          {/* ── Portion selector ──────────────────────────────────── */}
          {screen === 'portion' && selected && (
            <div className="space-y-4">
              <button onClick={() => setSelected(null)} className="text-[11px] font-bold text-text-muted hover:text-text-primary cursor-pointer">← Wstecz</button>
              <div>
                <p className="text-[15px] font-black text-text-primary leading-tight">{selected.name}</p>
                {selected.brand && <p className="text-[11px] text-text-muted">{selected.brand}</p>}
              </div>
              <div className="flex items-center gap-2">
                <input type="number" inputMode="numeric" autoFocus value={grams} onChange={(e) => setGrams(e.target.value)}
                  className="w-20 rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-[14px] font-bold text-text-primary text-center outline-none focus:border-primary/40" />
                <span className="text-[12px] text-text-muted">gram</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {MEAL_TYPES.map((m) => (
                  <button key={m.id} onClick={() => setMealType(m.id)}
                    className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${mealType === m.id ? 'bg-primary text-white' : 'border border-border-custom text-text-muted'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
              {preview && (
                <div className="rounded-xl bg-text-primary/[0.02] border border-border-custom/50 p-3 grid grid-cols-4 gap-2 text-center">
                  {[['kcal', preview.calories], ['B', preview.protein], ['W', preview.carbs], ['T', preview.fat]].map(([label, val]) => (
                    <div key={String(label)}>
                      <p className="text-[13px] font-black text-text-primary">{val ?? '–'}</p>
                      <p className="text-[8px] uppercase text-text-muted">{label}</p>
                    </div>
                  ))}
                </div>
              )}
              {error && <p className="text-[11px] text-rose-500">{error}</p>}
              <button onClick={save} disabled={saving}
                className="w-full rounded-2xl bg-primary py-3 text-[12px] font-black uppercase tracking-wider text-white disabled:opacity-50 active:scale-95 transition-all cursor-pointer">
                {saving ? 'Zapisuję...' : savedFlash ? 'Zapisano ✓' : 'Zapisz'}
              </button>
            </div>
          )}

          {/* ── Browse screen ─────────────────────────────────────── */}
          {screen === 'browse' && (
            <>
              {/* Search bar + scanner */}
              <div className="flex items-center gap-2 mb-3 rounded-full border border-border-custom bg-surface-solid/40 pl-1 pr-1.5">
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
                  <button onClick={() => { setError(null); setScannerOpen(true); }}
                    className="rounded-full p-2 text-text-muted hover:text-primary hover:bg-primary/10 transition-all cursor-pointer" title="Skanuj kod">
                    <ScanLine size={16} />
                  </button>
                )}
              </div>

              {error && <p className="mb-3 text-[11px] text-rose-500">{error}</p>}

              {scannerOpen ? (
                <BarcodeScanner onDetected={lookupBarcode} onClose={() => setScannerOpen(false)} loading={scanLookingUp} />
              ) : query.trim().length >= 2 ? (
                /* Search results — + button = immediate 100g add, text tap = portion selector */
                <div className="space-y-1.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-text-muted mb-2">
                    Wyniki — ✚ dodaje 100g od razu, nazwa otwiera porcję
                  </p>
                  {searchResults.length === 0 && !searching && (
                    <div className="py-4 text-center space-y-3">
                      <p className="text-[12px] text-text-muted">Brak wyników dla &quot;{query}&quot;</p>
                      <button
                        onClick={() => { setNlMode(true); setNlText(query); setQuery(''); setError(null); }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/[0.06] px-4 py-2 text-[11px] font-black text-primary cursor-pointer"
                      >
                        <Sparkles size={13} /> Opisz posiłek słowami
                      </button>
                    </div>
                  )}
                  {searchResults.map((r, i) => (
                    <FoodRow
                      key={`${r.barcode || r.name}-${i}`}
                      name={r.name}
                      subtitle={r.brand ? `${r.brand} · 100g` : '100g'}
                      calories={r.calories}
                      loading={quickAddingId === `srch:${r.name}`}
                      onTap={() => { setSelected(r); setGrams('100'); }}
                      onQuickAdd={() => quickAddSearchResult(r)}
                      quickAddIcon={<Plus size={13} />}
                    />
                  ))}
                </div>
              ) : (
                <>
                  {/* AI + Manual shortcuts */}
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => { setNlMode(true); setError(null); }}
                      className="flex-1 rounded-xl border border-primary/30 bg-primary/[0.06] py-2 text-[10px] font-black text-primary hover:bg-primary/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles size={12} /> Opisz słowami
                    </button>
                    <button
                      onClick={() => { setManualMode(true); setError(null); }}
                      className="flex-1 rounded-xl border border-border-custom py-2 text-[10px] font-bold text-text-muted hover:text-text-primary transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <PenLine size={12} /> Wpisz ręcznie
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1.5 mb-3">
                    {(['favorites', 'recent'] as const).map((tab) => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === tab ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'}`}>
                        {tab === 'favorites' ? 'Częste' : 'Ostatnie'}
                      </button>
                    ))}
                  </div>

                  {loadingList ? (
                    <div className="flex justify-center py-6"><Loader2 size={16} className="text-text-muted animate-spin" /></div>
                  ) : activeTab === 'favorites' ? (
                    favorites.length === 0
                      ? <p className="text-[12px] text-text-muted py-4 text-center">Brak częstych — zacznij od wyszukania produktu</p>
                      : <div className="space-y-1.5">
                          {favorites.map((f) => (
                            <FoodRow key={f.id} name={f.name}
                              subtitle={[f.brand, `${f.default_grams} g`].filter(Boolean).join(' · ')}
                              calories={scale(f.calories, f.default_grams)}
                              loading={quickAddingId === f.id}
                              onTap={() => { setSelected(f); setGrams(String(f.default_grams)); }}
                              onQuickAdd={() => quickAddFavorite(f)}
                              quickAddIcon={<Plus size={13} />}
                            />
                          ))}
                        </div>
                  ) : recent.length === 0
                    ? <p className="text-[12px] text-text-muted py-4 text-center">Brak ostatnich wpisów</p>
                    : <div className="space-y-3">
                        {Object.entries(recent.reduce<Record<string, RecentEntry[]>>((acc, r) => { (acc[r.date] ||= []).push(r); return acc; }, {}))
                          .map(([date, entries]) => (
                            <div key={date}>
                              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1.5">{dayLabel(date, todayStr, yesterdayStr)}</p>
                              <div className="space-y-1.5">
                                {entries.map((e) => (
                                  <FoodRow key={e.id} name={e.name}
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
                  }
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function BarcodeScanner({ onDetected, onClose, loading }: { onDetected: (code: string) => void; onClose: () => void; loading: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const detectorSupported = typeof window !== 'undefined' && !!window.BarcodeDetector;

  useEffect(() => {
    if (!detectorSupported) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    let rafId: number;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        const detector = new window.BarcodeDetector!({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try { const codes = await detector.detect(videoRef.current); if (codes.length > 0) { onDetected(codes[0].rawValue); return; } } catch { /* ignore mid-frame decode errors */ }
          rafId = requestAnimationFrame(() => { scan(); });
        };
        scan();
      } catch (err) {
        console.error('[BarcodeScanner] camera failed', err);
        setCameraError('Brak dostępu do kamery — wpisz kod ręcznie');
      }
    })();
    return () => { stopped = true; if (rafId) cancelAnimationFrame(rafId); stream?.getTracks().forEach((t) => t.stop()); };
  }, [detectorSupported, onDetected]);

  return (
    <div className="space-y-3">
      <button onClick={onClose} className="text-[11px] font-bold text-text-muted hover:text-text-primary cursor-pointer">← Wstecz</button>
      {detectorSupported && !cameraError ? (
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
          <div className="absolute inset-8 border-2 border-primary/70 rounded-xl pointer-events-none" />
          {loading && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Loader2 size={24} className="text-white animate-spin" /></div>}
        </div>
      ) : (
        <p className="text-[11px] text-text-muted text-center py-2">{cameraError || 'Skaner kamery niedostępny — wpisz kod ręcznie'}</p>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Keyboard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={manualCode} onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && manualCode.trim()) onDetected(manualCode.trim()); }}
            inputMode="numeric" placeholder="Wpisz kod kreskowy..."
            className="w-full rounded-xl border border-border-custom bg-surface-solid/40 pl-9 pr-2 py-2.5 text-[13px] text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40" />
        </div>
        <button onClick={() => manualCode.trim() && onDetected(manualCode.trim())} disabled={!manualCode.trim() || loading}
          className="rounded-xl bg-primary px-4 py-2.5 text-[12px] font-black text-white disabled:opacity-40 cursor-pointer">Szukaj</button>
      </div>
    </div>
  );
}

function FoodRow({ name, subtitle, calories, loading, onTap, onQuickAdd, quickAddIcon }: {
  name: string; subtitle?: string | null; calories: number | null;
  loading?: boolean; onTap: () => void; onQuickAdd: () => void; quickAddIcon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border-custom bg-surface-solid/30 px-3 py-2 hover:bg-surface-solid/60 transition-all">
      <button onClick={onTap} className="flex-1 min-w-0 text-left cursor-pointer">
        <p className="text-[13px] font-bold text-text-primary truncate">{name}</p>
        {subtitle && <p className="text-[10px] text-text-muted truncate">{subtitle}</p>}
      </button>
      <span className="text-[11px] font-black text-primary shrink-0">{calories ?? '?'} kcal</span>
      <button onClick={onQuickAdd} disabled={loading}
        className="shrink-0 rounded-full bg-primary p-1.5 text-white active:scale-90 transition-all cursor-pointer disabled:opacity-50">
        {loading ? <Loader2 size={13} className="animate-spin" /> : quickAddIcon}
      </button>
    </div>
  );
}
