import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Calendar, ChevronDown, Flag, Folder, ScanText, SlidersHorizontal, Tag, X } from 'lucide-react';
import Button from '../ui/Button';
import { ControlInput, ControlSelect, ControlTextarea, Pressable } from '../ui/ControlPrimitives';
import NlpHighlightInput from './NlpHighlightInput';
import TodoDatePickerPopover from './TodoDatePickerPopover';
import TodoReminderPopover from './TodoReminderPopover';

interface TodoFormState {
  title: string; notes: string; priority: string; tagsText: string; due_date: string;
  recurrence: string; section_id: string; scheduled_time: string; reminder_at: string;
}

interface Props {
  quickCaptureRef: React.RefObject<HTMLDivElement | null>;
  form: TodoFormState;
  setForm: React.Dispatch<React.SetStateAction<TodoFormState>>;
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
  busy: boolean;
  addItem: () => void;
  sections: { id: string; name: string }[];
  parsedInput: {
    title: string; priority: string | null; due_date: string | null; scheduled_time: string | null;
    recurrence?: string | null; tokens: Array<{ type: string; value: string; label: string }>;
  };
  today: string;
  onOpenScanText?: () => void;
}

const EMPTY_FORM: TodoFormState = {
  title: '', notes: '', priority: 'normal', tagsText: '', due_date: '', recurrence: '',
  section_id: '', scheduled_time: '', reminder_at: '',
};

function priorityLabel(priority: string) {
  if (priority === 'urgent') return 'P1';
  if (priority === 'high') return 'P2';
  if (priority === 'normal') return 'P3';
  return 'P4';
}

