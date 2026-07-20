import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { FINANCE_EXPENSE_CATEGORIES, type FinanceExpenseCategory } from '@vanguard/domain';
import { ControlInput } from '../ui/ControlPrimitives';
import Button from '../ui/Button';
import { formatPln } from '../../lib/finance/formatMoney';

interface FinanceQuickCaptureProps {
  onAdd: (input: { amount: number; category: FinanceExpenseCategory; note?: string }) => void;
  adding: boolean;
}

export function FinanceQuickCapture({ onAdd, adding }: FinanceQuickCaptureProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<FinanceExpenseCategory>('Jedzenie');
  const [note, setNote] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);

  function handleOpen() {
    setOpen(true);
    setTimeout(() => amountRef.current?.focus(), 50);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount.replace(',', '.'));
    if (!num || num <= 0) return;
    onAdd({ amount: num, category, note: note.trim() || undefined });
    setAmount('');
    setNote('');
    setOpen(false);
  }

  const num = parseFloat(amount.replace(',', '.')) || 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center gap-3 rounded-2xl bg-surface-1/70 px-4 py-3.5 text-left ring-1 ring-border-custom/25 transition-[transform,background-color] duration-150 ease-out active:scale-[0.99] hover:bg-surface-1"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2/80">
          <Plus size={16} className="text-text-muted" />
        </span>
        <span className="text-base text-text-muted">Co wydałeś?</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-surface-1/70 px-4 py-4 ring-1 ring-border-custom/25 space-y-4"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-sm text-text-muted shrink-0">−</span>
        <ControlInput
          ref={amountRef}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="min-h-12 w-full rounded-xl border-0 bg-surface-2/80 px-4 text-2xl font-semibold tracking-[-0.03em] tabular-nums ring-1 ring-border-custom/30 transition-shadow focus:ring-2 focus:ring-primary/40"
        />
        <span className="text-sm text-text-muted shrink-0">zł</span>
      </div>

      {num > 0 && (
        <p className="text-sm text-text-muted">{formatPln(num)} · {category}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {FINANCE_EXPENSE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-100 active:scale-[0.97] ${
              category === c
                ? 'bg-primary text-white'
                : 'bg-surface-2/80 text-text-secondary hover:bg-surface-2 hover:text-text-primary'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <ControlInput
        type="text"
        placeholder="Notatka (opcjonalnie)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="min-h-10 w-full rounded-xl border-0 bg-surface-2/60 px-3 text-sm ring-1 ring-border-custom/20 focus:ring-primary/35"
      />

      <div className="flex gap-2">
        <Button type="submit" loading={adding} disabled={num <= 0} className="flex-1 rounded-xl active:scale-[0.98]">
          Zapisz
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">
          Anuluj
        </Button>
      </div>
    </form>
  );
}
