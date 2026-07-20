import { useMemo } from 'react';
import {
  FINANCE_ACCOUNT_LABELS,
  computeAllocation,
  computeFireMetrics,
  computeIncomeBreakdown,
  computeRunwayFloor,
  computeSafeToSpend,
  computeScenarios,
  resolveEffectiveIncome,
  type FireInputs,
} from '@vanguard/domain';
import { getTodayWarsaw } from '../../lib/date';
import type { FinanceBundle } from '../../lib/financeApi';
import { sumAccountBalances } from '../../lib/financeApi';
import { buildFinanceCashflowMonth } from '../../lib/finance/cashflowEvents';

function daysLeftInWarsawMonth(today: string): number {
  const [y, m, d] = today.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return Math.max(1, lastDay - d + 1);
}

function spentThisMonth(transactions: FinanceBundle['transactions'], today: string): number {
  const prefix = today.slice(0, 7);
  return transactions
    .filter((t) => t.kind === 'expense' && t.transaction_date.startsWith(prefix))
    .reduce((n, t) => n + Math.abs(t.amount), 0);
}

export function useFinanceMetrics(bundle: FinanceBundle | undefined) {
  return useMemo(() => {
    if (!bundle) return null;

    const { profile, accounts, subscriptions, bills, incomeSources, transactions } = bundle;
    const { netWorth, liquid, investments } = sumAccountBalances(accounts);
    const subsMonthly = subscriptions.filter((s) => s.is_active).reduce((n, s) => n + s.amount_monthly, 0);
    const billsMonthly = bills.filter((b) => b.is_active).reduce((n, b) => n + b.amount, 0);
    const incomeBreakdown = computeIncomeBreakdown(incomeSources);
    const effectiveIncome = resolveEffectiveIncome(profile.monthly_income, incomeBreakdown);
    const effectiveExpenses = profile.monthly_expenses > 0
      ? profile.monthly_expenses
      : subsMonthly + billsMonthly;

    const runway = computeRunwayFloor(liquid, effectiveExpenses, incomeBreakdown);
    const today = getTodayWarsaw();
    const monthKey = today.slice(0, 7);

    const fireInput: FireInputs = {
      monthlyExpenses: effectiveExpenses,
      monthlyIncome: effectiveIncome,
      currentSavings: netWorth,
      expectedReturnPct: profile.expected_return_pct,
      inflationPct: profile.inflation_pct,
      safeWithdrawalRatePct: profile.safe_withdrawal_rate_pct,
      yearsToRetirement: profile.years_to_retirement,
    };

    const fire = computeFireMetrics(fireInput);
    const spentMonth = spentThisMonth(transactions, today);
    const safeToSpend = computeSafeToSpend({
      liquid,
      monthlyIncome: effectiveIncome,
      monthlyExpenses: effectiveExpenses,
      emergencyTargetMonths: profile.emergency_target_months,
      spentThisMonth: spentMonth,
      daysLeftInMonth: daysLeftInWarsawMonth(today),
    });

    const allocation = computeAllocation(accounts, FINANCE_ACCOUNT_LABELS);
    const cashflowMonth = buildFinanceCashflowMonth(bundle, monthKey, liquid);

    const scenarios = computeScenarios(fireInput, [
      {
        label: 'Tylko UoZ',
        patch: { monthlyIncome: incomeBreakdown.baseMonthly + incomeBreakdown.passiveMonthly },
      },
      {
        label: 'Miesiąc z prowizją',
        patch: { monthlyIncome: effectiveIncome + incomeBreakdown.variableMonthly },
      },
      { label: 'Cięcie wydatków −500 zł', patch: { monthlyExpenses: Math.max(0, effectiveExpenses - 500) } },
      { label: 'Wydatek jednorazowy 20k', patch: { currentSavings: Math.max(0, netWorth - 20000) } },
    ]);

    return {
      netWorth,
      liquid,
      investments,
      effectiveIncome,
      effectiveExpenses,
      incomeBreakdown,
      runway,
      subsMonthly,
      billsMonthly,
      fireInput,
      fire,
      safeToSpend,
      spentThisMonth: spentMonth,
      allocation,
      cashflowMonth,
      monthKey,
      scenarios,
    };
  }, [bundle]);
}

export type FinanceMetrics = NonNullable<ReturnType<typeof useFinanceMetrics>>;
