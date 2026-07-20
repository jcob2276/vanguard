import Button from '../ui/Button';
import { formatPln } from '../../lib/finance/formatMoney';
import type { FinanceBill } from '../../lib/financeApi';
import { QuickAddForm } from './financeShared';
import { FinanceEmpty, FinanceList, FinanceRow, FinanceSection } from './financeUi';

interface FinanceBillsPanelProps {
  bills: FinanceBill[];
  onAdd: (input: { name: string; amount: number; due_day: number }) => void;
  onRemove: (id: string) => void;
}

export function FinanceBillsPanel({ bills, onAdd, onRemove }: FinanceBillsPanelProps) {
  const active = bills.filter((b) => b.is_active);
  const monthly = active.reduce((n, b) => n + b.amount, 0);

  return (
    <FinanceSection title="Rachunki" subtitle={`${formatPln(monthly)}/mies. · czynsz, prąd, internet`}>
      <QuickAddForm
        fields={[
          { key: 'name', placeholder: 'Rachunek' },
          { key: 'amount', placeholder: 'Kwota', type: 'number' },
          { key: 'due_day', placeholder: 'Dzień mies.', type: 'number', defaultValue: '1' },
        ]}
        onSubmit={(v) => onAdd({ name: v.name, amount: Number(v.amount), due_day: Number(v.due_day) })}
      />
      {active.length === 0 ? (
        <FinanceEmpty>Brak rachunków — dodaj stałe koszty miesiąca.</FinanceEmpty>
      ) : (
        <FinanceList>
          {active.map((b) => (
            <FinanceRow
              key={b.id}
              primary={b.name}
              secondary={`${b.due_day}. dnia miesiąca`}
              trailing={formatPln(b.amount)}
            >
              <div className="mt-2">
                <Button variant="ghost" size="sm" onClick={() => onRemove(b.id)} className="text-danger">
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
