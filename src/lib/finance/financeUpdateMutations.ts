import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { financeKeys } from '../queryKeys';
import { getTodayWarsaw } from '../date';
import type { FinanceProfile } from '../financeApi';
import type { ParsedTransaction } from './csvImport';

export function invalidateFinance(qc: ReturnType<typeof useQueryClient>, userId: string) {
  void qc.invalidateQueries({ queryKey: financeKeys.bundle(userId) });
}

export function useFinanceUpdateMutations(userId: string | undefined) {
  const qc = useQueryClient();

  const upsertProfile = useMutation({
    mutationFn: async (patch: Partial<FinanceProfile>) => {
      if (!userId) throw new Error('Brak użytkownika');
      const { error } = await supabase.from('finance_profile').upsert({
        user_id: userId,
        ...patch,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { if (userId) invalidateFinance(qc, userId); },
  });

  const updateGoalProgress = useMutation({
    mutationFn: async (input: { id: string; current_amount: number }) => {
      if (!userId) throw new Error('Brak użytkownika');
      const { error } = await supabase.from('finance_goals')
        .update({ current_amount: Math.max(0, input.current_amount) })
        .eq('id', input.id)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { if (userId) invalidateFinance(qc, userId); },
  });

  const updateAccount = useMutation({
    mutationFn: async (input: { id: string; balance?: number; crypto_amount?: number }) => {
      if (!userId) throw new Error('Brak użytkownika');
      const patch: { balance?: number; crypto_amount?: number } = {};
      if (input.balance != null) patch.balance = input.balance;
      if (input.crypto_amount != null) patch.crypto_amount = input.crypto_amount;
      const { error } = await supabase.from('finance_accounts')
        .update(patch)
        .eq('id', input.id)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { if (userId) invalidateFinance(qc, userId); },
  });

  const updateWishlistItem = useMutation({
    mutationFn: async (input: { id: string; still_want?: boolean; cool_off_until?: string | null }) => {
      if (!userId) throw new Error('Brak użytkownika');
      const patch: { still_want?: boolean; cool_off_until?: string | null } = {};
      if (input.still_want != null) patch.still_want = input.still_want;
      if (input.cool_off_until !== undefined) patch.cool_off_until = input.cool_off_until;
      const { error } = await supabase.from('finance_wishlist')
        .update(patch)
        .eq('id', input.id)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { if (userId) invalidateFinance(qc, userId); },
  });

  const saveMonthlySnapshot = useMutation({
    mutationFn: async (input: { net_worth: number; liquid_cash: number; investments: number }) => {
      if (!userId) throw new Error('Brak użytkownika');
      const month = `${getTodayWarsaw().slice(0, 7)}-01`;
      const { error } = await supabase.from('finance_snapshots').upsert({
        user_id: userId,
        snapshot_month: month,
        net_worth: input.net_worth,
        liquid_cash: input.liquid_cash,
        investments: input.investments,
        debts: 0,
      }, { onConflict: 'user_id,snapshot_month' });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { if (userId) invalidateFinance(qc, userId); },
  });

  const importTransactions = useMutation({
    mutationFn: async (rows: ParsedTransaction[]) => {
      if (!userId) throw new Error('Brak użytkownika');
      if (rows.length === 0) return { inserted: 0, skipped: 0 };

      // Fetch existing dedup hashes for the date range in this batch
      const dates = rows.map((r) => r.transaction_date);
      const minDate = dates.reduce((a, b) => (a < b ? a : b));
      const maxDate = dates.reduce((a, b) => (a > b ? a : b));

      const { data: existing } = await supabase
        .from('finance_transactions')
        .select('dedup_hash')
        .eq('user_id', userId)
        .gte('transaction_date', minDate)
        .lte('transaction_date', maxDate);

      const knownHashes = new Set((existing ?? []).map((r) => r.dedup_hash as string));
      const toInsert = rows.filter((r) => !knownHashes.has(r.dedup_hash));

      if (toInsert.length === 0) return { inserted: 0, skipped: rows.length };

      const { error } = await supabase.from('finance_transactions').insert(
        toInsert.map((r) => ({
          user_id: userId,
          amount: r.amount,
          category: r.category,
          note: r.description.slice(0, 200) || null,
          kind: r.kind,
          transaction_date: r.transaction_date,
          dedup_hash: r.dedup_hash,
        })),
      );
      if (error) throw new Error(error.message);
      return { inserted: toInsert.length, skipped: rows.length - toInsert.length };
    },
    onSuccess: () => { if (userId) invalidateFinance(qc, userId); },
  });

  return {
    upsertProfile,
    updateGoalProgress,
    updateAccount,
    updateWishlistItem,
    saveMonthlySnapshot,
    importTransactions,
  };
}
