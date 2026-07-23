import React from 'react';
import { CalendarDays, Clock, Repeat2, Trash2, MapPin, Bell, AlignLeft } from 'lucide-react';
import Button from '../ui/Button';
import { ControlInput, ControlSelect, ControlTextarea } from '../ui/ControlPrimitives';
import Modal from '../ui/Modal';
import { useCalendarData } from './hooks/useCalendarData';
import CategoryPicker from './CategoryPicker';
import RecurrencePicker from './RecurrencePicker';
import CalendarConflictNotice from './CalendarConflictNotice';
import { findCalendarConflicts } from '../../lib/calendarConflicts';
import EventContextCard from './EventContextCard';

interface Props {
  calData: ReturnType<typeof useCalendarData>;
  handleEditSave: () => void;
}

export function EditEventModal({ calData, handleEditSave }: Props) {
  const {
    selectedEvent, setSelectedEvent, editTitle, setEditTitle, editCategory, setEditCategory,
    editStart, setEditStart, editEnd, setEditEnd, editDate, setEditDate,
    editDescription, setEditDescription, editLocation, setEditLocation,
    editAllDay, setEditAllDay, editReminder, setEditReminder,
    editRecurrence, setEditRecurrence,
    editCustomDays, setEditCustomDays, editRecurrenceEndDate, setEditRecurrenceEndDate,
    saving, handleEditDelete,
  } = calData;

  const isSeries = Boolean(selectedEvent?.series_id || selectedEvent?.recurrence?.length);
  const startMs = new Date(`${editDate}T${editStart || '00:00'}:00`).getTime();
  const endMs = new Date(`${editDate}T${editEnd || '00:00'}:00`).getTime();
  const conflicts = findCalendarConflicts(calData.events, startMs, endMs, selectedEvent?.id);

  return (
    <Modal isOpen={Boolean(selectedEvent)} onClose={() => setSelectedEvent(null)} title="Edytuj wydarzenie" size="md">
      {selectedEvent && (
        <div className="space-y-4">
          {isSeries && (
            <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
              <Repeat2 size={15} /> Edytujesz całą serię wydarzeń
            </div>
          )}

          {/* Title Input */}
          <ControlInput
            id="calendar-event-title"
            autoFocus
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            placeholder="Tytuł wydarzenia…"
            className="min-h-12 w-full rounded-xl border border-border-custom/40 bg-surface-solid/40 px-4 text-base font-bold tracking-tight text-text-primary focus:border-primary/50 placeholder:text-text-muted/40 transition-colors"
          />

          <CalendarConflictNotice titles={conflicts.map((event) => event.summary || 'Wydarzenie')} />
          <EventContextCard
            eventId={selectedEvent.event_id || selectedEvent.id}
            title={selectedEvent.summary || editTitle}
          />

          {/* Date & Time Picker Card */}
          <div className="rounded-xl border border-border-custom/30 bg-surface-solid/30 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-text-muted"><Clock size={14} /> Kiedy</span>
              <label className="flex items-center gap-2 text-xs font-bold text-text-muted cursor-pointer select-none">
                <ControlInput
                  type="checkbox"
                  checked={editAllDay}
                  onChange={(e) => setEditAllDay(e.target.checked)}
                  className="rounded border-border-custom text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                />
                Całodniowe
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1 text-xs font-bold text-text-secondary">
                <span className="flex items-center gap-1 text-text-muted"><CalendarDays size={12} /> Data</span>
                <ControlInput type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} className="h-9 w-full rounded-lg border border-border-custom/40 bg-surface-solid/50 px-2.5 text-xs font-semibold text-text-primary" />
              </label>
              <label className="space-y-1 text-xs font-bold text-text-secondary">
                <span className="text-text-muted">Od</span>
                <ControlInput type="time" disabled={editAllDay} value={editStart} onChange={(event) => setEditStart(event.target.value)} className="h-9 w-full rounded-lg border border-border-custom/40 bg-surface-solid/50 px-2.5 text-xs font-semibold text-text-primary disabled:opacity-[var(--opacity-dimmed)]" />
              </label>
              <label className="space-y-1 text-xs font-bold text-text-secondary">
                <span className="text-text-muted">Do</span>
                <ControlInput type="time" disabled={editAllDay} value={editEnd} onChange={(event) => setEditEnd(event.target.value)} className="h-9 w-full rounded-lg border border-border-custom/40 bg-surface-solid/50 px-2.5 text-xs font-semibold text-text-primary disabled:opacity-[var(--opacity-dimmed)]" />
              </label>
            </div>
          </div>

          {/* Location Input */}
          <div className="relative flex items-center">
            <MapPin size={14} className="absolute left-3.5 text-text-muted pointer-events-none" />
            <ControlInput
              id="calendar-event-location"
              value={editLocation}
              onChange={(event) => setEditLocation(event.target.value)}
              placeholder="Lokalizacja / Miejsce (opcjonalnie)…"
              className="w-full rounded-xl border border-border-custom/40 bg-surface-solid/30 pl-9 pr-3 py-2 text-xs font-medium text-text-primary placeholder:text-text-muted/50"
            />
          </div>

          {/* Description Input */}
          <div className="relative flex items-start">
            <AlignLeft size={14} className="absolute left-3.5 top-3 text-text-muted pointer-events-none" />
            <ControlTextarea
              id="calendar-event-description"
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              rows={2}
              placeholder="Notatka lub kontekst…"
              className="w-full resize-y rounded-xl border border-border-custom/40 bg-surface-solid/30 pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50"
            />
          </div>

          {/* Reminder Selector */}
          <div className="flex items-center gap-2 bg-surface-solid/30 border border-border-custom/30 rounded-xl px-3.5 py-2 text-xs font-bold text-text-secondary">
            <Bell size={14} className="text-text-muted shrink-0" />
            <span className="text-text-muted">Przypomnienie:</span>
            <ControlSelect
              value={editReminder ?? ''}
              onChange={(e) => setEditReminder(e.target.value ? Number(e.target.value) : null)}
              className="bg-transparent text-text-primary font-bold focus:outline-none cursor-pointer flex-1"
            >
              <option value="">Brak przypomnienia</option>
              <option value="15">15 minut przed</option>
              <option value="30">30 minut przed</option>
              <option value="60">1 godzina przed</option>
              <option value="1440">1 dzień przed</option>
            </ControlSelect>
          </div>

          {/* Category Picker */}
          <div className="space-y-1.5">
            <span className="text-2xs text-text-muted/70 font-black uppercase tracking-wider px-1">Obszar życia:</span>
            <CategoryPicker selected={editCategory} onSelect={setEditCategory} />
          </div>

          {/* Recurrence Picker */}
          <RecurrencePicker
            recurrence={editRecurrence}
            setRecurrence={setEditRecurrence}
            customDays={editCustomDays}
            setCustomDays={setEditCustomDays}
            endDate={editRecurrenceEndDate}
            setEndDate={setEditRecurrenceEndDate}
            minDate={editDate}
          />

          {/* Buttons Row */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleEditDelete}
              icon={<Trash2 size={16} />}
              aria-label="Usuń wydarzenie"
              className="h-11 w-11 border-danger/30 text-danger hover:bg-danger/10 shrink-0"
            />
            <Button
              onClick={handleEditSave}
              disabled={saving || !editTitle.trim() || !editDate || (!editAllDay && (!editStart || !editEnd)) || (editRecurrence === 'custom' && editCustomDays.length === 0)}
              loading={saving}
              variant="primary"
              className="h-11 flex-1 text-xs font-black uppercase tracking-wider"
            >
              Zapisz zmiany
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
