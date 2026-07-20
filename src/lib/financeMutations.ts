import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { getTodayWarsaw, shiftDateStr } from './date';
import type { FinanceAccountType, FinanceExpenseCategory, FinanceIncomeType } from '@vanguard/domain';
import { invalidateFinance, useFinanceUpdateMutations } from './finance/financeUpdateMutations';

type FinanceDeleteTable =
  | 'finance_accounts'
  | 'finance_goals'
  | 'finance_wishlist'
  | 'finance_subscriptions'
  | 'finance_bills'
  | 'finance_income_sources';

function useDeleteMutation(userId: string | undefined, table: FinanceDeleteTable, qc: ReturnType<typeof useQueryClient>) {
  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Brak użytkownika');
      const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { if (userId) invalidateFinance(qc, userId); },
  });
}

export function useFinanceMutations(userId: string | undefined) {
  const qc = useQueryClient();
  const updates = useFinanceUpdateMutations(userId);

  const addAccount = useMutation({
    mutationFn: async (input: {
      name: string;
      balance: number;
      account_type: FinanceAccountType;
      is_liquid?: boolean;
      coingecko_id?: string | null;
      crypto_amount?: number | null;
    }) => {
      if (!userId) throw new Error('Brak użytkownika');
      const isCrypto = Boolean(input.coingecko_id && input.crypto_amount != null);
      const { error } = await supabase.from('finance_accounts').insert({
        user_id: userId,
        name: input.name.trim(),
        balance: isCrypto ? 0 : input.balance,
        account_type: input.account_type,
        is_liquid: input.is_liquid ?? (input.account_type === 'cash' || input.account_type === 'bank'),
        coingecko_id: input.coingecko_id ?? null,
        crypto_amount: input.crypto_amount ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { if (userId) invalidateFinance(qc, userId); },
  });

  const addGoal = useMutation({
    mutationFn: async (input: { name: string; target_amount: number }) => {
      if (!userId) throw new Error('Brak użytkownika');
      const { error } = await supabase.from('finance_goals').insert({
        user_id: userId,
        name: input.name.trim(),
        target_amount: input.target_amount,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { if (userId) invalidateFinance(qc, userId); },
  });

  const addWishlist = useMutation({
    mutationFn: async (input: { name: string; price: number }) => {
      if (!userId) throw new Error('Brak użytkownika');
      const { error } = await supabase.from('finance_wishlist').insert({
        user_id: userId,
        name: input.name.trim(),
        price: input.price,
        cool_off_until: shiftDateStr(getTodayWarsaw(), 30),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { if (userId) invalidateFinance(qc, userId); },
  });

  const addSubscription = useMutation({
    mutationFn: async (input: { name: string; amount_monthly: number }) => {
      if (!userId) throw new Error('Brak użytkownika');
      const { error } = await supabase.from('finance_subscriptions').insert({
        user_id: userId,
        name: input.name.trim(),
        amount_monthly: input.amount_monthly,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { if (userId) invalidateFinance(qc, userId); },
  });

  const addBill = useMutation({
    mutationFn: async (input: { name: string; amount: number; due_day: number }) => {
      if (!userId) throw new Error('Brak użytkownika');
      const { error } = await supabase.from('finance_bills').insert({
        user_id: userId,
        name: input.name.trim(),
        amount: input.amount,
        due_day: input.due_day,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { if (userId) invalidateFinance(qc, userId); },
  });

  const addTransaction = useMutation({
    mutationFn: async (input: { amount: number; category: FinanceExpenseCategory; note?: string }) => {
      if (!userId) throw new Error('Brak użytkownika');
      const { error } = await supabase.from('finance_transactions').insert({
        user_id: userId,
        amount: -Math.abs(input.amount),
        category: input.category,
        note: input.note?.trim() || null,
        kind: 'expense',
        transaction_date: getTodayWarsaw(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { if (userId) invalidateFinance(qc, userId); },
  });

  const addIncomeSource = useMutation({
    mutationFn: async (input: { name: string; amount_monthly: number; source_type: FinanceIncomeType }) => {
      if (!userId) throw new Error('Brak użytkownika');
      const { error } = await supabase.from('finance_income_sources').insert({
        user_id: userId,
        name: input.name.trim(),
        amount_monthly: input.amount_monthly,
        source_type: input.source_type,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { if (userId) invalidateFinance(qc, userId); },
  });

  const removeAccount = useDeleteMutation(userId, 'finance_accounts', qc);
  const removeGoal = useDeleteMutation(userId, 'finance_goals', qc);
  const removeWishlist = useDeleteMutation(userId, 'finance_wishlist', qc);
  const removeSubscription = useDeleteMutation(userId, 'finance_subscriptions', qc);
  const removeBill = useDeleteMutation(userId, 'finance_bills', qc);
  const removeIncomeSource = useDeleteMutation(userId, 'finance_income_sources', qc);

  return {
    ...updates,
    addAccount,
    addGoal,
    addWishlist,
    addSubscription,
    addBill,
    addTransaction,
    addIncomeSource,
    removeAccount,
    removeGoal,
    removeWishlist,
    removeSubscription,
    removeBill,
    removeIncomeSource,
  };
}

export type FinanceMutations = ReturnType<typeof useFinanceMutations>;
