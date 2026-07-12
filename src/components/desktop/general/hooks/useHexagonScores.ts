import { TIMEZONE } from '../../../../lib/date';
import { useEffect, useState } from 'react';
import { notify } from '../../../../lib/notify';
import {
  DEFAULT_SCORES,
  useHexagonScoresQuery,
  useSaveHexagonScoresMutation,
  type HexagonScores,
} from '../../../../lib/hexagonScoresApi';

export { DEFAULT_SCORES };

const SAVED_AT_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TIMEZONE,
});

export function formatSavedAt(iso: string | null) {
  if (!iso) return null;
  return SAVED_AT_FORMATTER.format(new Date(iso));
}

export function useHexagonScores(userId: string, onSaved?: () => void) {
  const { data, isLoading: loading, error: loadError } = useHexagonScoresQuery(userId);
  const saveMutation = useSaveHexagonScoresMutation(userId);

  useEffect(() => {
    if (loadError) {
      console.error('[Action Error]', loadError);
      notify(loadError instanceof Error ? loadError.message : 'Wystąpił błąd', 'error');
    }
  }, [loadError]);

  const savedScores = data?.scores ?? null;
  const savedAt = data?.savedAt ?? null;

  const [draftScores, setDraftScores] = useState<HexagonScores>(DEFAULT_SCORES);
  const [editing, setEditing] = useState(false);

  const startEdit = () => {
    setDraftScores(savedScores ?? DEFAULT_SCORES);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraftScores(savedScores ?? DEFAULT_SCORES);
    setEditing(false);
  };

  const saveScores = async () => {
    if (!userId || saveMutation.isPending) return;
    try {
      await saveMutation.mutateAsync(draftScores);
      setEditing(false);
      notify('Zapisano oceny sfer życia', 'success');
      onSaved?.();
    } catch (err: unknown) {
      console.error('[HexagonPanel] save failed', err);
      notify('Błąd zapisu ocen', 'error');
    }
  };

  return {
    savedScores,
    draftScores, setDraftScores,
    savedAt,
    editing,
    saving: saveMutation.isPending,
    loading,
    startEdit,
    cancelEdit,
    saveScores,
  };
}
