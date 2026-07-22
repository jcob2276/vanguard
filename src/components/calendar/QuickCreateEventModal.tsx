import Button from '../ui/Button';
import { ControlInput, ControlTextarea } from '../ui/ControlPrimitives';
import React from 'react';
import { Clock, Calendar, CalendarDays, MapPin, Bell, AlignLeft } from 'lucide-react';
import { useCalendarData } from './hooks/useCalendarData';
import { monthLabel } from './calendarHelpers';

import Modal from '../ui/Modal';
import CategoryPicker from './CategoryPicker';
import RecurrencePicker from './RecurrencePicker';
import CalendarConflictNotice from './CalendarConflictNotice';
import { findCalendarConflicts } from '../../lib/calendarConflicts';
import PlanningFrameNotice from './PlanningFrameNotice';
import { useCalendar } from './context/CalendarContext';

function minutesLabel(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

interface QuickCreateEventModalProps {
  calData: ReturnType<typeof useCalendarData>;
  handleQuickSave: () => void;
}

export const QuickCreateEventModal: React.FC<QuickCreateEventModalProps> = ({ calData, handleQuickSave }) => {
  const { timeBudgets: { budgets } } = useCalendar();
  const {
    quickCreate,
    setQuickCreate,
    closeQuickCreate,
    quickTitle,
    setQuickTitle,
    quickDuration,
    setQuickDuration,
    quickCategory,
    setQuickCategory,
    quickType,
    setQuickType,
    quickDescription,
    setQuickDescription,
    quickLocation,
    setQuickLocation,
    quickAllDay,
    setQuickAllDay,
    quickReminder,
    setQuickReminder,
    quickRecurrence,
    setQuickRecurrence,
    quickCustomDays,
    setQuickCustomDays,
    quickRecurrenceEndDate,
    setQuickRecurrenceEndDate,
    saving,
  } = calData;

  const quickStart = quickCreate ? new Date(`${quickCreate.date}T${minutesLabel(quickCreate.startMin)}:00`).getTime() : 0;
  const conflicts = findCalendarConflicts(calData.events, quickStart, quickStart + quickDuration * 60_000);

  return (
    <Modal isOpen={!!quickCreate} onClose={closeQuickCreate} title={quickType === 'task' ? 'Nowe zadanie' : 'Nowe wydarzenie'} size="md">
      {quickCreate && (
        <div className="space-y-4">
          {/* Segmented Switcher */}
          <div className="flex p-1 rounded-xl bg-surface-solid/60 border border-border-custom/30">
            <button
              type="button"
              onClick={() => setQuickType('event')}
              className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold py-2 rounded-lg transition-all ${
                quickType === 'event'
                  ? 'bg-background text-primary shadow-sm font-black'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Calendar size={14} />
              Wydarzenie
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickType('task');
                if (quickRecurrence === 'custom') setQuickRecurrence('');
              }}
              className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold py-2 rounded-lg transition-all ${
                quickType === 'task'
                  ? 'bg-background text-primary shadow-sm font-black'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Clock size={14} />
              Zadanie
            </button>
          </div>

          {/* Title Input */}
          <ControlInput
            autoFocus
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Tytuł wydarzenia lub zadania…"
            className="min-h-12 w-full rounded-xl border border-border-custom/40 bg-surface-solid/40 px-4 text-base font-bold tracking-tight text-text-primary focus:border-primary/50 placeholder:text-text-muted/40 transition-colors"
          />

          {/* Date & Time Row */}
          <div className="rounded-xl border border-border-custom/30 bg-surface-solid/30 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
                <Clock size={14} /> Kiedy
              </span>
              <label className="flex items-center gap-2 text-xs font-bold text-text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={quickAllDay}
                  onChange={(e) => setQuickAllDay(e.target.checked)}
                  className="rounded border-border-custom text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                />
                Całodniowe
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1 text-xs font-bold text-text-secondary">
                <span className="flex items-center gap-1 text-text-muted"><CalendarDays size={12} /> Data</span>
                <ControlInput
                  type="date"
                  value={quickCreate.date}
                  onChange={(e) => {
                    if (e.target.value) {
                      setQuickCreate({ ...quickCreate, date: e.target.value });
                    }
                  }}
                  className="h-9 w-full rounded-lg border border-border-custom/40 bg-surface-solid/50 px-2.5 text-xs font-semibold text-text-primary"
                />
              </label>
              <label className="space-y-1 text-xs font-bold text-text-secondary">
                <span className="text-text-muted">Od</span>
                <ControlInput
                  type="time"
                  disabled={quickAllDay}
                  value={minutesLabel(quickCreate.startMin)}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [h, m] = e.target.value.split(':').map(Number);
                      const newStartMin = h * 60 + m;
                      setQuickCreate({ ...quickCreate, startMin: newStartMin });
                    }
                  }}
                  className="h-9 w-full rounded-lg border border-border-custom/40 bg-surface-solid/50 px-2.5 text-xs font-semibold text-text-primary disabled:opacity-40"
                />
              </label>
              <label className="space-y-1 text-xs font-bold text-text-secondary">
                <span className="text-text-muted">Do</span>
                <ControlInput
                  type="time"
                  disabled={quickAllDay}
                  value={minutesLabel(quickCreate.startMin + quickDuration)}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [h, m] = e.target.value.split(':').map(Number);
                      const newEndMin = h * 60 + m;
                      const diff = newEndMin - quickCreate.startMin;
                      if (diff > 0) {
                        setQuickDuration(diff);
                      }
                    }
                  }}
                  className="h-9 w-full rounded-lg border border-border-custom/40 bg-surface-solid/50 px-2.5 text-xs font-semibold text-text-primary disabled:opacity-40"
                />
              </label>
            </div>
          </div>

          {/* Location Input */}
          <div className="relative flex items-center">
            <MapPin size={14} className="absolute left-3.5 text-text-muted pointer-events-none" />
            <ControlInput
              value={quickLocation}
              onChange={(e) => setQuickLocation(e.target.value)}
              placeholder="Lokalizacja / Miejsce (opcjonalnie)…"
              className="w-full rounded-xl border border-border-custom/40 bg-surface-solid/30 pl-9 pr-3 py-2 text-xs font-medium text-text-primary placeholder:text-text-muted/50"
            />
          </div>

          {/* Description / Context Input */}
          <div className="relative flex items-start">
            <AlignLeft size={14} className="absolute left-3.5 top-3 text-text-muted pointer-events-none" />
            <ControlTextarea
              value={quickDescription}
              onChange={(event) => setQuickDescription(event.target.value)}
              rows={2}
              placeholder="Notatka lub kontekst (opcjonalnie)…"
              className="w-full resize-y rounded-xl border border-border-custom/40 bg-surface-solid/30 pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50"
            />
          </div>

          {/* Reminder Selector */}
          <div className="flex items-center gap-2 bg-surface-solid/30 border border-border-custom/30 rounded-xl px-3.5 py-2 text-xs font-bold text-text-secondary">
            <Bell size={14} className="text-text-muted shrink-0" />
            <span className="text-text-muted">Przypomnienie:</span>
            <select
              value={quickReminder ?? ''}
              onChange={(e) => setQuickReminder(e.target.value ? Number(e.target.value) : null)}
              className="bg-transparent text-text-primary font-bold focus:outline-none cursor-pointer flex-1"
            >
              <option value="">Brak przypomnienia</option>
              <option value="15">15 minut przed</option>
              <option value="30">30 minut przed</option>
              <option value="60">1 godzina przed</option>
              <option value="1440">1 dzień przed</option>
            </select>
          </div>

          <CalendarConflictNotice titles={conflicts.map((event) => event.summary || 'Wydarzenie')} />
          {quickCategory ? (
            <PlanningFrameNotice
              frame={budgets.find((budget) => budget.category === quickCategory)}
              date={quickCreate.date}
              startMinutes={quickCreate.startMin}
            />
          ) : null}

          {/* Duration Chips */}
          <div className="space-y-1.5">
            <span className="text-2xs text-text-muted/70 font-black uppercase tracking-wider px-1">Czas trwania:</span>
            <div className="flex gap-1.5">
              {[30, 60, 90, 120].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setQuickDuration(d)}
                  className={`flex-1 text-xs font-bold py-1.5 rounded-lg border transition-all ${
                    quickDuration === d
                      ? 'bg-primary/15 border-primary/40 text-primary font-black shadow-sm'
                      : 'border-border-custom/30 bg-surface-solid/30 text-text-muted hover:text-text-primary'
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          {/* Category Picker */}
          <div className="space-y-1.5">
            <span className="text-2xs text-text-muted/70 font-black uppercase tracking-wider px-1">Obszar życia:</span>
            <CategoryPicker selected={quickCategory} onSelect={setQuickCategory} />
          </div>

          {/* Recurrence Picker */}
          <RecurrencePicker
            recurrence={quickRecurrence}
            setRecurrence={setQuickRecurrence}
            customDays={quickCustomDays}
            setCustomDays={setQuickCustomDays}
            endDate={quickRecurrenceEndDate}
            setEndDate={setQuickRecurrenceEndDate}
            minDate={quickCreate.date}
            allowCustom={quickType === 'event'}
          />

          {/* Save Action */}
          <div className="pt-2">
            <Button
              variant="primary"
              onClick={handleQuickSave}
              disabled={saving || !quickTitle.trim() || (quickRecurrence === 'custom' && quickCustomDays.length === 0)}
              className="w-full py-3 text-xs font-black uppercase tracking-wider shadow-lg shadow-primary/20"
              loading={saving}
            >
              {saving ? 'Zapisywanie…' : 'Zapisz'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
