import { FINANCE_EXPENSE_CATEGORIES, type FinanceExpenseCategory } from '@vanguard/domain';
import { AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import { X } from 'lucide-react';
import { formatPln } from '../../lib/finance/formatMoney';
import { FinanceEmpty, FinanceList, FinanceSection } from './financeUi';
import { ToggleChip } from '../ui/ToggleChip';
import type { ParsedTransaction } from '../../lib/finance/csvImport';

const KIND_FILTER = ['wszystkie', 'expense', 'income'] as const;
export type KindFilter = (typeof KIND_FILTER)[number];

interface FinanceCsvPreviewProps {
  bank: string;
  transactions: ParsedTransaction[];
  errors: string[];
  selected: Set<string>;
  kindFilter: KindFilter;
  categoryOverrides: Record<string, FinanceExpenseCategory>;
  importing: boolean;
  onToggle: (hash: string) => void;
  onToggleAll: (checked: boolean) => void;
  onKindFilter: (k: KindFilter) => void;
  onCategoryOverride: (hash: string, cat: FinanceExpenseCategory) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FinanceCsvPreview({
  bank,
  transactions,
  errors,
  selected,
  kindFilter,
  categoryOverrides,
  importing,
  onToggle,
  onToggleAll,
  onKindFilter,
  onCategoryOverride,
  onConfirm,
  onCancel,
}: FinanceCsvPreviewProps) {
  const expenses = transactions.filter((t) => t.kind === 'expense');
  const incomes = transactions.filter((t) => t.kind === 'income');
  const selectedCount = transactions.filter((t) => selected.has(t.dedup_hash)).length;
  const visibleTx = transactions.filter((t) => kindFilter === 'wszystkie' || t.kind === kindFilter);

  return (
    <FinanceSection
      title="Import z banku"
      subtitle={`${bank} · ${transactions.length} transakcji znalezionych`}
    >
      {errors.length > 0 && (
        <div className="mx-4 mb-1 mt-4 space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="flex items-center gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertCircle size={14} className="shrink-0" />{err}
            </p>
          ))}
        </div>
      )}

      {transactions.length === 0 ? (
        <FinanceEmpty>
          Nie znaleziono transakcji. Sprawdź czy to właściwy plik i format banku.
        </FinanceEmpty>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
            <span className="text-sm text-success">{incomes.length} wpływów</span>
            <span className="text-text-muted">·</span>
            <span className="text-sm text-danger">{expenses.length} wydatków</span>
            <span className="text-text-muted">·</span>
            <span className="text-sm text-text-muted">{selectedCount} zaznaczonych</span>
          </div>

          <div className="flex flex-wrap gap-1.5 px-4 py-3">
            {KIND_FILTER.map((k) => (
              <ToggleChip key={k} active={kindFilter === k} onClick={() => onKindFilter(k)} size="sm">
                {k === 'wszystkie' ? 'Wszystkie' : k === 'expense' ? 'Wydatki' : 'Wpływy'}
              </ToggleChip>
            ))}
            <button
              type="button"
              onClick={() => onToggleAll(selectedCount < transactions.length)}
              className="ml-auto rounded-lg px-2 py-1 text-xs text-text-muted hover:text-text-primary active:scale-[0.97]"
            >
              {selectedCount === transactions.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
            </button>
          </div>

          <FinanceList>
            {visibleTx.map((tx) => (
              <div
                key={tx.dedup_hash}
                className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${selected.has(tx.dedup_hash) ? '' : 'opacity-40'}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(tx.dedup_hash)}
                  onChange={() => onToggle(tx.dedup_hash)}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                  aria-label={tx.description}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-base font-medium leading-snug text-text-primary">{tx.description || '—'}</p>
                    <span className={`shrink-0 text-base font-medium tabular-nums ${tx.kind === 'income' ? 'text-success' : 'text-danger'}`}>
                      {tx.kind === 'income' ? '+' : ''}{formatPln(Math.abs(tx.amount))}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-sm text-text-muted">{tx.transaction_date}</span>
                    <select
                      value={categoryOverrides[tx.dedup_hash] ?? tx.category}
                      onChange={(e) => onCategoryOverride(tx.dedup_hash, e.target.value as FinanceExpenseCategory)}
                      className="rounded-md border-0 bg-surface-2/80 px-2 py-0.5 text-xs text-text-secondary ring-1 ring-border-custom/25 focus:ring-primary/40"
                    >
                      {FINANCE_EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </FinanceList>

          <div className="flex flex-wrap items-center gap-2 px-4 py-4">
            <Button
              onClick={onConfirm}
              loading={importing}
              disabled={selectedCount === 0}
              className="rounded-xl active:scale-[0.98]"
            >
              Importuj {selectedCount} transakcji
            </Button>
            <Button variant="ghost" onClick={onCancel} className="gap-1.5">
              <X size={14} /> Anuluj
            </Button>
          </div>
        </>
      )}
    </FinanceSection>
  );
}
