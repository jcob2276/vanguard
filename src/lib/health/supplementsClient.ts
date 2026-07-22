import { supabase } from '../supabase';
import type { Json } from '../database.types';

export type Supplement = {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  emoji: string;
  unit: string;
  dose_per_unit: Record<string, unknown>;
  sort_order: number;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  reminder_time: string | null;
  reminder_sent_date: string | null;
  skip_qty: boolean;
  created_at: string;
};

export type SupplementLog = {
  id: string;
  user_id: string;
  supplement_id: string;
  quantity: number;
  date: string;
  logged_at: string;
  note: string | null;
};

export async function fetchSupplements(userId: string): Promise<Supplement[]> {
  const { data, error } = await supabase
    .from('supplements')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []) as Supplement[];
}

export async function fetchSupplementLogsSince(
  userId: string,
  sinceDate: string,
): Promise<SupplementLog[]> {
  const { data, error } = await supabase
    .from('supplement_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('date', sinceDate)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data || []) as SupplementLog[];
}



export async function saveSupplement(
  userId: string,
  supplement: Omit<Supplement, 'id' | 'user_id' | 'created_at' | 'reminder_sent_date'> & { id?: string; reminder_sent_date?: string | null }
): Promise<Supplement> {
  if (supplement.id) {
    const { data, error } = await supabase
      .from('supplements')
      .update({
        slug: supplement.slug,
        name: supplement.name,
        emoji: supplement.emoji,
        unit: supplement.unit,
        dose_per_unit: supplement.dose_per_unit as Json,
        sort_order: supplement.sort_order,
        active: supplement.active,
        start_date: supplement.start_date || null,
        end_date: supplement.end_date || null,
        reminder_time: supplement.reminder_time || null,
        ...(supplement.reminder_sent_date !== undefined
          ? { reminder_sent_date: supplement.reminder_sent_date }
          : {}),
        skip_qty: supplement.skip_qty,
      })
      .eq('id', supplement.id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data as Supplement;
  } else {
    const { data: list } = await supabase
      .from('supplements')
      .select('sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: false })
      .limit(1);
    const nextOrder = list && list.length > 0 ? (list[0].sort_order + 1) : 1;

    const { data, error } = await supabase
      .from('supplements')
      .insert({
        user_id: userId,
        slug: supplement.slug,
        name: supplement.name,
        emoji: supplement.emoji,
        unit: supplement.unit,
        dose_per_unit: (supplement.dose_per_unit || {}) as Json,
        sort_order: supplement.sort_order ?? nextOrder,
        active: supplement.active ?? true,
        start_date: supplement.start_date || null,
        end_date: supplement.end_date || null,
        reminder_time: supplement.reminder_time || null,
        skip_qty: supplement.skip_qty ?? false,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Supplement;
  }
}
