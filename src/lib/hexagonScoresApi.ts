import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export interface HexagonScores {
  zdrowie: number;
  finanse: number;
  kariera: number;
  relacje: number;
  rozwoj: number;
  duchowosc: number;
}

export const DEFAULT_SCORES: HexagonScores = {
  zdrowie: 5,
  finanse: 5,
  kariera: 5,
  relacje: 5,
  rozwoj: 5,
  duchowosc: 5,
};

export interface HexagonScoresRecord {
  scores: HexagonScores;
  savedAt: string | null;
}

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

function parseStoredPref(value: string): HexagonScoresRecord {
  const parsed = JSON.parse(value) as Record<string, unknown>;
  if (parsed.scores && typeof parsed.scores === 'object') {
    return {
      scores: normalizeScores(parsed.scores as Partial<HexagonScores>),
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : null,
    };
  }
  return { scores: normalizeScores(parsed as Partial<HexagonScores>), savedAt: null };
}

const hexagonScoresKeys = {
  all: ['hexagonScores'] as const,
  forUser: (userId: string) => [...hexagonScoresKeys.all, userId] as const,
};

async function fetchHexagonScores(userId: string): Promise<HexagonScoresRecord | null> {
  const { data, error } = await supabase
    .from('vanguard_preferences')
    .select('value, updated_at')
    .eq('user_id', userId)
    .eq('key', 'morning_hexagon_scores')
    .maybeSingle();

  if (error) throw error;
  if (!data?.value) return null;

  try {
    const parsed = parseStoredPref(data.value);
    return { scores: parsed.scores, savedAt: parsed.savedAt || data.updated_at || null };
  } catch {
    return null;
  }
}

export function useHexagonScoresQuery(userId: string) {
  return useQuery({
    queryKey: hexagonScoresKeys.forUser(userId),
    queryFn: () => fetchHexagonScores(userId),
    enabled: !!userId,
  });
}

async function saveHexagonScores(userId: string, scores: HexagonScores): Promise<string> {
  const now = new Date().toISOString();
  const payload = { scores, savedAt: now };
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

  const streamText = `[Heksagon] Zaktualizowano ocenę sfer życia: Zdrowie & Ciało: ${scores.zdrowie}/10, Finanse: ${scores.finanse}/10, Kariera & Praca: ${scores.kariera}/10, Relacje: ${scores.relacje}/10, Rozwój: ${scores.rozwoj}/10, Duchowość & Czas dla siebie: ${scores.duchowosc}/10.`;
  const { error: streamErr } = await supabase.from('vanguard_stream').insert({
    user_id: userId,
    content: streamText,
    source: 'hexagon',
    category: 'productivity',
    classification: 'hexagon_update',
  });
  if (streamErr) throw streamErr;

  return now;
}

export function useSaveHexagonScoresMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scores: HexagonScores) => saveHexagonScores(userId, scores),
    onSuccess: (savedAt, scores) => {
      queryClient.setQueryData<HexagonScoresRecord | null>(
        hexagonScoresKeys.forUser(userId),
        () => ({ scores, savedAt }),
      );
    },
  });
}
