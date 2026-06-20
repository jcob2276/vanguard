import { Plus, Settings2, X } from 'lucide-react';
import { PRIORITY } from './todoUtils';
import { formatWarsawDate } from '../../lib/date';

interface TodoFormState {
  title: string;
  notes: string;
  priority: string;
  tagsText: string;
  due_date: string;
  recurrence: string;
  section_id: string;
}

interface TodoQuickCaptureProps {
  quickCaptureRef: React.RefObject<HTMLDivElement | null>;
  form: TodoFormState;
  setForm: React.Dispatch<React.SetStateAction<TodoFormState>>;
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  busy: boolean;
  addItem: () => void;
  sections: any[];
  parsedInput: { title: string; priority: string | null; due_date: string | null; tokens: Array<{ type: string; value: string; label: string }> };
  today: string;
}

export default function TodoQuickCapture({
  quickCaptureRef,
  form,
  setForm,
  isExpanded,
  setIsExpanded,
  busy,
  addItem,
  sections,
  parsedInput,
  today,
}: TodoQuickCaptureProps) {
  return (
    <div ref={quickCaptureRef} className="border-b border-border-custom/20 pb-3">
      <div className="flex items-center gap-2">
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
          onFocus={() => setIsExpanded(true)}
          placeholder="Nowe zadanie..."
          className="min-w-0 flex-1 bg-transparent py-2 text-[14px] font-medium text-text-primary outline-none placeholder:text-text-muted/25"
        />
        {form.title && (
          <button
            onClick={() => setForm({ ...form, title: '' })}
            className="p-1 text-text-muted/40 hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        )}
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="rounded-full border border-border-custom/60 text-text-muted hover:text-text-primary p-2 transition-colors shrink-0"
          >
            <Settings2 size={16} />
          </button>
        )}
        <button
          onClick={addItem}
          disabled={busy || !form.title.trim()}
          className="rounded-full bg-primary p-2 text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 disabled:opacity-35 transition-all shrink-0"
        >
          <Plus size={16} />
        </button>
      </div>

      {(isExpanded || form.title.trim() !== '') && (
        <div className="mt-3 space-y-3 border-t border-border-custom pt-3">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            placeholder="Opis... (podzadania: - [ ] krok)"
            className="w-full resize-none rounded-xl border border-border-custom/60 bg-surface-solid/50 px-3 py-2.5 text-[12px] font-medium text-text-primary outline-none placeholder:text-text-muted/30 focus:border-primary/30"
          />
          <div className="flex flex-wrap gap-3">
            {/* Section Selector */}
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <span className="text-[10px] font-semibold text-text-muted">Sekcja</span>
              <select
                value={form.section_id || ''}
                onChange={(e) => setForm({ ...form, section_id: e.target.value })}
                className="rounded-xl border border-border-custom/60 bg-surface-solid/50 px-2.5 py-2 text-[12px] font-semibold text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
              >
                <option value="">📥 Skrzynka (brak sekcji)</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Priority Buttons */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-text-muted">Priorytet</span>
              <div className="flex gap-1">
                {['urgent', 'high', 'normal', 'low'].map(p => {
                  const isSelected = (parsedInput.priority || form.priority) === p;
                  const meta = PRIORITY[p];
                  const labelMap: Record<string, string> = { urgent: 'P1', high: 'P2', normal: 'P3', low: 'P4' };
                  return (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className={`rounded-xl px-3 py-2 text-[11px] font-bold border transition-all ${
                        isSelected
                          ? `${meta.chip} border-current ring-1 ring-current`
                          : 'border-border-custom/60 text-text-muted hover:text-text-primary hover:bg-surface-solid'
                      }`}
                    >
                      {labelMap[p]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Due Date Selector */}
            <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
              <span className="text-[10px] font-semibold text-text-muted">Termin</span>
              <div className="flex gap-1 items-center">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, due_date: today }))}
                  className={`rounded-xl px-2.5 py-2 text-[11px] font-semibold border transition-all ${
                    (parsedInput.due_date || form.due_date) === today
                      ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
                      : 'border-border-custom/60 text-text-muted hover:text-text-primary hover:bg-surface-solid'
                  }`}
                >
                  Dziś
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const tomorrowStr = formatWarsawDate(tomorrow);
                    setForm(f => ({ ...f, due_date: tomorrowStr }));
                  }}
                  className={`rounded-xl px-2.5 py-2 text-[11px] font-semibold border transition-all ${
                    (parsedInput.due_date || form.due_date) === (() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      return formatWarsawDate(tomorrow);
                    })()
                      ? 'bg-sky-500/15 text-sky-500 border-sky-500/20'
                      : 'border-border-custom/60 text-text-muted hover:text-text-primary hover:bg-surface-solid'
                  }`}
                >
                  Jutro
                </button>
                <input
                  type="date"
                  value={parsedInput.due_date || form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="min-w-0 flex-1 rounded-xl border border-border-custom/60 bg-surface-solid/50 px-2 py-1.5 text-[11px] font-bold text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
                />
                {(parsedInput.due_date || form.due_date) && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, due_date: '' })}
                    className="p-1 text-text-muted hover:text-rose-500 transition-colors"
                    title="Wyczyść datę"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Recurrence Selector */}
            <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
              <span className="text-[10px] font-semibold text-text-muted">Powtarzanie</span>
              <select
                value={form.recurrence || ''}
                onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
                className="rounded-xl border border-border-custom/60 bg-surface-solid/50 px-2.5 py-2 text-[12px] font-semibold text-text-secondary outline-none focus:border-primary/30 cursor-pointer"
              >
                <option value="">Nigdy</option>
                <option value="daily">Codziennie</option>
                <option value="weekly">Co tydzień</option>
                <option value="monthly">Co miesiąc</option>
              </select>
            </div>

            {/* Tags Input */}
            <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
              <span className="text-[10px] font-semibold text-text-muted">Tagi</span>
              <input
                value={form.tagsText}
                onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
                placeholder="np. zakup, praca"
                className="min-w-0 rounded-xl border border-border-custom/60 bg-surface-solid/50 px-3 py-2 text-[12px] font-semibold text-text-primary outline-none placeholder:text-text-muted/30 focus:border-primary/30"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border-custom pt-3">
            <div>
              {parsedInput.tokens.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {parsedInput.tokens.map((token) => (
                    <span key={`${token.type}-${token.value}`}
                      className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                        token.type === 'priority' ? (PRIORITY[token.value]?.chip ?? 'bg-surface-solid text-text-muted') : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {token.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setIsExpanded(false); }}
                className="rounded-xl border border-border-custom/60 px-4 py-2 text-[12px] font-semibold text-text-muted hover:text-text-primary transition-colors"
              >
                Zwiń
              </button>
              <button
                type="button"
                onClick={addItem}
                disabled={busy || !form.title.trim()}
                className="rounded-xl bg-primary px-5 py-2 text-[12px] font-bold text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 disabled:opacity-35 transition-all"
              >
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
