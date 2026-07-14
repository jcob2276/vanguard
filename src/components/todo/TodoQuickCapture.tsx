import { useState } from 'react';
import { Calendar, Flag, Tag, Folder, ChevronDown, Bell, Repeat, ScanText } from 'lucide-react';
import TodoDatePickerPopover from './TodoDatePickerPopover';
import TodoReminderPopover from './TodoReminderPopover';
import NlpHighlightInput from './NlpHighlightInput';
import { Card } from '../ui/Card';

interface TodoFormState {
  title: string;
  notes: string;
  priority: string;
  tagsText: string;
  due_date: string;
  recurrence: string;
  section_id: string;
  scheduled_time: string;
  reminder_at: string;
}

interface TodoQuickCaptureProps {
  quickCaptureRef: React.RefObject<HTMLDivElement | null>;
  form: TodoFormState;
  setForm: React.Dispatch<React.SetStateAction<TodoFormState>>;
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  busy: boolean;
  addItem: () => void;
  sections: { id: string; name: string }[];
  parsedInput: {
    title: string;
    priority: string | null;
    due_date: string | null;
    scheduled_time: string | null;
    recurrence?: string | null;
    tokens: Array<{ type: string; value: string; label: string }>;
  };
  today: string;
  onOpenScanText?: () => void;
}

