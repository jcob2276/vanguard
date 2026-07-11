import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { notify } from '../../../../lib/notify';
import type { HexagonScores } from '../HexagonPanel';

export const DEFAULT_SCORES: HexagonScores = {
  zdrowie: 5,
  finanse: 5,
  kariera: 5,
  relacje: 5,
  rozwoj: 5,
  duchowosc: 5,
};

function normalizeScores(raw: Partial<HexagonScores> | null | undefined): HexagonScores {
  return {
    zdrowie: raw?.zdrowie ?? 5,
    finanse: raw?.finanse ?? 5,
    kariera: raw?.kariera ?? 5,
    relacje: raw?.relacje ?? 5,
    rozwoj: raw?.rozwoj ?? 5,
    duchowosc: raw?.duchowosc ?? 5,
  };
}

function parseStoredPref(value: string): { scores: HexagonScores; savedAt: string | null } {
  const parsed = JSON.parse(value) as Record<string, unknown>;
  if (parsed.scores && typeof parsed.scores === 'object') {
    return {
      scores: normalizeScores(parsed.scores as Partial<HexagonScores>),
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : null,
    };
  }
  return { scores: normalizeScores(parsed as Partial<HexagonScores>), savedAt: null };
}

const SAVED_AT_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Warsaw',
});

export function formatSavedAt(iso: string | null) {
  if (!iso) return null;
  return SAVED_AT_FORMATTER.format(new Date(iso));
}

export function useHexagonScores(userId: string, onSaved?: () => void) {
  const [savedScores, setSavedScores] = useState<HexagonScores | null>(null);
  const [draftScores, setDraftScores] = useState<HexagonScores>(DEFAULT_SCORES);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vanguard_preferences')
        .select('value, updated_at')
        .eq('user_id', userId)
        .eq('key', 'morning_hexagon_scores')
        .maybeSingle();

      if (error) throw error;

      if (data?.value) {
        try {
          const parsed = parseStoredPref(data.value);
          setSavedScores(parsed.scores);
          setDraftScores(parsed.scores);
          setSavedAt(parsed.savedAt || data.updated_at || null);
        } catch {
          setSavedScores(null);
          setDraftScores(DEFAULT_SCORES);
          setSavedAt(null);
        }
      } else {
        setSavedScores(null);
        setDraftScores(DEFAULT_SCORES);
        setSavedAt(null);
      }
    } catch (err: unknown) {
      console.error('[Action Error]', err);
      notify(err instanceof Error ? err.message : 'Wystąpił błąd', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  const startEdit = () => {
    setDraftScores(savedScores ?? DEFAULT_SCORES);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraftScores(savedScores ?? DEFAULT_SCORES);
    setEditing(false);
  };

  const saveScores = async () => {
    if (!userId || saving) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload = { scores: draftScores, savedAt: now };
      const { error: prefErr } = await supabase
        .from('vanguard_preferences')
        .upsert(
          {
            user_id: userId,
            key: 'morning_hexagon_scores',
            value: JSON.stringify(payload),
            updated_at: now,
          },
          { onConflict: 'user_id,key' },
        );
      if (prefErr) throw prefErr;

      const streamText = `[Heksagon] Zaktualizowano ocenę sfer życia: Zdrowie & Ciało: ${draftScores.zdrowie}/10, Finanse: ${draftScores.finanse}/10, Kariera & Praca: ${draftScores.kariera}/10, Relacje: ${draftScores.relacje}/10, Rozwój: ${draftScores.rozwoj}/10, Duchowość & Czas dla siebie: ${draftScores.duchowosc}/10.`;
      const { error: streamErr } = await supabase.from('vanguard_stream').insert({
        user_id: userId,
        content: streamText,
        source: 'hexagon',
        category: 'productivity',
        classification: 'hexagon_update',
      });
      if (streamErr) throw streamErr;

      setSavedScores(draftScores);
      setSavedAt(now);
      setEditing(false);
      notify('Zapisano oceny sfer życia', 'success');
      onSaved?.();
    } catch (err: unknown) {
      console.error('[HexagonPanel] save failed', err);
      notify('Błąd zapisu ocen', 'error');
    } finally {
      setSaving(false);
    }
  };

  return {
    savedScores,
    draftScores, setDraftScores,
    savedAt,
    editing,
    saving,
    loading,
    startEdit,
    cancelEdit,
    saveScores,
  };
}
