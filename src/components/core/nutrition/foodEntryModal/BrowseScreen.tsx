import { Plus, RotateCcw, ScanLine, Search, Sparkles, X } from 'lucide-react';
import { ControlInput, Pressable } from '../../../ui/ControlPrimitives';
import Spinner from '../../../ui/Spinner';
import BarcodeScanner from '../BarcodeScanner';
import FoodRow from '../FoodRow';
import NutritionLabelScanner from '../NutritionLabelScanner';
import type { Favorite, FoodBase, RecentEntry } from '../hooks/useFoodEntryData';
import { dayLabel, scale } from '../hooks/useFoodEntryData';
import FoodSearchResults from './FoodSearchResults';

interface BrowseScreenProps {
  userId?: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  setQuery: (value: string) => void;
  searching: boolean;
  searchResults: FoodBase[];
  externalSearching: boolean;
  externalSearched: boolean;
  searchExternal: () => void;
  scannerOpen: boolean;
  setScannerOpen: (value: boolean) => void;
  scanLookingUp: boolean;
  lookupBarcode: (barcode: string) => void;
  setError: (value: string | null) => void;
  setNlMode: (value: boolean) => void;
  setNlText: (value: string) => void;
  setSelected: (value: FoodBase | null) => void;
  setGrams: (value: string) => void;
  quickAddingId: string | null;
  quickAddSearchResult: (food: FoodBase) => void;
  activeTab: 'favorites' | 'recent';
  setActiveTab: (tab: 'favorites' | 'recent') => void;
  loadingList: boolean;
  favorites: Favorite[];
  quickAddFavorite: (favorite: Favorite) => void;
  recent: RecentEntry[];
  openEditEntry: (entry: RecentEntry) => void;
  quickRepeatEntry: (entry: RecentEntry) => void;
  todayStr: string;
  yesterdayStr: string;
  error: string | null;
}

export default function BrowseScreen(props: BrowseScreenProps) {
  const { userId, searchInputRef, query, setQuery, searching, searchResults,
    externalSearching, externalSearched, searchExternal, scannerOpen, setScannerOpen,
    scanLookingUp, lookupBarcode, setError, setNlMode, setNlText, setSelected, setGrams,
    quickAddingId, quickAddSearchResult, activeTab, setActiveTab, loadingList, favorites,
    quickAddFavorite, recent, openEditEntry, quickRepeatEntry, todayStr, yesterdayStr, error } = props;

  const openNaturalLanguage = (value = '') => {
    setNlMode(true); setNlText(value); setQuery(''); setError(null);
  };

  return (
    <>
      <div className="group mb-3.5 flex items-center gap-1 rounded-2xl border border-border-custom bg-surface-solid/40 px-1 shadow-sm transition-all focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary" />
          <ControlInput ref={searchInputRef} autoFocus value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj w swojej bibliotece..."
            className="w-full bg-transparent py-3 pl-10 pr-2 text-base font-medium outline-none placeholder:font-normal placeholder:text-text-muted/45" />
        </div>
        {query && !searching && (
          <Pressable variant="ghost" size="sm" onClick={() => { setQuery(''); searchInputRef.current?.focus(); }}
            className="shrink-0 rounded-full p-1.5" title="Wyczyść"><X size={15} /></Pressable>
        )}
        {searching ? <Spinner size="sm" className="mx-1.5 shrink-0" /> : (
          <Pressable variant="ghost" size="sm" onClick={() => { setError(null); setScannerOpen(true); }}
            className="shrink-0 rounded-full p-2" title="Skanuj kod"><ScanLine size={15} /></Pressable>
        )}
      </div>

      {error && <p className="mb-3 text-xs text-danger">{error}</p>}
      {!scannerOpen && (
        <div className="mb-3.5">
          <NutritionLabelScanner userId={userId} onError={(message) => setError(message || null)}
            onScanned={(food) => { setSelected(food); setGrams(String(food.defaultGrams ?? 100)); }} />
        </div>
      )}

      {scannerOpen ? (
        <BarcodeScanner onDetected={lookupBarcode} onClose={() => setScannerOpen(false)} loading={scanLookingUp} />
      ) : query.trim().length >= 2 ? (
        <FoodSearchResults query={query} searching={searching} searchResults={searchResults}
          externalSearching={externalSearching} externalSearched={externalSearched} searchExternal={searchExternal}
          quickAddingId={quickAddingId} setSelected={setSelected} setGrams={setGrams}
          quickAddSearchResult={quickAddSearchResult} openNaturalLanguage={openNaturalLanguage} />
      ) : (
        <DefaultLists activeTab={activeTab} setActiveTab={setActiveTab} loading={loadingList}
          favorites={favorites} recent={recent} quickAddingId={quickAddingId} setSelected={setSelected}
          setGrams={setGrams} quickAddFavorite={quickAddFavorite} openEditEntry={openEditEntry}
          quickRepeatEntry={quickRepeatEntry} todayStr={todayStr} yesterdayStr={yesterdayStr}
          openNaturalLanguage={() => openNaturalLanguage()} />
      )}
    </>
  );
}

