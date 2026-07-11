import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Session } from '@supabase/supabase-js';
import {
  useFoodEntryData,
  type RecentEntry,
} from './hooks/useFoodEntryData';
import FoodEntryHeader from './foodEntryModal/FoodEntryHeader';
import FoodEntryContent from './foodEntryModal/FoodEntryContent';

export interface FoodEntryModalProps {
  session: Session;
  onClose: () => void;
  onSaved?: () => void;
  initialEditEntry?: RecentEntry;
  initialMealType?: string;
}

export default function FoodEntryModal({ session, onClose, onSaved, initialEditEntry, initialMealType }: FoodEntryModalProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const {
    activeTab, setActiveTab, favorites, recent, loadingList,
    query, setQuery, searchResults, searching,
    selected, setSelected, grams, setGrams,
    mealType, setMealType, saving, quickAddingId, savedFlash,
    error, setError, scannerOpen, setScannerOpen, scanLookingUp,
    editingEntry, setEditingEntry, editGrams, setEditGrams,
    editMealType, setEditMealType, editSaving, editDeleting,
    todayTotals, targets,
    nlMode, setNlMode, nlText, setNlText, nlParsing, nlItems,
    nlSaving, nlRemovedIdx, setNlRemovedIdx, preview, editPreview,
    openEditEntry, save, quickAddSearchResult, quickAddFavorite,
    quickRepeatEntry, parseNL, saveNLItems, saveEntryEdit, deleteEntry,
    todayStr, yesterdayStr, lookupBarcode,
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

        <FoodEntryHeader
          headerTitle={headerTitle}
          screen={screen}
          savedFlash={savedFlash}
          mealType={mealType}
          setMealType={setMealType}
          onClose={onClose}
          todayTotals={todayTotals}
          targets={targets}
        />

        <FoodEntryContent
          screen={screen}
          editingEntry={editingEntry}
          setEditingEntry={setEditingEntry}
          editGrams={editGrams}
          setEditGrams={setEditGrams}
          editMealType={editMealType}
          setEditMealType={setEditMealType}
          editPreview={editPreview}
          editSaving={editSaving}
          editDeleting={editDeleting}
          saveEntryEdit={saveEntryEdit}
          deleteEntry={deleteEntry}
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
          selected={selected}
          setSelected={setSelected}
          grams={grams}
          setGrams={setGrams}
          preview={preview}
          saving={saving}
          savedFlash={savedFlash}
          save={save}
          searchInputRef={searchInputRef}
          query={query}
          setQuery={setQuery}
          searching={searching}
          searchResults={searchResults}
          scannerOpen={scannerOpen}
          setScannerOpen={setScannerOpen}
          scanLookingUp={scanLookingUp}
          lookupBarcode={lookupBarcode}
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
        />
      </div>
    </div>,
    document.body
  );
}
