import Button from '../ui/Button';
import { ControlInput, Pressable } from '../ui/ControlPrimitives';
import React from 'react';
import { Clock, Calendar } from 'lucide-react';
import { useCalendarData } from './hooks/useCalendarData';

import Modal from '../ui/Modal';
import CategoryPicker from './CategoryPicker';
import RecurrencePicker from './RecurrencePicker';
import { findCalendarConflicts } from '../../lib/calendarConflicts';
import { useCalendar } from './context/CalendarContext';
import { QuickScheduleFields } from './QuickScheduleFields';
import { minutesLabel } from './calendarHelpers';

interface QuickCreateEventModalProps {
  calData: ReturnType<typeof useCalendarData>;
  handleQuickSave: () => void;
}

export const QuickCreateEventModal: React.FC<QuickCreateEventModalProps> = ({ calData, handleQuickSave }) => {
  const { timeBudgets: { budgets } } = useCalendar();
  const {
    quickCreate,
    closeQuickCreate,
    quickTitle,
    setQuickTitle,
    quickDuration,
    setQuickDuration,
    quickCategory,
    setQuickCategory,
    quickType,
    setQuickType,
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
            <Pressable
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
            </Pressable>
            <Pressable
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
            </Pressable>
          </div>

          {/* Title Input */}
          <ControlInput
            autoFocus
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Tytuł wydarzenia lub zadania…"
            className="min-h-12 w-full rounded-xl border border-border-custom/40 bg-surface-solid/40 px-4 text-base font-bold tracking-tight text-text-primary focus:border-primary/50 placeholder:text-text-muted/40 transition-colors"
          />

          <QuickScheduleFields calData={calData} conflicts={conflicts} budgets={budgets} />

          {/* Duration Chips */}
          <div className="space-y-1.5">
            <span className="text-2xs text-text-muted/70 font-black uppercase tracking-wider px-1">Czas trwania:</span>
            <div className="flex gap-1.5">
              {[30, 60, 90, 120].map((d) => (
                <Pressable
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
                </Pressable>
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
              className="w-full py-3 text-xs font-black uppercase tracking-wider"
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
