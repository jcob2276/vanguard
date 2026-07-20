import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_LEAD_OFFSETS,
  type LifeObligationKind,
  type LifeObligationRecurrence,
} from '@vanguard/domain';
import { supabase } from './supabase';
import { lifeObligationKeys } from './queryKeys';

export interface LifeObligation {
  id: string;
  user_id: string;
  title: string;
  kind: LifeObligationKind;
  related_name: string | null;
  anchor_date: string;
  recurrence: LifeObligationRecurrence;
  lead_offsets: number[];
  notes: string | null;
  is_active: boolean;
  sent_reminders: string[];
  created_at: string;
  updated_at: string;
}

export interface LifeObligationInput {
  title: string;
  kind: LifeObligationKind;
  related_name?: string | null;
  anchor_date: string;
  recurrence?: LifeObligationRecurrence;
  lead_offsets?: number[];
  notes?: string | null;
}

function normalizeRow(row: Record<string, unknown>): LifeObligation {
  const sent = row.sent_reminders;
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: String(row.title),
    kind: row.kind as LifeObligationKind,
    related_name: (row.related_name as string | null) ?? null,
    anchor_date: String(row.anchor_date),
    recurrence: (row.recurrence as LifeObligationRecurrence) ?? 'yearly',
    lead_offsets: Array.isArray(row.lead_offsets)
      ? (row.lead_offsets as number[])
      : DEFAULT_LEAD_OFFSETS[(row.kind as LifeObligationKind) ?? 'people'],
    notes: (row.notes as string | null) ?? null,
    is_active: Boolean(row.is_active ?? true),
    sent_reminders: Array.isArray(sent)
      ? sent.filter((v): v is string => typeof v === 'string')
      : [],
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

async function fetchLifeObligations(userId: string): Promise<LifeObligation[]> {
  const { data, error } = await supabase
    .from('life_obligations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('anchor_date', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => normalizeRow(row as Record<string, unknown>));
}

export function useLifeObligations(userId: string | undefined) {
  return useQuery({
    queryKey: lifeObligationKeys.list(userId ?? ''),
    queryFn: () => fetchLifeObligations(userId!),
    enabled: Boolean(userId),
  });
}

export function useLifeObligationMutations(userId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => {
    if (userId) void qc.invalidateQueries({ queryKey: lifeObligationKeys.list(userId) });
  };

  const add = useMutation({
    mutationFn: async (input: LifeObligationInput) => {
      if (!userId) throw new Error('Brak użytkownika');
      const kind = input.kind;
      const { error } = await supabase.from('life_obligations').insert({
        user_id: userId,
        title: input.title.trim(),
        kind,
        related_name: input.related_name?.trim() || null,
        anchor_date: input.anchor_date,
        recurrence: input.recurrence ?? 'yearly',
        lead_offsets: input.lead_offsets ?? DEFAULT_LEAD_OFFSETS[kind],
        notes: input.notes?.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Brak użytkownika');
      const { error } = await supabase
        .from('life_obligations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async (input: { id: string } & Partial<LifeObligationInput>) => {
      if (!userId) throw new Error('Brak użytkownika');
      const { error } = await supabase
        .from('life_obligations')
        .update({
          ...(input.title != null ? { title: input.title.trim() } : {}),
          ...(input.kind != null ? { kind: input.kind } : {}),
          ...(input.related_name !== undefined
            ? { related_name: input.related_name?.trim() || null }
            : {}),
          ...(input.anchor_date != null ? { anchor_date: input.anchor_date } : {}),
          ...(input.recurrence != null ? { recurrence: input.recurrence } : {}),
          ...(input.lead_offsets != null ? { lead_offsets: input.lead_offsets } : {}),
          ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { add, remove, update };
}
