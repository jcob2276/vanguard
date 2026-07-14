import { Pressable, ControlTextarea } from '../ui/ControlPrimitives';
import { useState } from 'react';
import { ScanText, Sparkles, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createTodoItem } from '../../lib/todo/todo';
import type { TodoItemRow } from './useTodoData';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';

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
      const { data, error: fnError } = await supabase.functions.invoke('vanguard-auto-classify?action=todo-extract', {
        body: { text, userId },
      });
      if (fnError) throw fnError;
      const extracted: ExtractedTask[] = (data?.tasks || []).map((t: { title: string; due_date?: string | null; priority?: string | null }) => ({
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
    <Modal
      isOpen
      onClose={onClose}
      showCloseButton={false}
      size="sm"
    >
      <div className="flex items-center gap-2 mb-1">
        <ScanText size={17} className="text-primary" />
        <h3 className="text-base font-bold text-text-primary">Skan Tekstu</h3>
        <Badge variant="tag" color="var(--color-success)" className="tracking-wider">Beta</Badge>
      </div>

      {!tasks ? (
        <>
          <div className="relative">
            <ControlTextarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Wklej lub wpisz swój tekst"
              className="w-full resize-none rounded-2xl border border-border-custom/60 bg-surface-solid/40 p-3 text-sm font-medium text-text-primary outline-none placeholder:text-text-muted/40 focus:border-primary/30"
            />
          </div>
          <div className="rounded-2xl bg-surface-solid/30 border border-border-custom/30 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-text-muted/70">Dodaj tekst z dowolnego miejsca. AI wyodrębni Twoje zadania.</p>
            {['Transkrypcje z notatek ze spotkań', 'Rozbudowane plany projektów', 'Fragmenty tekstu z Twoich e-maili i czatu'].map((hint) => (
              <p key={hint} className="flex items-center gap-2 text-xs text-text-muted/50">
                <span className="h-1 w-1 rounded-full bg-text-muted/40 shrink-0" /> {hint}
              </p>
            ))}
          </div>
          {error && <p className="text-xs font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Pressable onClick={onClose} variant="ghost" size="sm">Anuluj</Pressable>
            <Pressable
              onClick={processText}
              disabled={extracting || !text.trim()}
              loading={extracting}
              icon={!extracting ? <Sparkles size={13} /> : undefined}
              size="sm"
            >
              {extracting ? 'Przetwarzam…' : 'Przetwórz tekst'}
            </Pressable>
          </div>
        </>
      ) : (
        <>
          <div className="max-h-[var(--legacy-h-023)] overflow-y-auto space-y-1.5">
            {tasks.map((t, idx) => (
              <Pressable
                key={idx}
                type="button"
                onClick={() => toggleTask(idx)}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all ${
                  t.selected ? 'border-primary/30 bg-primary/5' : 'border-border-custom/40 bg-surface-solid/20 opacity-[var(--opacity-50)]'
                }`}
              >
                <div className={`h-4 w-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${t.selected ? 'bg-primary border-primary' : 'border-border-custom'}`}>
                  {t.selected && <Check size={10} className="text-on-accent" strokeWidth={3} />}
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">{t.title}</span>
                {t.due_date && <span className="shrink-0 text-xs font-bold text-primary/70">{t.due_date}</span>}
              </Pressable>
            ))}
          </div>
          {error && <p className="text-xs font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Pressable onClick={() => setTasks(null)} variant="ghost" size="sm">Wstecz</Pressable>
            <Pressable
              onClick={addSelected}
              disabled={creating || selectedCount === 0}
              loading={creating}
              size="sm"
            >
              {creating ? 'Dodaję…' : `Dodaj zadania (${selectedCount})`}
            </Pressable>
          </div>
        </>
      )}
    </Modal>
  );
}
