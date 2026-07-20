import { formatPln } from '../../lib/finance/formatMoney';
import type { WaterfallLine } from './financeNarrative';
import { FinanceSection } from './financeUi';

interface FinanceWaterfallProps {
  lines: WaterfallLine[];
  monthLabel: string;
}

function amountClass(kind: WaterfallLine['kind']): string {
  if (kind === 'in') return 'text-success';
  if (kind === 'out') return 'text-text-secondary';
  if (kind === 'result') return 'text-text-primary font-semibold';
  return 'text-text-muted';
}

export function FinanceWaterfall({ lines, monthLabel }: FinanceWaterfallProps) {
  if (lines.length === 0) return null;

  return (
    <FinanceSection title="Skąd się bierze ta kwota" subtitle={monthLabel}>
      <ul className="divide-y divide-border-custom/15">
        {lines.map((line) => (
          <li key={line.label} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className={`text-sm ${line.kind === 'result' ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
              {line.label}
            </span>
            <span className={`text-sm tabular-nums tracking-[-0.02em] ${amountClass(line.kind)}`}>
              {line.amount >= 0 ? '' : '−'}{formatPln(Math.abs(line.amount))}
            </span>
          </li>
        ))}
      </ul>
    </FinanceSection>
  );
}
