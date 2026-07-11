import { Search, Loader2, ScanLine, Plus, RotateCcw, Sparkles, X } from 'lucide-react';
import FoodRow from '../FoodRow';
import BarcodeScanner from '../BarcodeScanner';
import { scale, dayLabel, type Favorite, type RecentEntry, type FoodBase } from '../hooks/useFoodEntryData';

interface BrowseScreenProps {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  setQuery: (v: string) => void;
  searching: boolean;
  searchResults: FoodBase[];
  scannerOpen: boolean;
  setScannerOpen: (v: boolean) => void;
  scanLookingUp: boolean;
  lookupBarcode: (barcode: string) => void;
  setError: (v: string | null) => void;
  setNlMode: (v: boolean) => void;
  setNlText: (v: string) => void;
  setSelected: (v: FoodBase | null) => void;
  setGrams: (v: string) => void;
  quickAddingId: string | null;
  quickAddSearchResult: (r: FoodBase) => void;
  activeTab: 'favorites' | 'recent';
  setActiveTab: (tab: 'favorites' | 'recent') => void;
  loadingList: boolean;
  favorites: Favorite[];
  quickAddFavorite: (f: Favorite) => void;
  recent: RecentEntry[];
  openEditEntry: (e: RecentEntry) => void;
  quickRepeatEntry: (e: RecentEntry) => void;
  todayStr: string;
  yesterdayStr: string;
  error: string | null;
}

export default function BrowseScreen({
  searchInputRef, query, setQuery, searching, searchResults,
  scannerOpen, setScannerOpen, scanLookingUp, lookupBarcode,
  setError, setNlMode, setNlText, setSelected, setGrams,
  quickAddingId, quickAddSearchResult,
  activeTab, setActiveTab, loadingList,
  favorites, quickAddFavorite,
  recent, openEditEntry, quickRepeatEntry,
  todayStr, yesterdayStr, error,
}: BrowseScreenProps) {
  return (
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
  );
}
