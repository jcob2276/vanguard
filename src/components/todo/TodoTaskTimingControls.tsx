import { Bell, Calendar, CalendarClock, Repeat2 } from 'lucide-react';
import type { TodoItemRow } from '../../lib/todo/todo';
import { ControlInput, ControlSelect, Pressable } from '../ui/ControlPrimitives';
import TodoDatePickerPopover from './TodoDatePickerPopover';
import TodoReminderPopover from './TodoReminderPopover';

type OpenPopover = 'date' | 'reminder' | null;

interface Props {
  item: TodoItemRow;
  today: string;
  openPopover: OpenPopover;
  setOpenPopover: (value: OpenPopover) => void;
  onSetSchedule: (patch: { due_date?: string | null; scheduled_time?: string | null }) => void;
  onSetDeadline: (date: string | null) => void;
  onSetRecurrence: (recurrence: string | null) => void;
  onSetReminder: (dateTime: string) => void;
}

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Codziennie', weekdays: 'Dni robocze', weekly: 'Co tydzień',
  biweekly: 'Co 2 tyg.', monthly: 'Co miesiąc',
};

export default function TodoTaskTimingControls({
  item, today, openPopover, setOpenPopover,
  onSetSchedule, onSetDeadline, onSetRecurrence, onSetReminder,
}: Props) {
  return (
    <>
      <div className="relative">
        <Pressable type="button" onClick={() => setOpenPopover(openPopover === 'date' ? null : 'date')} className={`flex items-center gap-1.5 rounded-lg border border-border-custom/80 px-2.5 py-1 text-xs font-semibold ${item.due_date ? 'border-primary/30 bg-primary/5 text-primary' : 'text-text-secondary'}`}>
          <Calendar size={12} />
          {item.due_date ? `${item.due_date}${item.scheduled_time ? ` ${item.scheduled_time.slice(11, 16)}` : ''}` : 'Zaplanuj'}
        </Pressable>
        {openPopover === 'date' && <TodoDatePickerPopover dueDate={item.due_date} scheduledTime={item.scheduled_time?.slice(11, 16) || null} recurrence={item.recurrence} today={today} onChange={onSetSchedule} onClose={() => setOpenPopover(null)} />}
      </div>
      <div className="relative">
        <ControlInput type="date" min={item.due_date || undefined} value={item.deadline_date || ''} onChange={(event) => onSetDeadline(event.target.value || null)} aria-label="Termin końcowy" className="absolute inset-0 z-[var(--z-raised)] h-full w-full cursor-pointer opacity-[var(--opacity-0)]" />
        <Pressable className={`flex items-center gap-1.5 rounded-lg border border-border-custom/80 px-2.5 py-1 text-xs font-semibold ${item.deadline_date ? 'border-danger/25 bg-danger/5 text-danger' : 'text-text-secondary'}`}>
          <CalendarClock size={12} /> {item.deadline_date ? `Do ${item.deadline_date}` : 'Deadline'}
        </Pressable>
      </div>
      <div className="relative">
        <ControlSelect value={item.recurrence || ''} onChange={(event) => onSetRecurrence(event.target.value || null)} aria-label="Powtarzanie" className="absolute inset-0 z-[var(--z-raised)] h-full w-full cursor-pointer opacity-[var(--opacity-0)]">
          <option value="">Nie powtarzaj</option><option value="daily">Codziennie</option><option value="weekdays">W dni robocze</option><option value="weekly">Co tydzień</option><option value="biweekly">Co 2 tygodnie</option><option value="monthly">Co miesiąc</option>
        </ControlSelect>
        <Pressable className={`flex items-center gap-1.5 rounded-lg border border-border-custom/80 px-2.5 py-1 text-xs font-semibold ${item.recurrence ? 'border-primary/30 bg-primary/5 text-primary' : 'text-text-secondary'}`}>
          <Repeat2 size={12} /> {item.recurrence ? RECURRENCE_LABELS[item.recurrence] : 'Powtarzanie'}
        </Pressable>
      </div>
      <div className="relative">
        <Pressable type="button" onClick={() => setOpenPopover(openPopover === 'reminder' ? null : 'reminder')} className={`flex items-center gap-1.5 rounded-lg border border-border-custom/80 px-2.5 py-1 text-xs font-semibold ${item.reminder_at ? 'border-primary/30 bg-primary/5 text-primary' : 'text-text-secondary'}`}>
          <Bell size={12} /> {item.reminder_at ? new Date(item.reminder_at).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Przypomnienie'}
        </Pressable>
        {openPopover === 'reminder' && <TodoReminderPopover dueDate={item.due_date} scheduledTime={item.scheduled_time?.slice(11, 16) || null} onSetReminder={onSetReminder} onClose={() => setOpenPopover(null)} />}
      </div>
    </>
  );
}
