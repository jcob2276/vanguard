import { Search, ScanLine, Plus, RotateCcw, Sparkles, X } from 'lucide-react';
import Button from '../../../ui/Button';
import Spinner from '../../../ui/Spinner';
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
            className="w-full bg-transparent pl-10 pr-2 py-3 text-base font-medium text-text-primary outline-none placeholder:text-text-muted/45 placeholder:font-normal"
          />
        </div>
        {query && !searching && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setQuery(''); searchInputRef.current?.focus(); }}
            className="shrink-0 rounded-full p-1.5"
            title="Wyczyść"
          >
            <X size={14} />
          </Button>
        )}
        {searching ? (
          <Spinner size="sm" className="shrink-0 mx-1.5" />
        ) : (
          <Button variant="ghost" size="sm" onClick={() => { setError(null); setScannerOpen(true); }} className="shrink-0 rounded-full p-2" title="Skanuj kod">
            <ScanLine size={16} />
          </Button>
        )}
      </div>

      {error && <p className="mb-3 text-xs text-danger">{error}</p>}

      {scannerOpen ? (
        <BarcodeScanner onDetected={lookupBarcode} onClose={() => setScannerOpen(false)} loading={scanLookingUp} />
      ) : query.trim().length >= 2 ? (
        <SearchResultsList
          query={query}
          searching={searching}
          searchResults={searchResults}
          quickAddingId={quickAddingId}
          setSelected={setSelected}
          setGrams={setGrams}
          quickAddSearchResult={quickAddSearchResult}
          setNlMode={setNlMode}
          setNlText={setNlText}
          setQuery={setQuery}
          setError={setError}
        />
      ) : (
        <>
          {/* AI shortcut */}
          <Button
            variant="tonal"
            onClick={() => { setNlMode(true); setError(null); }}
            icon={<Sparkles size={14} />}
            className="w-full mb-3.5"
          >
            Opisz posiłek słowami
          </Button>
          {/* Tabs — segmented control */}
          <div className="flex gap-0.5 mb-3.5 rounded-full bg-surface-solid/50 p-1">
            {(['favorites', 'recent'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-full py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}>
                {tab === 'favorites' ? 'Częste' : 'Ostatnie'}
              </button>
            ))}
          </div>
          {loadingList ? (
            <div className="flex justify-center py-6"><Spinner size="sm" className="mx-auto" /></div>
          ) : activeTab === 'favorites' ? (
            <FavoritesList
              favorites={favorites}
              quickAddingId={quickAddingId}
              setSelected={setSelected}
              setGrams={setGrams}
              quickAddFavorite={quickAddFavorite}
            />
          ) : (
            <RecentList
              recent={recent}
              quickAddingId={quickAddingId}
              openEditEntry={openEditEntry}
              quickRepeatEntry={quickRepeatEntry}
              todayStr={todayStr}
              yesterdayStr={yesterdayStr}
            />
          )}
        </>
      )}
    </>
  );
}

// ══════════════════════════════════════════════
// Local Subcomponents to keep BrowseScreen short
// ══════════════════════════════════════════════

interface SearchResultsListProps {
  query: string;
  searching: boolean;
  searchResults: FoodBase[];
  quickAddingId: string | null;
  setSelected: (v: FoodBase | null) => void;
  setGrams: (v: string) => void;
  quickAddSearchResult: (r: FoodBase) => void;
  setNlMode: (v: boolean) => void;
  setNlText: (v: string) => void;
  setQuery: (v: string) => void;
  setError: (v: string | null) => void;
}

function SearchResultsList({
  query,
  searching,
  searchResults,
  quickAddingId,
  setSelected,
  setGrams,
  quickAddSearchResult,
  setNlMode,
  setNlText,
  setQuery,
  setError,
}: SearchResultsListProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-2xs font-black uppercase tracking-wider text-text-muted mb-2">
        Wyniki — ✚ dodaje w sugerowanej porcji, nazwa otwiera porcję
      </p>
      {searchResults.length === 0 && !searching && (
        <div className="py-4 text-center space-y-3">
          <p className="text-sm text-text-muted">Brak wyników dla &quot;{query}&quot;</p>
          <Button
            variant="tonal"
            size="sm"
            onClick={() => { setNlMode(true); setNlText(query); setQuery(''); setError(null); }}
            icon={<Sparkles size={13} />}
            className="inline-flex"
          >
            Opisz posiłek słowami
          </Button>
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
  );
}

interface FavoritesListProps {
  favorites: Favorite[];
  quickAddingId: string | null;
  setSelected: (v: FoodBase | null) => void;
  setGrams: (v: string) => void;
  quickAddFavorite: (f: Favorite) => void;
}

function FavoritesList({
  favorites,
  quickAddingId,
  setSelected,
  setGrams,
  quickAddFavorite,
}: FavoritesListProps) {
  if (favorites.length === 0) {
    return <p className="text-sm text-text-muted py-4 text-center">Brak częstych — zacznij od wyszukania produktu</p>;
  }
  return (
    <div className="space-y-1.5">
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
  );
}

interface RecentListProps {
  recent: RecentEntry[];
  quickAddingId: string | null;
  openEditEntry: (e: RecentEntry) => void;
  quickRepeatEntry: (e: RecentEntry) => void;
  todayStr: string;
  yesterdayStr: string;
}

function RecentList({
  recent,
  quickAddingId,
  openEditEntry,
  quickRepeatEntry,
  todayStr,
  yesterdayStr,
}: RecentListProps) {
  if (recent.length === 0) {
    return <p className="text-sm text-text-muted py-4 text-center">Brak ostatnich wpisów</p>;
  }
  const grouped = recent.reduce<Record<string, RecentEntry[]>>((acc, r) => { (acc[r.date] ||= []).push(r); return acc; }, {});
  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([date, entries]) => (
        <div key={date}>
          <p className="text-2xs font-black uppercase tracking-widest text-text-muted mb-1.5">{dayLabel(date, todayStr, yesterdayStr)}</p>
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
  );
}
