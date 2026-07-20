import Button from '../ui/Button';
import { TrendChart } from '../widgets/TrendChart';
import { formatPln } from '../../lib/finance/formatMoney';
import type { FinanceSnapshot } from '../../lib/financeApi';
import { FinanceEmpty, FinanceSection } from './financeUi';

interface FinanceTimelinePanelProps {
  snapshots: FinanceSnapshot[];
  currentNetWorth: number;
  onSaveSnapshot: () => void;
  saving?: boolean;
}

export function FinanceTimelinePanel({
  snapshots,
  currentNetWorth,
  onSaveSnapshot,
  saving,
}: FinanceTimelinePanelProps) {
  const points = snapshots.map((s) => ({
    label: s.snapshot_month.slice(0, 7),
    value: s.net_worth,
  }));

  if (points.length === 0) {
    points.push({ label: 'dziś', value: currentNetWorth });
  } else if (points[points.length - 1]?.value !== currentNetWorth) {
    points.push({ label: 'dziś', value: currentNetWorth });
  }

  return (
    <FinanceSection title="Trend majątku" subtitle="Raz na miesiąc wystarczy — patrzysz, czy idzie w górę.">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <span className="text-sm text-text-muted">Teraz: {formatPln(currentNetWorth)}</span>
        <Button size="sm" loading={saving} onClick={onSaveSnapshot} className="rounded-xl active:scale-[0.98]">
          Zapisz miesiąc
        </Button>
      </div>
      {snapshots.length === 0 ? (
        <FinanceEmpty>Zapisz pierwszy snapshot — wtedy zobaczysz linię w czasie.</FinanceEmpty>
      ) : (
        <div className="px-2 pb-4 pt-2">
          <TrendChart data={{ points, unit: 'zł', color: 'var(--color-primary)' }} />
        </div>
      )}
    </FinanceSection>
  );
}
