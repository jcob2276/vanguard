import { useCallback, useState } from 'react';
import { getTodayWarsaw, getYesterdayWarsaw } from '../../../../lib/date';
import { useHaptics } from '../../../../hooks/useHaptics';
import { defaultMealType } from '../../../../lib/health/foodLogging';
import type { Session } from '@supabase/supabase-js';

// Re-export types and utilities for backward compatibility
export * from './foodEntryUtils';
import {
  type RecentEntry,
} from './foodEntryUtils';

import { useFoodEntryLists } from './useFoodEntryLists';
import { useFoodEntryNL } from './useFoodEntryNL';
import { useFoodEntrySearch } from './useFoodEntrySearch';
import { useFoodEntryEdit } from './useFoodEntryEdit';
import { useFoodEntryActions } from './useFoodEntryActions';

export interface UseFoodEntryDataProps {
  session: Session;
  onClose: () => void;
  onSaved?: () => void;
  initialEditEntry?: RecentEntry;
  initialMealType?: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useFoodEntryData({
  session,
  onClose: _onClose,
  onSaved,
  initialEditEntry,
  initialMealType,
  searchInputRef,
}: UseFoodEntryDataProps) {
  const userId = session?.user?.id;
  const haptics = useHaptics();

  const [mealType, setMealType] = useState(
    initialMealType ?? defaultMealType()
  );
  const [saving, setSaving] = useState(false);
  const [quickAddingId, setQuickAddingId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = getTodayWarsaw();
  const yesterdayStr = getYesterdayWarsaw();

  // 1. Lists hook
  const lists = useFoodEntryLists(userId);

  // 2. Search hook
  const search = useFoodEntrySearch({
    userId,
    setError,
    searchInputRef,
  });

  // 3. Edit hook
  const edit = useFoodEntryEdit({
    userId,
    initialEditEntry,
    setError,
    onSaved,
    loadLists: lists.loadLists,
  });

  // 4. NL hook
  const flashSaved = useCallback(() => {
    haptics.success();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }, [haptics]);

  const nl = useFoodEntryNL({
    userId,
    session,
    mealType,
    setError,
    onSaved,
    loadLists: lists.loadLists,
    flashSaved,
  });

  // 5. Actions hook
  const actions = useFoodEntryActions({
    userId,
    mealType,
    saving,
    setSaving,
    quickAddingId,
    setQuickAddingId,
    setError,
    search,
    lists,
    flashSaved,
    onSaved,
  });

  return {
    userId,
    activeTab: lists.activeTab,
    setActiveTab: lists.setActiveTab,
    favorites: lists.favorites,
    setFavorites: lists.setFavorites,
    recent: lists.recent,
    setRecent: lists.setRecent,
    loadingList: lists.loadingList,
    query: search.query,
    setQuery: search.setQuery,
    searchResults: search.searchResults,
    setSearchResults: search.setSearchResults,
    searching: search.searching,
    selected: search.selected,
    setSelected: search.setSelected,
    grams: search.grams,
    setGrams: search.setGrams,
    mealType,
    setMealType,
    saving,
    quickAddingId,
    savedFlash,
    error,
    setError,
    scannerOpen: search.scannerOpen,
    setScannerOpen: search.setScannerOpen,
    scanLookingUp: search.scanLookingUp,
    setScanLookingUp: search.setScanLookingUp,
    editingEntry: edit.editingEntry,
    setEditingEntry: edit.setEditingEntry,
    editGrams: edit.editGrams,
    setEditGrams: edit.setEditGrams,
    editMealType: edit.editMealType,
    setEditMealType: edit.setEditMealType,
    editPer100: edit.editPer100,
    setEditPer100: edit.setEditPer100,
    editSaving: edit.editSaving,
    editDeleting: edit.editDeleting,
    todayTotals: lists.todayTotals,
    targets: lists.targets,
    nlMode: nl.nlMode,
    setNlMode: nl.setNlMode,
    nlText: nl.nlText,
    setNlText: nl.setNlText,
    nlParsing: nl.nlParsing,
    nlItems: nl.nlItems,
    setNlItems: nl.setNlItems,
    nlSaving: nl.nlSaving,
    nlRemovedIdx: nl.nlRemovedIdx,
    setNlRemovedIdx: nl.setNlRemovedIdx,
    preview: search.preview,
    editPreview: edit.editPreview,
    openEditEntry: edit.openEditEntry,
    save: actions.save,
    quickAddSearchResult: actions.quickAddSearchResult,
    quickAddFavorite: actions.quickAddFavorite,
    quickRepeatEntry: actions.quickRepeatEntry,
    parseNL: nl.parseNL,
    saveNLItems: nl.saveNLItems,
    saveEntryEdit: edit.saveEntryEdit,
    deleteEntry: edit.deleteEntry,
    todayStr,
    yesterdayStr,
    lookupBarcode: search.lookupBarcode,
  };
}