export default function TodoQuickCapture({
  quickCaptureRef,
  form,
  setForm,
  setIsExpanded,
  busy,
  addItem,
  sections,
  parsedInput,
  today,
  onOpenScanText,
}: TodoQuickCaptureProps) {
  const [openPopover, setOpenPopover] = useState<'date' | 'reminder' | null>(null);

  // Live preview: NLP tokens parsed straight from the typed title (e.g. "jutro o 12:15 p1")
  // take precedence over explicit chip picks, mirroring the same precedence addItem() commits with.
  const effectiveDueDate = parsedInput.due_date || form.due_date || '';
  const effectivePriority = parsedInput.priority || form.priority;
  const effectiveScheduledTime = parsedInput.scheduled_time || form.scheduled_time || '';
  const effectiveRecurrence = parsedInput.recurrence || form.recurrence || '';

  return (
    <div ref={quickCaptureRef}>
    <Card className="border border-border-custom bg-surface-solid/40 flex flex-col gap-4.5 shadow-lg" padding="1.125rem">
      {/* Title & Description inputs */}
      <div className="flex flex-col gap-1.5">
        <NlpHighlightInput
          value={form.title}
          onChange={(val) => setForm({ ...form, title: val })}
          onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
          onFocus={() => setIsExpanded(true)}
          placeholder="Nazwa zadania"
          className="w-full bg-transparent text-[13px] font-semibold text-text-primary outline-none placeholder:text-text-muted/40"
        />
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
          placeholder="Opis"
          className="w-full resize-none bg-transparent text-[12px] font-medium text-text-secondary outline-none placeholder:text-text-muted/40"
        />
      </div>

      {/* Button chips row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date Button + popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenPopover((p) => p === 'date' ? null : 'date')}
            className={`flex items-center gap-1.5 rounded-lg border border-border-custom/80 px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:bg-text-primary/[0.04] transition-all ${effectiveDueDate ? 'text-primary border-primary/30 bg-primary/5' : ''}`}
          >
            <Calendar size={12} className={effectiveDueDate ? 'text-primary' : 'text-text-muted/60'} />
            <span>{effectiveDueDate ? `${effectiveDueDate}${effectiveScheduledTime ? ` ${effectiveScheduledTime}` : ''}` : 'Termin'}</span>
            {effectiveRecurrence && <Repeat size={11} className="text-primary" />}
          </button>
          {openPopover === 'date' && (
            <TodoDatePickerPopover
              dueDate={effectiveDueDate || null}
              scheduledTime={effectiveScheduledTime || null}
              recurrence={form.recurrence || null}
              today={today}
              onChange={(patch) => setForm((f) => ({
                ...f,
                ...(patch.due_date !== undefined ? { due_date: patch.due_date || '' } : {}),
                ...(patch.scheduled_time !== undefined ? { scheduled_time: patch.scheduled_time || '' } : {}),
                ...(patch.recurrence !== undefined ? { recurrence: patch.recurrence || '' } : {}),
              }))}
              onClose={() => setOpenPopover(null)}
            />
          )}
        </div>

        {/* Priority Selector */}
        <div className="relative">
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
          >
            <option value="urgent">🚩 Priorytet 1 (P1)</option>
            <option value="high">🚩 Priorytet 2 (P2)</option>
            <option value="normal">🚩 Priorytet 3 (P3)</option>
            <option value="low">🚩 Priorytet 4 (P4)</option>
          </select>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-border-custom/80 px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:bg-text-primary/[0.04] transition-all"
          >
            <Flag size={12} className={effectivePriority === 'urgent' ? 'text-danger' : effectivePriority === 'high' ? 'text-warning' : effectivePriority === 'normal' ? 'text-info' : 'text-text-muted/60'} />
            <span>
              {effectivePriority === 'urgent' ? 'P1' : effectivePriority === 'high' ? 'P2' : effectivePriority === 'normal' ? 'P3' : 'P4'}
            </span>
          </button>
        </div>

        {/* Reminder Button + popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenPopover((p) => p === 'reminder' ? null : 'reminder')}
            className={`flex items-center gap-1.5 rounded-lg border border-border-custom/80 px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:bg-text-primary/[0.04] transition-all ${form.reminder_at ? 'text-primary border-primary/30 bg-primary/5' : ''}`}
          >
            <Bell size={12} className={form.reminder_at ? 'text-primary' : 'text-text-muted/60'} />
            <span>
              {form.reminder_at
                ? new Date(form.reminder_at).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : 'Przypomnienia'}
            </span>
          </button>
          {openPopover === 'reminder' && (
            <TodoReminderPopover
              dueDate={form.due_date || null}
              scheduledTime={form.scheduled_time || null}
              onSetReminder={(iso) => setForm((f) => ({ ...f, reminder_at: iso }))}
              onClose={() => setOpenPopover(null)}
            />
          )}
        </div>

        {/* Tags input chip */}
        <div className="flex items-center gap-1 border border-border-custom/80 rounded-lg px-2.5 py-0.5 max-w-[150px]">
          <Tag size={11} className="text-text-muted/60" />
          <input
            value={form.tagsText}
            onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
            placeholder="Tagi"
            className="bg-transparent text-[11px] font-semibold text-text-secondary outline-none w-full"
          />
        </div>

        {/* Skan Tekstu trigger */}
        {onOpenScanText && (
          <button
            type="button"
            onClick={onOpenScanText}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-primary/30 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10 transition-all"
          >
            <ScanText size={12} />
            <span>Skan tekstu</span>
          </button>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-between border-t border-border-custom/80 pt-3 mt-1.5">
        {/* Left: Section Selector Dropdown */}
        <div className="relative flex items-center">
          <select
            value={form.section_id || ''}
            onChange={(e) => setForm({ ...form, section_id: e.target.value })}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
          >
            <option value="">Skrzynka</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="flex items-center gap-1 px-2.5 py-1 text-[12px] font-semibold text-text-secondary hover:text-text-primary hover:bg-text-primary/[0.04] rounded-lg transition-all"
          >
            <Folder size={13} className="text-text-muted/60" />
            <span>
              {sections.find(s => s.id === form.section_id)?.name || 'Skrzynka'}
            </span>
            <ChevronDown size={11} className="text-text-muted/60" />
          </button>
        </div>

        {/* Right: Cancel & Add buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setForm({ title: '', notes: '', priority: 'normal', tagsText: '', due_date: '', recurrence: '', section_id: '', scheduled_time: '', reminder_at: '' });
              setIsExpanded(false);
            }}
            className="todoist-btn-secondary"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={addItem}
            disabled={busy || !form.title.trim()}
            className="todoist-btn-primary"
          >
            Dodaj zadanie
          </button>
        </div>
      </div>
    </Card>
    </div>
  );
}
