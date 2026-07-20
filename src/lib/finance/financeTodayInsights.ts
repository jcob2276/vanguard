import type { FinanceIncomeType } from '@vanguard/domain';
import type { FinanceIncomeSource, FinanceTransaction } from '../financeApi';

export interface CategorySlice {
  category: string;
  amount: number;
  pct: number;
}

export interface BudgetProgress {
  plan: number;
  spent: number;
  remaining: number;
  pct: number;
  overBudget: boolean;
}

export interface IncomeSummaryLine {
  key: string;
  label: string;
  amount: number;
}

export function buildCategorySlices(
  transactions: FinanceTransaction[],
  monthKey: string,
): CategorySlice[] {
  const totals = new Map<string, number>();
  let sum = 0;

  for (const t of transactions) {
    if (t.kind !== 'expense' || !t.transaction_date.startsWith(monthKey)) continue;
    const amt = Math.abs(t.amount);
    totals.set(t.category, (totals.get(t.category) ?? 0) + amt);
    sum += amt;
  }

  if (sum <= 0) return [];

  return [...totals.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      pct: (amount / sum) * 100,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function buildBudgetProgress(input: {
  effectiveExpenses: number;
  spentThisMonth: number;
}): BudgetProgress | null {
  const plan = input.effectiveExpenses;
  const spent = input.spentThisMonth;
  if (plan <= 0 && spent <= 0) return null;

  const remaining = Math.max(0, plan - spent);
  const pct = plan > 0 ? Math.min(100, (spent / plan) * 100) : 0;
  const overBudget = plan > 0 && spent > plan;

  return { plan, spent, remaining, pct, overBudget };
}

export function buildIncomeSummary(sources: FinanceIncomeSource[]): IncomeSummaryLine[] {
  let uoz = 0;
  let setter = 0;
  let closer = 0;

  for (const source of sources) {
    if (!source.is_active) continue;
    const amount = Math.max(0, source.amount_monthly);
    const type = source.source_type as FinanceIncomeType;
    if (type === 'salary' || type === 'other') uoz += amount;
    else if (type === 'sales') setter += amount;
    else if (type === 'commission') closer += amount;
  }

  return [
    { key: 'uoz', label: 'UoZ', amount: uoz },
    { key: 'setter', label: 'Setter', amount: setter },
    { key: 'closer', label: 'Closer', amount: closer },
  ];
}
