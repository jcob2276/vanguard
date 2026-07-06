import { useState } from 'react';
import { X, ScanText, Sparkles, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createTodoItem } from '../../lib/todo';
import type { TodoItemRow } from './useTodoData';

interface ExtractedTask {
  title: string;
  due_date: string | null;
  priority: string | null;
  selected: boolean;
}

interface TodoScanTextModalProps {
  userId: string;
  sectionId: string | null;
  onClose: () => void;
  onCreated: (items: TodoItemRow[]) => void;
}

export default function TodoScanTextModal({ userId, sectionId, onClose, onCreated }: TodoScanTextModalProps) {
  const [text, setText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tasks, setTasks] = useState<ExtractedTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processText = async () => {
    if (!text.trim() || extracting) return;
    setExtracting(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('vanguard-todo-extract', {
        body: { text, userId },
      });
      if (fnError) throw fnError;
      const extracted: ExtractedTask[] = (data?.tasks || []).map((t: any) => ({
        title: t.title,
        due_date: t.due_date ?? null,
        priority: t.priority ?? null,
        selected: true,
      }));
      if (!extracted.length) setError('Nie znaleziono żadnych zadań w tym tekście.');
      setTasks(extracted);
    } catch (err: unknown) {
      setError(err instanceof Error ? (err as Error).message : String(err));
    } finally {
      setExtracting(false);
    }
  };

  const addSelected = async () => {
    if (!tasks || creating) return;
    const selected = tasks.filter((t) => t.selected);
    if (!selected.length) return;
    setCreating(true);
    try {
      const created = await Promise.all(selected.map((t) => createTodoItem(userId, {
        title: t.title,
        due_date: t.due_date || undefined,
        priority: t.priority || undefined,
        section_id: sectionId || undefined,
      })));
      onCreated(created);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? (err as Error).message : String(err));
      setCreating(false);
    }
  };

  const toggleTask = (idx: number) => {
    setTasks((prev) => prev ? prev.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t) : prev);
  };

  const selectedCount = tasks?.filter((t) => t.selected).length ?? 0;

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-full max-w-md bg-surface/95 border border-border-custom rounded-3xl p-6 shadow-2xl backdrop-blur-xl flex flex-col gap-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanText size={17} className="text-indigo-400" />
            <h3 className="text-[15px] font-bold text-text-primary">Skan Tekstu</h3>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-500">Beta</span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {!tasks ? (
          <>
            <div className="relative">
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder="Wklej lub wpisz swój tekst"
                className="w-full resize-none rounded-2xl border border-border-custom/60 bg-surface-solid/40 p-3 text-[13px] font-medium text-text-primary outline-none placeholder:text-text-muted/40 focus:border-primary/30"
              />
            </div>
            <div className="rounded-2xl bg-surface-solid/30 border border-border-custom/30 p-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-text-muted/70">Dodaj tekst z dowolnego miejsca. AI wyodrębni Twoje zadania.</p>
              {['Transkrypcje z notatek ze spotkań', 'Rozbudowane plany projektów', 'Fragmenty tekstu z Twoich e-maili i czatu'].map((hint) => (
                <p key={hint} className="flex items-center gap-2 text-[11px] text-text-muted/50">
                  <span className="h-1 w-1 rounded-full bg-text-muted/40 shrink-0" /> {hint}
                </p>
              ))}
            </div>
            {error && <p className="text-[11px] font-semibold text-rose-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="todoist-btn-secondary">Anuluj</button>
              <button
                onClick={processText}
                disabled={extracting || !text.trim()}
                className="flex items-center gap-1.5 todoist-btn-primary disabled:opacity-40"
              >
                {extracting ? <span className="animate-pulse">Przetwarzam…</span> : <><Sparkles size={13} /> Przetwórz tekst</>}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="max-h-[320px] overflow-y-auto space-y-1.5">
              {tasks.map((t, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleTask(idx)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all ${
                    t.selected ? 'border-primary/30 bg-primary/5' : 'border-border-custom/40 bg-surface-solid/20 opacity-50'
                  }`}
                >
                  <div className={`h-4 w-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${t.selected ? 'bg-primary border-primary' : 'border-border-custom'}`}>
                    {t.selected && <Check size={10} className="text-white" strokeWidth={3} />}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-text-primary">{t.title}</span>
                  {t.due_date && <span className="shrink-0 text-[10px] font-bold text-primary/70">{t.due_date}</span>}
                </button>
              ))}
            </div>
            {error && <p className="text-[11px] font-semibold text-rose-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setTasks(null)} className="todoist-btn-secondary">Wstecz</button>
              <button
                onClick={addSelected}
                disabled={creating || selectedCount === 0}
                className="todoist-btn-primary disabled:opacity-40"
              >
                {creating ? 'Dodaję…' : `Dodaj zadania (${selectedCount})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
