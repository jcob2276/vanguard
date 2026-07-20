import { useRef, useState } from 'react';
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import type { FinanceExpenseCategory } from '@vanguard/domain';
import Button from '../ui/Button';
import { parseBankCsv, BANK_LABELS, type ParsedTransaction } from '../../lib/finance/csvImport';
import { FinanceSection } from './financeUi';
import { FinanceCsvPreview, type KindFilter } from './FinanceCsvPreview';

interface FinanceCsvImportPanelProps {
  onImport: (rows: ParsedTransaction[]) => Promise<{ inserted: number; skipped: number }>;
  importing: boolean;
}

type Step = 'idle' | 'preview' | 'done';

interface PreviewState {
  transactions: ParsedTransaction[];
  bank: string;
  rawRowCount: number;
  errors: string[];
}

export function FinanceCsvImportPanel({ onImport, importing }: FinanceCsvImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('idle');
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [kindFilter, setKindFilter] = useState<KindFilter>('wszystkie');
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, FinanceExpenseCategory>>({});
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function handleFile(file: File) {
    setFileError(null);
    if (!file.name.match(/\.(csv|txt)$/i)) {
      setFileError('Wgraj plik CSV lub TXT.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseBankCsv(text);
      setPreview({ transactions: parsed.transactions, bank: BANK_LABELS[parsed.bank], rawRowCount: parsed.rawRowCount, errors: parsed.errors });
      setSelected(new Set(parsed.transactions.map((t) => t.dedup_hash)));
      setCategoryOverrides({});
      setStep('preview');
    };
    reader.readAsText(file, 'UTF-8');
  }

  function reset() {
    setStep('idle'); setPreview(null); setSelected(new Set());
    setCategoryOverrides({}); setResult(null); setFileError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleConfirm() {
    if (!preview) return;
    const rows = preview.transactions
      .filter((t) => selected.has(t.dedup_hash))
      .map((t) => ({ ...t, category: categoryOverrides[t.dedup_hash] ?? t.category }));
    const res = await onImport(rows);
    setResult(res);
    setStep('done');
  }

  if (step === 'done' && result) {
    return (
      <FinanceSection title="Import z banku">
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <CheckCircle2 size={36} className="text-success" />
          <p className="text-lg font-semibold text-text-primary">Gotowe — wgrano {result.inserted} transakcji</p>
          {result.skipped > 0 && <p className="text-sm text-text-muted">{result.skipped} pominięto (już istniały)</p>}
          <Button onClick={reset} variant="secondary" className="mt-2 rounded-xl active:scale-[0.98]">Importuj kolejny plik</Button>
        </div>
      </FinanceSection>
    );
  }

  if (step === 'preview' && preview) {
    return (
      <FinanceCsvPreview
        bank={preview.bank}
        transactions={preview.transactions}
        errors={preview.errors}
        selected={selected}
        kindFilter={kindFilter}
        categoryOverrides={categoryOverrides}
        importing={importing}
        onToggle={(hash) => setSelected((prev) => { const next = new Set(prev); if (next.has(hash)) next.delete(hash); else next.add(hash); return next; })}
        onToggleAll={(checked) => setSelected(checked ? new Set(preview.transactions.map((t) => t.dedup_hash)) : new Set())}
        onKindFilter={setKindFilter}
        onCategoryOverride={(hash, cat) => setCategoryOverrides((prev) => ({ ...prev, [hash]: cat }))}
        onConfirm={() => void handleConfirm()}
        onCancel={reset}
      />
    );
  }

  // idle
  return (
    <FinanceSection title="Import z banku" subtitle="Pekao / PeoPay · mBank · ING · PKO · Santander · Revolut">
      <div
        role="button"
        tabIndex={0}
        aria-label="Wgraj plik CSV"
        className="mx-4 my-4 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border-custom/40 bg-surface-2/40 px-6 py-10 text-center transition-colors hover:border-primary/40 hover:bg-surface-2/70 cursor-pointer"
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      >
        <Upload size={28} className="text-text-muted" />
        <div>
          <p className="font-medium text-text-primary">Przeciągnij plik lub kliknij</p>
          <p className="mt-1 text-sm text-text-muted">CSV lub TXT z historią transakcji</p>
        </div>
        <input ref={inputRef} type="file" accept=".csv,.txt" className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>
      {fileError && (
        <p className="mx-4 mb-4 flex items-center gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertCircle size={15} className="shrink-0" />{fileError}
        </p>
      )}
      <div className="px-4 pb-4">
        <p className="text-xs text-text-muted">Plik przetwarzamy lokalnie — nigdzie nie jest wysyłany.</p>
      </div>
    </FinanceSection>
  );
}
