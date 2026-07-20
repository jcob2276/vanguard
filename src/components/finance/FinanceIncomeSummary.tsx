import { formatPln } from '../../lib/finance/formatMoney';
import type { IncomeSummaryLine } from '../../lib/finance/financeTodayInsights';
import { FinanceEmpty, FinanceSection } from './financeUi';

interface FinanceIncomeSummaryProps {
  lines: IncomeSummaryLine[];
}

export function FinanceIncomeSummary({ lines }: FinanceIncomeSummaryProps) {
  const total = lines.reduce((n, l) => n + l.amount, 0);
  const hasAny = total > 0;

  return (
    <FinanceSection title="Dochód w tym miesiącu">
      {!hasAny ? (
        <FinanceEmpty>Dodaj UoZ i prowizje w Przepływach — wtedy zobaczysz podział tutaj.</FinanceEmpty>
      ) : (
        <div className="grid grid-cols-3 divide-x divide-border-custom/20">
          {lines.map((line) => (
            <div key={line.key} className="px-3 py-4 text-center">
              <p className="text-xs text-text-muted">{line.label}</p>
              <p className={`mt-1 text-base font-semibold tabular-nums tracking-[-0.02em] ${line.amount > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
                {formatPln(line.amount)}
              </p>
            </div>
          ))}
        </div>
      )}
      {hasAny && (
        <p className="border-t border-border-custom/20 px-4 py-3 text-center text-sm text-text-muted">
          Razem {formatPln(total)}/mies.
        </p>
      )}
    </FinanceSection>
  );
}
