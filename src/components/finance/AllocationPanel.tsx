import type { AllocationSlice } from '@vanguard/domain';
import { formatPct, formatPln } from '../../lib/finance/formatMoney';
import { FinanceEmpty, FinanceList, FinanceRow, FinanceSection } from './financeUi';

interface AllocationPanelProps {
  slices: AllocationSlice[];
}

const COLORS = ['bg-primary', 'bg-success', 'bg-warning', 'bg-info', 'bg-danger', 'bg-text-muted'];

export function AllocationPanel({ slices }: AllocationPanelProps) {
  if (slices.length === 0) {
    return (
      <FinanceSection title="Skład majątku">
        <FinanceEmpty>Dodaj konta — zobaczysz, gdzie leży kasa.</FinanceEmpty>
      </FinanceSection>
    );
  }

  return (
    <FinanceSection title="Skład majątku">
      <div className="px-4 pt-4">
        <div className="flex h-2 overflow-hidden rounded-full">
          {slices.map((s, i) => (
            <div key={s.key} className={COLORS[i % COLORS.length]} style={{ width: `${s.pct}%` }} title={`${s.label} ${formatPct(s.pct)}`} />
          ))}
        </div>
      </div>
      <FinanceList>
        {slices.map((s, i) => (
          <FinanceRow
            key={s.key}
            primary={(
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${COLORS[i % COLORS.length]}`} />
                {s.label}
              </span>
            )}
            trailing={`${formatPln(s.amount)} · ${formatPct(s.pct)}`}
          />
        ))}
      </FinanceList>
    </FinanceSection>
  );
}
