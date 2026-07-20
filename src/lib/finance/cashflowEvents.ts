import {
  buildCashflowMonth,
  type CashflowEventInput,
  type CashflowMonthSummary,
} from '@vanguard/domain';
import type { FinanceBundle } from '../financeApi';

export function buildFinanceCashflowMonth(
  bundle: FinanceBundle,
  monthKey: string,
  startingBalance: number,
): CashflowMonthSummary {
  const [year, month] = monthKey.split('-').map(Number);
  const events: CashflowEventInput[] = [];

  for (const bill of bundle.bills) {
    if (!bill.is_active) continue;
    events.push({ kind: 'bill', name: bill.name, amount: bill.amount, day: bill.due_day });
  }

  for (const sub of bundle.subscriptions) {
    if (!sub.is_active) continue;
    const renewalDay = sub.renewal_date ? Number(sub.renewal_date.split('-')[2]) : 1;
    events.push({
      kind: 'subscription',
      name: sub.name,
      amount: sub.amount_monthly,
      day: Number.isFinite(renewalDay) && renewalDay > 0 ? renewalDay : 1,
    });
  }

  for (const source of bundle.incomeSources) {
    if (!source.is_active) continue;
    events.push({
      kind: 'income',
      name: source.name,
      amount: source.amount_monthly,
      day: 10,
    });
  }

  for (const tx of bundle.transactions) {
    if (tx.kind !== 'expense' || !tx.transaction_date.startsWith(monthKey)) continue;
    events.push({
      kind: 'expense',
      name: tx.note?.trim() || tx.category,
      amount: Math.abs(tx.amount),
      day: Number(tx.transaction_date.split('-')[2]) || 1,
    });
  }

  return buildCashflowMonth(year, month, events, startingBalance);
}
