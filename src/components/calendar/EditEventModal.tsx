import { CalendarDays, Clock, Repeat2, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import { ControlInput, ControlTextarea } from '../ui/ControlPrimitives';
import Modal from '../ui/Modal';
import { useCalendarData } from './hooks/useCalendarData';
import CategoryPicker from './CategoryPicker';
import RecurrencePicker from './RecurrencePicker';

interface Props {
  calData: ReturnType<typeof useCalendarData>;
  handleEditSave: () => void;
}

export function EditEventModal({ calData, handleEditSave }: Props) {
  const {
    selectedEvent, setSelectedEvent, editTitle, setEditTitle, editCategory, setEditCategory,
    editStart, setEditStart, editEnd, setEditEnd, editDate, setEditDate,
    editDescription, setEditDescription, editRecurrence, setEditRecurrence,
    editCustomDays, setEditCustomDays, editRecurrenceEndDate, setEditRecurrenceEndDate,
    saving, handleEditDelete,
  } = calData;
  const isSeries = Boolean(selectedEvent?.series_id || selectedEvent?.recurrence?.length);

  return (
    <Modal isOpen={Boolean(selectedEvent)} onClose={() => setSelectedEvent(null)} title="Edytuj wydarzenie" size="md">
      {isSeries ? (
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
          <Repeat2 size={15} /> Edytujesz całą serię wydarzeń
        </div>
      ) : null}

      <div>
        <label htmlFor="calendar-event-title" className="text-xs font-bold text-text-secondary">Nazwa wydarzenia</label>
        <ControlInput id="calendar-event-title" autoFocus value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Tytuł wydarzenia" className="mt-1.5 min-h-12 w-full rounded-xl border border-border-custom bg-surface-solid px-4 text-base font-bold text-text-primary focus:border-primary/50" />
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border-custom bg-surface-tonal p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-text-muted"><Clock size={14} /> Kiedy</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="space-y-1 text-xs font-bold text-text-secondary">
            <span className="flex items-center gap-1"><CalendarDays size={12} /> Data</span>
            <ControlInput type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} className="min-h-11 w-full rounded-xl border border-border-custom bg-surface-solid px-3 text-sm font-semibold text-text-primary" />
          </label>
          <label className="space-y-1 text-xs font-bold text-text-secondary">
            <span>Od</span>
            <ControlInput type="time" value={editStart} onChange={(event) => setEditStart(event.target.value)} className="min-h-11 w-full rounded-xl border border-border-custom bg-surface-solid px-3 text-sm font-semibold text-text-primary" />
          </label>
          <label className="space-y-1 text-xs font-bold text-text-secondary">
            <span>Do</span>
            <ControlInput type="time" value={editEnd} onChange={(event) => setEditEnd(event.target.value)} className="min-h-11 w-full rounded-xl border border-border-custom bg-surface-solid px-3 text-sm font-semibold text-text-primary" />
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="calendar-event-description" className="text-xs font-bold text-text-secondary">Notatka</label>
        <ControlTextarea id="calendar-event-description" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={3} placeholder="Kontekst, miejsce lub przygotowanie…" className="mt-1.5 w-full resize-y rounded-xl border border-border-custom bg-surface-solid px-3 py-3 text-sm text-text-primary placeholder:text-text-muted" />
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold text-text-secondary">Obszar życia</span>
        <CategoryPicker selected={editCategory} onSelect={setEditCategory} />
      </div>

      <RecurrencePicker recurrence={editRecurrence} setRecurrence={setEditRecurrence} customDays={editCustomDays} setCustomDays={setEditCustomDays} endDate={editRecurrenceEndDate} setEndDate={setEditRecurrenceEndDate} minDate={editDate} />

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={handleEditDelete} icon={<Trash2 size={17} />} aria-label="Usuń wydarzenie" className="min-h-12 w-12 border-danger/20 text-danger hover:bg-danger/10" />
        <Button onClick={handleEditSave} disabled={saving || !editTitle.trim() || !editDate || !editStart || !editEnd || (editRecurrence === 'custom' && editCustomDays.length === 0)} loading={saving} size="lg" className="min-h-12 flex-1">Zapisz zmiany</Button>
      </div>
    </Modal>
  );
}
