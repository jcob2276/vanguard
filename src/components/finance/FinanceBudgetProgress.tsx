import { formatPln } from '../../lib/finance/formatMoney';
import type { BudgetProgress } from '../../lib/finance/financeTodayInsights';
import { FinanceSection } from './financeUi';

interface FinanceBudgetProgressProps {
  progress: BudgetProgress;
  monthLabel: string;
}

export function FinanceBudgetProgress({ progress, monthLabel }: FinanceBudgetProgressProps) {
  const barPct = progress.plan > 0
    ? Math.min(100, (progress.spent / progress.plan) * 100)
    : 0;

  return (
    <FinanceSection title="Plan vs wydane" subtitle={monthLabel}>
      <div className="space-y-3 px-4 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-sm text-text-muted">Wydane</p>
            <p className="text-lg font-semibold tabular-nums tracking-[var(--tracking-tight)] text-text-primary">
              {formatPln(progress.spent)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-text-muted">Plan miesiąca</p>
            <p className="text-lg font-semibold tabular-nums tracking-[var(--tracking-tight)] text-text-secondary">
              {formatPln(progress.plan)}
            </p>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full transition-[width] duration-[var(--motion-slow)] ease-[var(--ease-out)] ${progress.overBudget ? 'bg-warning' : 'bg-primary'}`}
            style={{ width: `${barPct}%` }}
          />
        </div>

        <p className="text-sm text-text-muted">
          {progress.overBudget
            ? `Powyżej planu o ${formatPln(progress.spent - progress.plan)}`
            : progress.plan > 0
              ? `Zostało ${formatPln(progress.remaining)} do planu`
              : 'Ustaw plan wydatków w Przepływach albo przez rachunki i subskrypcje.'}
        </p>
      </div>
    </FinanceSection>
  );
}