function DefaultLists(props: Pick<BrowseScreenProps, 'activeTab' | 'setActiveTab' | 'favorites' | 'recent' |
  'quickAddingId' | 'setSelected' | 'setGrams' | 'quickAddFavorite' | 'openEditEntry' |
  'quickRepeatEntry' | 'todayStr' | 'yesterdayStr'> & { loading: boolean; openNaturalLanguage: () => void }) {
  return (
    <>
      <Pressable variant="tonal" onClick={props.openNaturalLanguage} icon={<Sparkles size={14} />} className="mb-3.5 w-full">
        Opisz posiłek słowami
      </Pressable>
      <div className="mb-3.5 flex gap-0.5 rounded-full bg-surface-solid/50 p-1">
        {(['favorites', 'recent'] as const).map((tab) => (
          <Pressable key={tab} onClick={() => props.setActiveTab(tab)}
            className={`flex-1 rounded-full py-2 text-xs font-black uppercase tracking-wider ${props.activeTab === tab ? 'bg-primary text-on-accent shadow-sm' : 'text-text-muted'}`}>
            {tab === 'favorites' ? 'Częste' : 'Ostatnie'}
          </Pressable>
        ))}
      </div>
      {props.loading ? <div className="py-6"><Spinner size="sm" className="mx-auto" /></div>
        : props.activeTab === 'favorites' ? <FavoriteRows {...props} /> : <RecentRows {...props} />}
    </>
  );
}

function FavoriteRows(props: Pick<BrowseScreenProps, 'favorites' | 'quickAddingId' | 'setSelected' | 'setGrams' | 'quickAddFavorite'>) {
  if (!props.favorites.length) return <p className="py-4 text-center text-sm text-text-muted">Brak częstych — zacznij od wyszukania produktu</p>;
  return <div className="space-y-1.5">{props.favorites.map((food) => (
    <FoodRow key={food.id} name={food.name} subtitle={[food.brand, `${food.default_grams} g`].filter(Boolean).join(' · ')}
      calories={scale(food.calories, food.default_grams)} loading={props.quickAddingId === food.id}
      onTap={() => { props.setSelected(food); props.setGrams(String(food.default_grams)); }}
      onQuickAdd={() => props.quickAddFavorite(food)} quickAddIcon={<Plus size={13} />} />
  ))}</div>;
}

function RecentRows(props: Pick<BrowseScreenProps, 'recent' | 'quickAddingId' | 'openEditEntry' | 'quickRepeatEntry' | 'todayStr' | 'yesterdayStr'>) {
  if (!props.recent.length) return <p className="py-4 text-center text-sm text-text-muted">Brak ostatnich wpisów</p>;
  const grouped = props.recent.reduce<Record<string, RecentEntry[]>>((map, entry) => { (map[entry.date] ||= []).push(entry); return map; }, {});
  return <div className="space-y-3">{Object.entries(grouped).map(([date, entries]) => (
    <div key={date}>
      <p className="mb-1.5 text-2xs font-black uppercase tracking-widest text-text-muted">{dayLabel(date, props.todayStr, props.yesterdayStr)}</p>
      <div className="space-y-1.5">{entries.map((entry) => (
        <FoodRow key={entry.id} name={entry.name} subtitle={[entry.brand, entry.amount].filter(Boolean).join(' · ')}
          calories={entry.calories} loading={props.quickAddingId === entry.id} onTap={() => props.openEditEntry(entry)}
          onQuickAdd={() => props.quickRepeatEntry(entry)} quickAddIcon={<RotateCcw size={13} />} />
      ))}</div>
    </div>
  ))}</div>;
}
