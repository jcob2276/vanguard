import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export interface AiContextPreferences {
  notes: boolean;
  tasks: boolean;
  projects: boolean;
  knowledge: boolean;
}

const DEFAULT_AI_CONTEXT: AiContextPreferences = {
  notes: true,
  tasks: true,
  projects: true,
  knowledge: true,
};

const KEY = 'ai_context_sources';
const queryKey = (userId: string) => ['ai-context-preferences', userId] as const;

async function fetchPreferences(userId: string): Promise<AiContextPreferences> {
  const { data, error } = await supabase
    .from('vanguard_preferences')
    .select('value')
    .eq('user_id', userId)
    .eq('key', KEY)
    .maybeSingle();
  if (error) throw error;
  if (!data?.value) return DEFAULT_AI_CONTEXT;
  try {
    return { ...DEFAULT_AI_CONTEXT, ...JSON.parse(data.value) as Partial<AiContextPreferences> };
  } catch {
    return DEFAULT_AI_CONTEXT;
  }
}

async function savePreferences(userId: string, value: AiContextPreferences): Promise<void> {
  const { error } = await supabase.from('vanguard_preferences').upsert({
    user_id: userId,
    key: KEY,
    value: JSON.stringify(value),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,key' });
  if (error) throw error;
}

export function useAiContextPreferences(userId: string) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: queryKey(userId), queryFn: () => fetchPreferences(userId), enabled: Boolean(userId) });
  const mutation = useMutation({
    mutationFn: (value: AiContextPreferences) => savePreferences(userId, value),
    onSuccess: (_, value) => client.setQueryData(queryKey(userId), value),
  });
  return { value: query.data || DEFAULT_AI_CONTEXT, loading: query.isLoading, save: mutation.mutateAsync, saving: mutation.isPending };
}
