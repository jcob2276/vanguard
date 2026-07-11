import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { ParsedFoodItem } from '../../../../lib/health/foodLogging';
import type { Favorite, RecentEntry, FoodBase } from '../hooks/useFoodEntryData';
import EditScreen from './EditScreen';
import NLScreen from './NLScreen';
import PortionScreen from './PortionScreen';
import BrowseScreen from './BrowseScreen';

interface FoodEntryContentProps {
  screen: string;
  editingEntry: RecentEntry | null;
  setEditingEntry: (v: RecentEntry | null) => void;
  editGrams: string;
  setEditGrams: (v: string) => void;
  editMealType: string;
  setEditMealType: (v: string) => void;
  editPreview: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null } | null;
  editSaving: boolean;
  editDeleting: boolean;
  saveEntryEdit: () => void;
  deleteEntry: () => void;
  setNlMode: (v: boolean) => void;
  setError: (v: string | null) => void;
  mealType: string;
  setMealType: (v: string) => void;
  nlText: string;
  setNlText: (v: string) => void;
  parseNL: () => void;
  nlParsing: boolean;
  error: string | null;
  nlItems: ParsedFoodItem[] | null;
  nlRemovedIdx: Set<number>;
  setNlRemovedIdx: Dispatch<SetStateAction<Set<number>>>;
  nlSaving: boolean;
  saveNLItems: () => void;
  selected: FoodBase | null;
  setSelected: (v: FoodBase | null) => void;
  grams: string;
  setGrams: (v: string) => void;
  preview: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null } | null;
  saving: boolean;
  savedFlash: boolean;
  save: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  query: string;
  setQuery: (v: string) => void;
  searching: boolean;
  searchResults: FoodBase[];
  scannerOpen: boolean;
  setScannerOpen: (v: boolean) => void;
  scanLookingUp: boolean;
  lookupBarcode: (barcode: string) => void;
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
}

export default function FoodEntryContent(props: FoodEntryContentProps) {
  const {
    screen, editingEntry, selected,
    // edit
    setEditingEntry, editGrams, setEditGrams, editMealType, setEditMealType,
    editPreview, error, editSaving, editDeleting, saveEntryEdit, deleteEntry,
    // nl
    setNlMode, setError, mealType, setMealType, nlText, setNlText,
    parseNL, nlParsing, nlItems, nlRemovedIdx, setNlRemovedIdx,
    nlSaving, saveNLItems,
    // portion
    setSelected, grams, setGrams, preview, saving, savedFlash, save,
    // browse
    searchInputRef, query, setQuery, searching, searchResults,
    scannerOpen, setScannerOpen, scanLookingUp, lookupBarcode,
    quickAddingId, quickAddSearchResult, activeTab, setActiveTab,
    loadingList, favorites, quickAddFavorite, recent,
    openEditEntry, quickRepeatEntry, todayStr, yesterdayStr,
  } = props;

  return (
    <div className="p-4 overflow-y-auto flex-1">
      {screen === 'edit' && editingEntry && (
        <EditScreen
          editingEntry={editingEntry}
          setEditingEntry={setEditingEntry}
          editGrams={editGrams}
          setEditGrams={setEditGrams}
          editMealType={editMealType}
          setEditMealType={setEditMealType}
          editPreview={editPreview}
          error={error}
          editSaving={editSaving}
          editDeleting={editDeleting}
          saveEntryEdit={saveEntryEdit}
          deleteEntry={deleteEntry}
        />
      )}

      {screen === 'nl' && (
        <NLScreen
          setNlMode={setNlMode}
          setError={setError}
          mealType={mealType}
          setMealType={setMealType}
          nlText={nlText}
          setNlText={setNlText}
          parseNL={parseNL}
          nlParsing={nlParsing}
          error={error}
          nlItems={nlItems}
          nlRemovedIdx={nlRemovedIdx}
          setNlRemovedIdx={setNlRemovedIdx}
          nlSaving={nlSaving}
          saveNLItems={saveNLItems}
        />
      )}

      {screen === 'portion' && selected && (
        <PortionScreen
          selected={selected}
          setSelected={setSelected}
          grams={grams}
          setGrams={setGrams}
          mealType={mealType}
          setMealType={setMealType}
          preview={preview}
          error={error}
          saving={saving}
          savedFlash={savedFlash}
          save={save}
        />
      )}

      {screen === 'browse' && (
        <BrowseScreen
          searchInputRef={searchInputRef}
          query={query}
          setQuery={setQuery}
          searching={searching}
          searchResults={searchResults}
          scannerOpen={scannerOpen}
          setScannerOpen={setScannerOpen}
          scanLookingUp={scanLookingUp}
          lookupBarcode={lookupBarcode}
          setError={setError}
          setNlMode={setNlMode}
          setNlText={setNlText}
          setSelected={setSelected}
          setGrams={setGrams}
          quickAddingId={quickAddingId}
          quickAddSearchResult={quickAddSearchResult}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          loadingList={loadingList}
          favorites={favorites}
          quickAddFavorite={quickAddFavorite}
          recent={recent}
          openEditEntry={openEditEntry}
          quickRepeatEntry={quickRepeatEntry}
          todayStr={todayStr}
          yesterdayStr={yesterdayStr}
          error={error}
        />
      )}
    </div>
  );
}
