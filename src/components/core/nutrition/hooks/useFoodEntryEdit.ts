import { useCallback, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useHaptics } from '../../../../hooks/useHaptics';
import {
  parseGrams,
  derivePer100,
  type RecentEntry,
} from './foodEntryUtils';
import {
  saveFoodCorrection,
  defaultMealType,
} from '../../../../lib/health/foodLogging';

interface UseFoodEntryEditOptions {
  userId: string | undefined;
  initialEditEntry?: RecentEntry;
  setError: (msg: string | null) => void;
  onSaved?: () => void;
  loadLists: () => Promise<void>;
}

export function useFoodEntryEdit({
  userId,
  initialEditEntry,
  setError,
  onSaved,
  loadLists,
}: UseFoodEntryEditOptions) {
  const haptics = useHaptics();

  const [editingEntry, setEditingEntry] = useState<RecentEntry | null>(
    initialEditEntry ?? null
  );
  const [editGrams, setEditGrams] = useState(
    initialEditEntry ? String(parseGrams(initialEditEntry.amount)) : '100'
  );
  const [editMealType, setEditMealType] = useState(
    initialEditEntry?.meal_type ?? defaultMealType()
  );
  const [editPer100, setEditPer100] = useState<{
    calories: number;
    protein: number;
    carbs: number | null;
    fat: number | null;
  } | null>(initialEditEntry ? derivePer100(initialEditEntry) : null);
  const [editSaving, setEditSaving] = useState(false);
  const [editDeleting, setEditDeleting] = useState(false);

  const editPreview = useMemo(() => {
    if (!editPer100) return null;
    const g = parseInt(editGrams, 10) || 0;
    return {
      calories: Math.round((editPer100.calories * g) / 100),
      protein: Math.round(((editPer100.protein * g) / 100) * 10) / 10,
      carbs:
        editPer100.carbs != null
          ? Math.round(((editPer100.carbs * g) / 100) * 10) / 10
          : null,
      fat:
        editPer100.fat != null
          ? Math.round(((editPer100.fat * g) / 100) * 10) / 10
          : null,
    };
  }, [editGrams, editPer100]);

  const openEditEntry = useCallback(
    (entry: RecentEntry) => {
      setEditingEntry(entry);
      setEditGrams(String(parseGrams(entry.amount)));
      setEditMealType(entry.meal_type ?? defaultMealType());
      setEditPer100(derivePer100(entry));
      setError(null);
    },
    [setError]
  );

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
          calories: editPreview.calories,
          protein: editPreview.protein,
          carbs: editPreview.carbs,
          fat: editPreview.fat,
          meal_type: editMealType,
          amount: `${newGrams} g`,
        },
      });
      if (updErr) throw updErr;
      const origGrams = parseGrams(editingEntry.amount);
      if (Math.abs(newGrams - origGrams) >= 5) {
        saveFoodCorrection(userId, editingEntry.name, newGrams).catch((e) =>
          console.warn('[FoodEntryModal] saveFoodCorrection failed', e)
        );
      }
      setEditingEntry(null);
      onSaved?.();
      await loadLists();
    } catch (err: unknown) {
      setError(err instanceof Error ? (err as Error).message : 'Aktualizacja nie powiodła się');
    } finally {
      setEditSaving(false);
    }
  }, [editingEntry, userId, editGrams, editMealType, editPreview, editSaving, onSaved, loadLists, setError]);

  const deleteEntry = useCallback(async () => {
    if (!editingEntry || !userId || editDeleting) return;
    haptics.light();
    setEditDeleting(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('remove_food_entry', {
        p_user_id: userId,
        p_entry_id: editingEntry.id,
      });
      if (rpcError) throw rpcError;
      setEditingEntry(null);
      onSaved?.();
      await loadLists();
    } catch (err: unknown) {
      setError(err instanceof Error ? (err as Error).message : 'Usunięcie nie powiodło się');
    } finally {
      setEditDeleting(false);
    }
  }, [editingEntry, userId, editDeleting, onSaved, loadLists, haptics, setError]);

  return {
    editingEntry,
    setEditingEntry,
    editGrams,
    setEditGrams,
    editMealType,
    setEditMealType,
    editPer100,
    setEditPer100,
    editSaving,
    editDeleting,
    editPreview,
    openEditEntry,
    saveEntryEdit,
    deleteEntry,
  };
}