export default function TodoQuickCapture({
  quickCaptureRef, form, setForm, isExpanded, setIsExpanded, busy, addItem,
  sections, parsedInput, today, onOpenScanText,
}: Props) {
  const [openPopover, setOpenPopover] = useState<'date' | 'reminder' | null>(null);
  const [showDetails, setShowDetails] = useState(Boolean(form.notes || form.tagsText || form.reminder_at));
  const dueDate = parsedInput.due_date || form.due_date || '';
  const priority = parsedInput.priority || form.priority;
  const scheduledTime = parsedInput.scheduled_time || form.scheduled_time || '';
  const recurrence = parsedInput.recurrence || form.recurrence || '';
  const sectionName = sections.find((section) => section.id === form.section_id)?.name || 'Skrzynka';

  useEffect(() => {
    if (!isExpanded) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsExpanded(false); };
    window.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = '';
    };
  }, [isExpanded, setIsExpanded]);

  if (!isExpanded || typeof document === 'undefined') return null;

  const cancel = () => {
    setForm(EMPTY_FORM);
    setIsExpanded(false);
  };

  const content = (
    <div className="fixed bottom-0 left-0 right-0 top-0 z-overlay bg-scrim/35 backdrop-blur-md" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsExpanded(false); }}>
      <section
        ref={quickCaptureRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="todo-create-title"
        className="absolute inset-x-0 bottom-0 flex max-h-dvh flex-col overflow-hidden rounded-t-3xl border border-border-custom/50 bg-surface-1 shadow-float md:bottom-auto md:left-1/2 md:right-auto md:top-1/2 md:w-full md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong md:hidden" />
        <header className="flex items-center justify-between px-5 pb-3 pt-4 md:px-6">
          <div>
            <p className="text-2xs font-black uppercase tracking-widest text-primary">Szybkie dodawanie</p>
            <h2 id="todo-create-title" className="mt-0.5 font-display text-xl font-black tracking-tight text-text-primary">Nowe zadanie</h2>
          </div>
          <Pressable onClick={() => setIsExpanded(false)} aria-label="Zamknij" className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-tonal text-text-secondary hover:text-text-primary">
            <X size={20} />
          </Pressable>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-6 md:pb-6">
          <div className="rounded-2xl border border-primary/20 bg-surface-solid p-4 shadow-md focus-within:border-primary/50 focus-within:shadow-lg">
            <label htmlFor="todo-title-input" className="text-xs font-bold text-text-secondary">Co chcesz zrobić?</label>
            <NlpHighlightInput
              id="todo-title-input"
              value={form.title}
              onChange={(value) => setForm({ ...form, title: value })}
              onKeyDown={(event) => { if (event.key === 'Enter' && form.title.trim()) addItem(); }}
              placeholder="Np. zadzwonić do Marka jutro o 10 p1"
              className="min-h-14 w-full bg-transparent text-lg font-bold leading-snug tracking-tight text-text-primary placeholder:text-text-muted/45"
            />
            <p className="mt-1 text-2xs font-medium text-text-muted">Możesz wpisać datę, godzinę i priorytet zwykłym językiem.</p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="relative">
              <Pressable onClick={() => setOpenPopover((value) => value === 'date' ? null : 'date')} className={`flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold ${dueDate ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border-custom bg-surface-solid text-text-secondary'}`}>
                <Calendar size={15} /><span className="truncate">{dueDate ? `${dueDate}${scheduledTime ? ` · ${scheduledTime}` : ''}` : 'Termin'}</span>
              </Pressable>
              {openPopover === 'date' ? <TodoDatePickerPopover dueDate={dueDate || null} scheduledTime={scheduledTime || null} recurrence={form.recurrence || null} today={today} onChange={(patch) => setForm((current) => ({ ...current, ...(patch.due_date !== undefined ? { due_date: patch.due_date || '' } : {}), ...(patch.scheduled_time !== undefined ? { scheduled_time: patch.scheduled_time || '' } : {}), ...(patch.recurrence !== undefined ? { recurrence: patch.recurrence || '' } : {}) }))} onClose={() => setOpenPopover(null)} /> : null}
            </div>

            <div className="relative">
              <ControlSelect value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className="absolute inset-0 z-[var(--z-raised)] h-full w-full cursor-pointer opacity-[var(--opacity-0)]" aria-label="Priorytet">
                <option value="urgent">Priorytet 1</option><option value="high">Priorytet 2</option><option value="normal">Priorytet 3</option><option value="low">Priorytet 4</option>
              </ControlSelect>
              <Pressable className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border-custom bg-surface-solid px-2 text-xs font-bold text-text-secondary">
                <Flag size={15} className={priority === 'urgent' ? 'text-danger' : priority === 'high' ? 'text-warning' : priority === 'normal' ? 'text-info' : 'text-text-muted'} />{priorityLabel(priority)}
              </Pressable>
            </div>

            <div className="relative">
              <ControlSelect value={form.section_id || ''} onChange={(event) => setForm({ ...form, section_id: event.target.value })} className="absolute inset-0 z-[var(--z-raised)] h-full w-full cursor-pointer opacity-[var(--opacity-0)]" aria-label="Sekcja">
                <option value="">Skrzynka</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
              </ControlSelect>
              <Pressable className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border-custom bg-surface-solid px-2 text-xs font-bold text-text-secondary">
                <Folder size={15} /><span className="truncate">{sectionName}</span><ChevronDown size={12} />
              </Pressable>
            </div>
          </div>

          <Pressable onClick={() => setShowDetails((value) => !value)} className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-bold text-text-secondary hover:bg-surface-tonal">
            <span className="flex items-center gap-2"><SlidersHorizontal size={16} /> Szczegóły</span><ChevronDown size={15} className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />
          </Pressable>

          {showDetails ? (
            <div className="animate-in fade-in space-y-3 rounded-xl bg-surface-tonal p-3">
              <ControlTextarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} placeholder="Notatka lub kontekst…" className="w-full resize-y rounded-xl border border-border-custom bg-surface-solid px-3 py-3 text-sm text-text-primary placeholder:text-text-muted" />
              <div className="flex items-center gap-2 rounded-xl border border-border-custom bg-surface-solid px-3">
                <Tag size={15} className="text-text-muted" /><ControlInput value={form.tagsText} onChange={(event) => setForm({ ...form, tagsText: event.target.value })} placeholder="Tagi, oddzielone przecinkami" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-text-primary" />
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Pressable onClick={() => setOpenPopover((value) => value === 'reminder' ? null : 'reminder')} className="flex min-h-11 items-center gap-2 rounded-xl border border-border-custom bg-surface-solid px-3 text-xs font-bold text-text-secondary"><Bell size={15} /> {form.reminder_at ? 'Przypomnienie ustawione' : 'Przypomnienie'}</Pressable>
                  {openPopover === 'reminder' ? <TodoReminderPopover dueDate={form.due_date || null} scheduledTime={form.scheduled_time || null} onSetReminder={(iso) => setForm((current) => ({ ...current, reminder_at: iso }))} onClose={() => setOpenPopover(null)} /> : null}
                </div>
                {onOpenScanText ? <Pressable onClick={onOpenScanText} className="flex min-h-11 items-center gap-2 rounded-xl border border-border-custom bg-surface-solid px-3 text-xs font-bold text-primary"><ScanText size={15} /> Skanuj tekst</Pressable> : null}
                {recurrence ? <span className="flex min-h-11 items-center rounded-xl bg-primary/10 px-3 text-xs font-bold text-primary">Powtarzanie: {recurrence}</span> : null}
              </div>
            </div>
          ) : null}
        </div>

        <footer className="flex items-center gap-2 border-t border-border-custom/50 bg-surface-1/95 px-4 py-3 backdrop-blur-xl md:px-6">
          <Button variant="ghost" size="lg" onClick={cancel} className="shrink-0">Anuluj</Button>
          <Button size="lg" onClick={addItem} disabled={busy || !form.title.trim()} loading={busy} className="min-h-12 flex-1">Dodaj zadanie</Button>
        </footer>
      </section>
    </div>
  );

  return createPortal(content, document.body);
}
