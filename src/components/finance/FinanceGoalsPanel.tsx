import { useState } from 'react';
import Button from '../ui/Button';
import { ControlInput } from '../ui/ControlPrimitives';
import { formatPln } from '../../lib/finance/formatMoney';
import type { FinanceGoal } from '../../lib/financeApi';
import { QuickAddForm } from './financeShared';
import { FinanceEmpty, FinanceList, FinanceRow, FinanceSection } from './financeUi';

interface FinanceGoalsPanelProps {
  goals: FinanceGoal[];
  onAdd: (input: { name: string; target_amount: number }) => void;
  onUpdateProgress: (input: { id: string; current_amount: number }) => void;
  onRemove: (id: string) => void;
}

function GoalProgressEditor({
  goal,
  onSave,
}: {
  goal: FinanceGoal;
  onSave: (amount: number) => void;
}) {
  const [value, setValue] = useState(String(goal.current_amount));

  return (
    <form
      className="mt-3 flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Number(value));
      }}
    >
      <ControlInput
        type="number"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-9 w-28 rounded-lg border-0 bg-surface-2/80 px-2 text-sm ring-1 ring-border-custom/25"
        aria-label={`Postęp celu ${goal.name}`}
      />
      <Button type="submit" size="sm" variant="secondary" className="rounded-lg active:scale-[0.98]">
        Zapisz
      </Button>
    </form>
  );
}

export function FinanceGoalsPanel({ goals, onAdd, onUpdateProgress, onRemove }: FinanceGoalsPanelProps) {
  return (
    <FinanceSection title="Cele" subtitle="Mustang, podróż, cokolwiek — z kwotą docelową.">
      <QuickAddForm
        fields={[
          { key: 'name', placeholder: 'Cel' },
          { key: 'target_amount', placeholder: 'Kwota', type: 'number' },
        ]}
        onSubmit={(v) => onAdd({ name: v.name, target_amount: Number(v.target_amount) })}
      />
      {goals.length === 0 ? (
        <FinanceEmpty>Na razie brak celów. Dodaj jeden, żeby widzieć postęp.</FinanceEmpty>
      ) : (
        <FinanceList>
          {goals.map((g) => {
            const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
            return (
              <FinanceRow
                key={g.id}
                primary={g.name}
                secondary={`${formatPln(g.current_amount)} z ${formatPln(g.target_amount)} · ${pct.toFixed(0)}%`}
                trailing={`${pct.toFixed(0)}%`}
              >
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <GoalProgressEditor goal={g} onSave={(amount) => onUpdateProgress({ id: g.id, current_amount: amount })} />
                  <Button variant="ghost" size="sm" onClick={() => onRemove(g.id)} className="text-danger">
                    Usuń
                  </Button>
                </div>
              </FinanceRow>
            );
          })}
        </FinanceList>
      )}
    </FinanceSection>
  );
}
