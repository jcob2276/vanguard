import { useCallback, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { getTodayWarsaw } from '../../../../lib/date';
import { usePersistentDraft } from '../../../../hooks/usePersistentDraft';
import {
  parseFoodNL,
  saveParsedFoodItems,
  needsReview,
} from '../../../../lib/health/foodLogging';
import type { NLItem } from './foodEntryUtils';
import { Session } from '@supabase/supabase-js';

interface UseFoodEntryNLOptions {
  userId: string | undefined;
  session: Session;
  mealType: string;
  setError: (msg: string | null) => void;
  onSaved?: () => void;
  loadLists: () => Promise<void>;
  flashSaved: () => void;
}

export function useFoodEntryNL({
  userId,
  session,
  mealType,
  setError,
  onSaved,
  loadLists,
  flashSaved,
}: UseFoodEntryNLOptions) {
  const [nlMode, setNlMode] = useState(false);
  const [nlText, setNlText] = usePersistentDraft(userId ? `vanguard_food_nl_draft_${userId}` : null, '');
  const [nlParsing, setNlParsing] = useState(false);
  const [nlItems, setNlItems] = useState<NLItem[] | null>(null);
  const [nlSaving, setNlSaving] = useState(false);
  const [nlRemovedIdx, setNlRemovedIdx] = useState<Set<number>>(new Set());

  const parseNL = useCallback(async () => {
    if (!nlText.trim() || nlParsing || !userId) return;
    setNlParsing(true);
    setError(null);
    setNlItems(null);
    setNlRemovedIdx(new Set());
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const items = await parseFoodNL(nlText.trim(), userId, authSession?.access_token ?? session.access_token);
      if (!items.length) {
        setError('Nie rozpoznano produktów');
        return;
      }
      if (!needsReview(items)) {
        await saveParsedFoodItems(userId, items, { date: getTodayWarsaw(), mealType });
        flashSaved();
        onSaved?.();
        setNlText('');
        setNlItems(null);
        setNlRemovedIdx(new Set());
        setNlMode(false);
        await loadLists();
        return;
      }
      setNlItems(items);
    } catch (err: unknown) {
      console.error('[FoodEntryModal] NL parse failed', err);
      setError('Parsowanie nie powiodło się — spróbuj ponownie');
    } finally {
      setNlParsing(false);
    }
  }, [nlText, nlParsing, userId, session.access_token, mealType, onSaved, loadLists, flashSaved, setNlText, setError]);

  const saveNLItems = useCallback(async () => {
    if (!userId || !nlItems || nlSaving) return;
    const toSave = nlItems.filter((_, i) => !nlRemovedIdx.has(i));
    if (!toSave.length) return;
    setNlSaving(true);
    setError(null);
    try {
      await saveParsedFoodItems(userId, toSave, { date: getTodayWarsaw(), mealType });
      flashSaved();
      onSaved?.();
      setNlText('');
      setNlItems(null);
      setNlRemovedIdx(new Set());
      setNlMode(false);
      await loadLists();
    } catch (err: unknown) {
      setError(err instanceof Error ? (err as Error).message : 'Zapis nie powiódł się');
    } finally {
      setNlSaving(false);
    }
  }, [userId, nlItems, nlRemovedIdx, nlSaving, mealType, onSaved, loadLists, flashSaved, setNlText, setError]);

  return {
    nlMode,
    setNlMode,
    nlText,
    setNlText,
    nlParsing,
    nlItems,
    setNlItems,
    nlSaving,
    nlRemovedIdx,
    setNlRemovedIdx,
    parseNL,
    saveNLItems,
  };
}
