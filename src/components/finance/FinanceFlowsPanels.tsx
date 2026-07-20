import { useState } from 'react';

import { FINANCE_EXPENSE_CATEGORIES, FINANCE_INCOME_LABELS, FINANCE_INCOME_TYPES, type FinanceExpenseCategory, type FinanceIncomeType } from '@vanguard/domain';

import Button from '../ui/Button';

import { ToggleChip } from '../ui/ToggleChip';

import { formatPln } from '../../lib/finance/formatMoney';

import type { FinanceIncomeSource, FinanceTransaction } from '../../lib/financeApi';

import { ControlInput } from '../ui/ControlPrimitives';

import { QuickAddForm } from './financeShared';

import { FinanceEmpty, FinanceList, FinanceRow, FinanceSection } from './financeUi';



interface FinanceExpensesPanelProps {

  transactions: FinanceTransaction[];

  onAdd: (input: { amount: number; category: FinanceExpenseCategory; note?: string }) => void;

}



export function FinanceExpensesPanel({ transactions, onAdd }: FinanceExpensesPanelProps) {

  const [category, setCategory] = useState<FinanceExpenseCategory>('Inne');

  const expenses = transactions.filter((t) => t.kind === 'expense');



  return (

    <FinanceSection title="Drobne wydatki" subtitle="Szybki zapis — bez kategorii księgowej.">

      <div className="space-y-3 px-4 pt-4">

        <div className="flex flex-wrap gap-1.5">

          {FINANCE_EXPENSE_CATEGORIES.map((c) => (

            <ToggleChip key={c} active={category === c} onClick={() => setCategory(c)} size="sm">{c}</ToggleChip>

          ))}

        </div>

        <form

          className="flex flex-wrap gap-2"

          onSubmit={(e) => {

            e.preventDefault();

            const fd = new FormData(e.currentTarget);

            onAdd({

              amount: Number(fd.get('amount')),

              category,

              note: String(fd.get('note') ?? ''),

            });

            e.currentTarget.reset();

          }}

        >

          <ControlInput name="amount" type="number" placeholder="Kwota" required className="min-h-11 w-28 rounded-xl border-0 bg-surface-2/70 px-3 ring-1 ring-border-custom/25" />

          <ControlInput name="note" placeholder="Notatka" className="min-h-11 flex-1 rounded-xl border-0 bg-surface-2/70 px-3 ring-1 ring-border-custom/25" />

          <Button type="submit" size="sm" className="rounded-xl active:scale-[0.98]">Dodaj</Button>

        </form>

      </div>

      {expenses.length === 0 ? (

        <FinanceEmpty>Brak wydatków w tym okresie.</FinanceEmpty>

      ) : (

        <FinanceList>

          {expenses.slice(0, 20).map((t) => (

            <FinanceRow

              key={t.id}

              primary={t.category}

              secondary={t.note || undefined}

              trailing={<span className="text-danger">{formatPln(Math.abs(t.amount))}</span>}

            />

          ))}

        </FinanceList>

      )}

    </FinanceSection>

  );

}



interface FinanceIncomePanelProps {

  sources: FinanceIncomeSource[];

  onAdd: (input: { name: string; amount_monthly: number; source_type: FinanceIncomeType }) => void;

  onRemove: (id: string) => void;

}



export function FinanceIncomePanel({ sources, onAdd, onRemove }: FinanceIncomePanelProps) {

  const [sourceType, setSourceType] = useState<FinanceIncomeType>('salary');

  const active = sources.filter((s) => s.is_active);

  const total = active.reduce((n, s) => n + s.amount_monthly, 0);



  return (

    <FinanceSection

      title="Dochód"

      subtitle={`Razem ${formatPln(total)}/mies. · UoZ + prowizje setter/closer`}

    >

      <div className="px-4 pt-4">

        <div className="flex flex-wrap gap-1.5">

          {FINANCE_INCOME_TYPES.map((t) => (

            <ToggleChip key={t} active={sourceType === t} onClick={() => setSourceType(t)} size="sm" variant="success">

              {FINANCE_INCOME_LABELS[t]}

            </ToggleChip>

          ))}

        </div>

      </div>

      <QuickAddForm

        fields={[

          { key: 'name', placeholder: 'Źródło' },

          { key: 'amount_monthly', placeholder: 'Miesięcznie', type: 'number' },

        ]}

        onSubmit={(v) => onAdd({ name: v.name, amount_monthly: Number(v.amount_monthly), source_type: sourceType })}

      />

      {active.length === 0 ? (

        <FinanceEmpty>Dodaj UoZ i prowizje — wtedy liczby na Dziś będą trafniejsze.</FinanceEmpty>

      ) : (

        <FinanceList>

          {active.map((s) => (

            <FinanceRow

              key={s.id}

              primary={s.name}

              secondary={FINANCE_INCOME_LABELS[s.source_type as FinanceIncomeType]}

              trailing={<span className="text-success">{formatPln(s.amount_monthly)}</span>}

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

