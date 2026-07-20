import { formatPct, formatPln } from '../../lib/finance/formatMoney';
import type { CategorySlice } from '../../lib/finance/financeTodayInsights';
import { FinanceEmpty, FinanceList, FinanceRow, FinanceSection } from './financeUi';

const COLORS = ['bg-primary', 'bg-success', 'bg-warning', 'bg-info', 'bg-danger', 'bg-text-muted'];

interface FinanceCategoryChartProps {
  slices: CategorySlice[];
  monthLabel: string;
}

export function FinanceCategoryChart({ slices, monthLabel }: FinanceCategoryChartProps) {
  if (slices.length === 0) {
    return (
      <FinanceSection title="Wydatki wg kategorii" subtitle={monthLabel}>
        <FinanceEmpty>
          Zaloguj wydatki albo wgraj CSV — zobaczysz, dokąd idzie kasa w tym miesiącu.
        </FinanceEmpty>
      </FinanceSection>
    );
  }

  return (
    <FinanceSection title="Wydatki wg kategorii" subtitle={monthLabel}>
      <div className="px-4 pt-4">
        <div className="flex h-2 overflow-hidden rounded-full">
          {slices.map((s, i) => (
            <div
              key={s.category}
              className={COLORS[i % COLORS.length]}
              style={{ width: `${s.pct}%` }}
              title={`${s.category} ${formatPct(s.pct)}`}
            />
          ))}
        </div>
      </div>
      <FinanceList>
        {slices.map((s, i) => (
          <FinanceRow
            key={s.category}
            primary={(
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${COLORS[i % COLORS.length]}`} />
                {s.category}
              </span>
            )}
            trailing={`${formatPln(s.amount)} · ${formatPct(s.pct)}`}
          />
        ))}
      </FinanceList>
    </FinanceSection>
  );
}
