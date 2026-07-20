import Button from '../ui/Button';
import { formatPln } from '../../lib/finance/formatMoney';
import type { FinanceSubscription } from '../../lib/financeApi';
import { QuickAddForm } from './financeShared';
import { FinanceEmpty, FinanceList, FinanceRow, FinanceSection } from './financeUi';

interface FinanceSubscriptionsPanelProps {
  subscriptions: FinanceSubscription[];
  onAdd: (input: { name: string; amount_monthly: number }) => void;
  onRemove: (id: string) => void;
}

export function FinanceSubscriptionsPanel({ subscriptions, onAdd, onRemove }: FinanceSubscriptionsPanelProps) {
  const active = subscriptions.filter((s) => s.is_active);
  const monthly = active.reduce((n, s) => n + s.amount_monthly, 0);

  return (
    <FinanceSection
      title="Subskrypcje"
      subtitle={`${formatPln(monthly)}/mies. · ${formatPln(monthly * 12)} rocznie`}
    >
      <QuickAddForm
        fields={[
          { key: 'name', placeholder: 'Usługa' },
          { key: 'amount_monthly', placeholder: 'Miesięcznie', type: 'number' },
        ]}
        onSubmit={(v) => onAdd({ name: v.name, amount_monthly: Number(v.amount_monthly) })}
      />
      {active.length === 0 ? (
        <FinanceEmpty>Brak subskrypcji.</FinanceEmpty>
      ) : (
        <FinanceList>
          {active.map((s) => (
            <FinanceRow
              key={s.id}
              primary={s.name}
              secondary={s.renewal_date ? `Odnowienie ${s.renewal_date}` : undefined}
              trailing={formatPln(s.amount_monthly)}
            >
              <div className="mt-2">
                <Button variant="ghost" size="sm" onClick={() => onRemove(s.id)} className="text-danger">
                  Usuń
                </Button>
              </div>
            </FinanceRow>
          ))}
        </FinanceList>
      )}
    </FinanceSection>
  );
}
