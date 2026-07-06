import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Loader2, ScanLine, Plus, ChevronDown, RotateCcw, Sparkles, Trash2, Check } from 'lucide-react';
import { confidenceLabel } from '../../../lib/foodLogging';
import BarcodeScanner from './BarcodeScanner';
import FoodRow from './FoodRow';
import { Session } from '@supabase/supabase-js';
import {
  useFoodEntryData,
  parseGrams,
  scale,
  dayLabel,
  type RecentEntry,
} from './useFoodEntryData';

export interface FoodEntryModalProps {
  session: Session;
  onClose: () => void;
  onSaved?: () => void;
  initialEditEntry?: RecentEntry;
  initialMealType?: string;
}

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Śniadanie' },
  { id: 'lunch', label: 'Obiad' },
  { id: 'dinner', label: 'Kolacja' },
  { id: 'snack', label: 'Przekąska' },
];

export default function FoodEntryModal({ session, onClose, onSaved, initialEditEntry, initialMealType }: FoodEntryModalProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const {
    activeTab, setActiveTab,
    favorites,
    recent,
    loadingList,
    query, setQuery,
    searchResults,
    searching,
    selected, setSelected,
    grams, setGrams,
    mealType, setMealType,
    saving,
    quickAddingId,
    savedFlash,
    error, setError,
    scannerOpen, setScannerOpen,
    scanLookingUp,
    editingEntry, setEditingEntry,
    editGrams, setEditGrams,
    editMealType, setEditMealType,
    editSaving,
    editDeleting,
    todayTotals,
    targets,
    nlMode, setNlMode,
    nlText, setNlText,
    nlParsing,
    nlItems,
    nlSaving,
    nlRemovedIdx, setNlRemovedIdx,
    preview,
    editPreview,
    openEditEntry,
    save,
    quickAddSearchResult,
    quickAddFavorite,
    quickRepeatEntry,
    parseNL,
    saveNLItems,
    saveEntryEdit,
    deleteEntry,
    todayStr,
    yesterdayStr,
    lookupBarcode
  } = useFoodEntryData({ session, onClose, onSaved, initialEditEntry, initialMealType, searchInputRef });

  // Keep the bottom sheet above the virtual keyboard on mobile
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const el = sheetRef.current;
      if (!el) return;
      const offsetBottom = Math.max(0, window.innerHeight - vv.offsetTop - vv.height);
      el.style.marginBottom = `${offsetBottom}px`;
      el.style.maxHeight = `${Math.floor(vv.height * 0.94)}px`;
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);

  // Escape key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (editingEntry) { setEditingEntry(null); return; }
      if (nlMode) { setNlMode(false); return; }
      if (selected) { setSelected(null); return; }
      onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editingEntry, nlMode, selected, onClose, setEditingEntry, setNlMode, setSelected]);

  const screen = editingEntry
    ? 'edit'
    : nlMode
    ? 'nl'
    : selected
    ? 'portion'
    : 'browse';

  const nlActiveCount = nlItems ? nlItems.filter((_, i) => !nlRemovedIdx.has(i)).length : 0;

  const headerTitle =
    screen === 'edit' ? 'Edytuj wpis'
    : screen === 'nl' ? 'Opisz posiłek'
    : screen === 'portion' ? 'Ile zjadłeś?'
    : savedFlash ? '✓ Dodano!' : 'Dodaj posiłek';

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className="w-full max-w-sm rounded-t-[28px] border border-border-custom bg-surface shadow-2xl overflow-hidden animate-fadeIn max-h-[94dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >

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

        {/* Running total */}
        {todayTotals && (
          <div className="px-5 py-2.5 border-b border-border-custom/60 bg-surface-solid/20 shrink-0">
            <div className="flex items-center justify-between text-[10px] font-bold text-text-muted mb-1.5">
              <span>
                <span className="text-text-primary">{todayTotals.calories}</span>
                {targets?.target_kcal ? ` / ${targets.target_kcal}` : ''} kcal dziś
              </span>
              {targets?.protein_floor_g != null && (
                <span>
                  <span className="text-text-primary">{Math.round(todayTotals.protein)}</span> / {targets.protein_floor_g} g B
                </span>
              )}
            </div>
            {targets?.target_kcal ? (
              <div className="h-1 rounded-full bg-border-custom overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${todayTotals.calories > targets.target_kcal ? 'bg-amber-500' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, (todayTotals.calories / targets.target_kcal) * 100)}%` }}
                />
              </div>
            ) : null}
          </div>
        )}

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
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="number" inputMode="numeric" autoFocus
                    value={editGrams}
                    onChange={(e) => setEditGrams(e.target.value)}
                    className="w-24 rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-[14px] font-bold text-text-primary text-center outline-none focus:border-primary/40"
                  />
                  <span className="text-[12px] text-text-muted">gram</span>
                </div>
                <div className="flex gap-1.5">
                  {[50, 100, 150, 200, 250].map((g) => (
                    <button key={g} onClick={() => setEditGrams(String(g))}
                      className={`flex-1 rounded-lg py-1 text-[10px] font-black transition-all cursor-pointer ${
                        editGrams === String(g)
                          ? 'bg-primary text-white'
                          : 'border border-border-custom text-text-muted hover:border-primary/40 hover:text-primary'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
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
                  {(
                    [
                      ['kcal', editPreview.calories],
                      ['B', editPreview.protein],
                      ['W', editPreview.carbs],
                      ['T', editPreview.fat],
                    ] as [string, number | null][]
                  ).map(([label, val]) => (
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
              <button onClick={() => { setNlMode(false); setError(null); }}
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
                  onChange={(e) => { setNlText(e.target.value); }}
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
                          <p className="text-[9px] text-text-muted flex items-center gap-1.5">
                            <span>{item.grams}g</span>
                            {confidenceLabel(item) && (
                              <span className={`rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
                                item.confidence === 'low' ? 'bg-amber-500/15 text-amber-400' :
                                item.source === 'library' || item.source === 'database' ? 'bg-emerald-500/15 text-emerald-400' :
                                'bg-primary/10 text-primary/80'
                              }`}>
                                {confidenceLabel(item)}
                              </span>
                            )}
                          </p>
                          {item.assumptions?.length ? (
                            <p className="text-[9px] text-amber-600/90 mt-0.5 leading-snug">{item.assumptions.join(' · ')}</p>
                          ) : null}
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

          {/* ── Portion selector ──────────────────────────────────── */}
          {screen === 'portion' && selected && (
            <div className="space-y-4">
              <button onClick={() => setSelected(null)} className="text-[11px] font-bold text-text-muted hover:text-text-primary cursor-pointer">← Wstecz</button>
              <div>
                <p className="text-[15px] font-black text-text-primary leading-tight">{selected.name}</p>
                {selected.brand && <p className="text-[11px] text-text-muted">{selected.brand}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="numeric" autoFocus value={grams} onChange={(e) => setGrams(e.target.value)}
                    className="w-20 rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-[14px] font-bold text-text-primary text-center outline-none focus:border-primary/40" />
                  <span className="text-[12px] text-text-muted">gram</span>
                </div>
                <div className="flex gap-1.5">
                  {[50, 100, 150, 200, 250].map((g) => (
                    <button key={g} onClick={() => setGrams(String(g))}
                      className={`flex-1 rounded-lg py-1 text-[10px] font-black transition-all cursor-pointer ${
                        grams === String(g)
                          ? 'bg-primary text-white'
                          : 'border border-border-custom text-text-muted hover:border-primary/40 hover:text-primary'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
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
              <div className="group flex items-center gap-1 mb-3.5 rounded-2xl border border-border-custom bg-surface-solid/40 pl-1 pr-1.5 shadow-sm transition-all focus-within:border-primary/40 focus-within:bg-surface-solid/70 focus-within:ring-4 focus-within:ring-primary/10">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-primary" />
                  <input
                    ref={searchInputRef}
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Szukaj produktu..."
                    className="w-full bg-transparent pl-10 pr-2 py-3 text-[14px] font-medium text-text-primary outline-none placeholder:text-text-muted/45 placeholder:font-normal"
                  />
                </div>
                {query && !searching && (
                  <button
                    onClick={() => { setQuery(''); searchInputRef.current?.focus(); }}
                    className="shrink-0 rounded-full p-1.5 text-text-muted hover:text-text-primary hover:bg-text-primary/5 transition-all cursor-pointer"
                    title="Wyczyść"
                  >
                    <X size={14} />
                  </button>
                )}
                {searching ? (
                  <Loader2 size={15} className="shrink-0 text-primary animate-spin mx-1.5" />
                ) : (
                  <button onClick={() => { setError(null); setScannerOpen(true); }}
                    className="shrink-0 rounded-full p-2 text-text-muted hover:text-primary hover:bg-primary/10 transition-all cursor-pointer" title="Skanuj kod">
                    <ScanLine size={16} />
                  </button>
                )}
              </div>

              {error && <p className="mb-3 text-[11px] text-rose-500">{error}</p>}

              {scannerOpen ? (
                <BarcodeScanner onDetected={lookupBarcode} onClose={() => setScannerOpen(false)} loading={scanLookingUp} />
              ) : query.trim().length >= 2 ? (
                /* Search results */
                <div className="space-y-1.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-text-muted mb-2">
                    Wyniki — ✚ dodaje w sugerowanej porcji, nazwa otwiera porcję
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
                  {searchResults.map((r, i) => {
                    const portionGrams = r.defaultGrams ?? 100;
                    const portionKcal = r.calories != null ? Math.round(r.calories * portionGrams / 100) : null;
                    return (
                      <FoodRow
                        key={`${r.barcode || r.name}-${i}`}
                        name={r.name}
                        subtitle={[r.brand, `${portionGrams}g/ml`].filter(Boolean).join(' · ')}
                        calories={portionKcal}
                        loading={quickAddingId === `srch:${r.name}`}
                        onTap={() => { setSelected(r); setGrams(String(portionGrams)); }}
                        onQuickAdd={() => quickAddSearchResult(r)}
                        quickAddIcon={<Plus size={13} />}
                      />
                    );
                  })}
                </div>
              ) : (
                <>
                  {/* AI shortcut */}
                  <button
                    onClick={() => { setNlMode(true); setError(null); }}
                    className="w-full mb-3.5 rounded-2xl border border-primary/25 bg-primary/[0.07] py-3 text-[12px] font-black text-primary hover:bg-primary/[0.12] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Sparkles size={14} /> Opisz posiłek słowami
                  </button>

                  {/* Tabs — segmented control */}
                  <div className="flex gap-0.5 mb-3.5 rounded-full bg-surface-solid/50 p-1">
                    {(['favorites', 'recent'] as const).map((tab) => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`flex-1 rounded-full py-2 text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                          activeTab === tab
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-text-muted hover:text-text-primary'
                        }`}>
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
                                    onTap={() => openEditEntry(e)}
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
