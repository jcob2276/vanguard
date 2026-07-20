import { useState } from 'react';
import { ControlInput } from '../ui/ControlPrimitives';
import { formatPln } from '../../lib/finance/formatMoney';
import type { CashflowMonthSummary, FinanceExpenseCategory } from '@vanguard/domain';
import type { FinanceIncomeSource, FinanceTransaction } from '../../lib/financeApi';
import type { FinanceMetrics } from './useFinanceMetrics';
import {
  FinanceEmpty,
  FinanceList,
  FinanceProse,
  FinanceRow,
  FinanceSection,
  financeHeroNumberClass,
} from './financeUi';
import {
  buildMonthWaterfall,
  buildNetWorthLine,
  buildPurchaseVerdict,
  buildTodayContext,
  buildTodayHeadline,
  formatMonthLabel,
} from './financeNarrative';
import {
  buildBudgetProgress,
  buildCategorySlices,
  buildIncomeSummary,
} from '../../lib/finance/financeTodayInsights';
import { FinanceQuickCapture } from './FinanceQuickCapture';
import { FinanceWaterfall } from './FinanceWaterfall';
import { FinanceBudgetProgress } from './FinanceBudgetProgress';
import { FinanceCategoryChart } from './FinanceCategoryChart';
import { FinanceIncomeSummary } from './FinanceIncomeSummary';

interface FinanceTodayViewProps {
  metrics: FinanceMetrics;
  monthKey: string;
  cashflow: CashflowMonthSummary;
  todayDay: number;
  recentTransactions: FinanceTransaction[];
  incomeSources: FinanceIncomeSource[];
  freedomDaysForAmount: (amount: number) => number;
  onAddExpense: (input: { amount: number; category: FinanceExpenseCategory; note?: string }) => void;
  addingExpense: boolean;
}

const EVENT_LABEL: Record<string, string> = {
  bill: 'rachunek',
  subscription: 'subskrypcja',
  income: 'wpływ',
  expense: 'wydatek',
};

function RecentSpending({ transactions }: { transactions: FinanceTransaction[] }) {
  const expenses = transactions.filter((t) => t.kind === 'expense').slice(0, 5);
  if (expenses.length === 0) return null;

  return (
    <FinanceSection title="Ostatnie wydatki">
      <FinanceList>
        {expenses.map((t) => (
          <FinanceRow
            key={t.id}
            primary={t.note || t.category}
            secondary={t.transaction_date}
            trailing={<span className="text-danger">{formatPln(Math.abs(t.amount))}</span>}
          />
        ))}
      </FinanceList>
    </FinanceSection>
  );
}

function MonthAhead({
  monthKey,
  summary,
  todayDay,
}: {
  monthKey: string;
  summary: CashflowMonthSummary;
  todayDay: number;
}) {
  const activeDays = summary.days.filter((d) => d.events.length > 0);
  const monthLabel = formatMonthLabel(monthKey);

  return (
    <FinanceSection
      title="Nadchodzące"
      subtitle={activeDays.length > 0 ? `${monthLabel} · saldo końca ~${formatPln(summary.projectedEndBalance)}` : undefined}
    >
      {activeDays.length === 0 ? (
        <FinanceEmpty>
          Jak dodasz dochód i rachunki w Przepływach, zobaczysz tu kalendarz miesiąca.
        </FinanceEmpty>
      ) : (
        <FinanceList>
          {activeDays.map((day) => (
            <FinanceRow
              key={day.day}
              primary={(
                <span className={day.day === todayDay ? 'text-primary' : undefined}>
                  {day.day}. {day.day === todayDay ? 'dziś' : ''}
                </span>
              )}
              secondary={day.events.map((e) => `${EVENT_LABEL[e.kind] ?? e.kind}: ${e.name}`).join(' · ')}
              trailing={(
                <span className={day.net >= 0 ? 'text-success' : 'text-danger'}>
                  {formatPln(day.net)}
                </span>
              )}
            />
          ))}
        </FinanceList>
      )}
    </FinanceSection>
  );
}

function PurchaseCheck({ freedomDaysForAmount }: { freedomDaysForAmount: (amount: number) => number }) {
  const [price, setPrice] = useState('');
  const amount = Number(price) || 0;
  const days = amount > 0 ? freedomDaysForAmount(amount) : 0;
  const verdict = buildPurchaseVerdict(amount, days);

  return (
    <FinanceSection title="Sprawdź kwotę" subtitle="Ile dni wolności to kosztuje — sama liczba.">
      <div className="px-4 py-4">
        <label className="block">
          <span className="sr-only">Kwota</span>
          <ControlInput
            type="number"
            min="0"
            inputMode="decimal"
            placeholder="np. 2400"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="min-h-12 w-full rounded-xl border-0 bg-surface-2/80 px-4 text-lg tracking-[-0.02em] ring-1 ring-border-custom/30 transition-shadow focus:ring-2 focus:ring-primary/40"
          />
        </label>
        {verdict && <FinanceProse className="mt-4">{verdict}</FinanceProse>}
      </div>
    </FinanceSection>
  );
}

export function FinanceTodayView({
  metrics,
  monthKey,
  cashflow,
  todayDay,
  recentTransactions,
  incomeSources,
  freedomDaysForAmount,
  onAddExpense,
  addingExpense,
}: FinanceTodayViewProps) {
  const headline = buildTodayHeadline(metrics);
  const context = buildTodayContext(metrics);
  const netWorthLine = buildNetWorthLine(metrics);
  const waterfall = buildMonthWaterfall(metrics);
  const monthLabel = formatMonthLabel(monthKey);
  const budgetProgress = buildBudgetProgress({
    effectiveExpenses: metrics.effectiveExpenses,
    spentThisMonth: metrics.spentThisMonth,
  });
  const categorySlices = buildCategorySlices(recentTransactions, monthKey);
  const incomeLines = buildIncomeSummary(incomeSources);

  return (
    <div className="space-y-8">
      <header className="space-y-3 pt-1">
        <p className="text-sm text-text-muted">Na dziś zostaje około</p>
        <p className={financeHeroNumberClass}>{headline}</p>
        <FinanceProse>{context}</FinanceProse>
        <p className="text-sm text-text-muted">{netWorthLine}</p>
      </header>

      {budgetProgress && <FinanceBudgetProgress progress={budgetProgress} monthLabel={monthLabel} />}
      <FinanceQuickCapture onAdd={onAddExpense} adding={addingExpense} />
      <FinanceIncomeSummary lines={incomeLines} />
      <FinanceCategoryChart slices={categorySlices} monthLabel={monthLabel} />
      <FinanceWaterfall lines={waterfall} monthLabel={monthLabel} />
      <RecentSpending transactions={recentTransactions} />
      <PurchaseCheck freedomDaysForAmount={freedomDaysForAmount} />
      <MonthAhead monthKey={monthKey} summary={cashflow} todayDay={todayDay} />
    </div>
  );
}
