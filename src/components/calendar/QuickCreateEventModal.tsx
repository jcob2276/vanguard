import Button from '../ui/Button';
import { ControlInput, ControlTextarea } from '../ui/ControlPrimitives';
import React from 'react';
import { Clock, Calendar } from 'lucide-react';
import { useCalendarData } from './hooks/useCalendarData';
import { monthLabel } from './calendarHelpers';

import Modal from '../ui/Modal';
import CategoryPicker from './CategoryPicker';
import RecurrencePicker from './RecurrencePicker';

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
    quickDescription,
    setQuickDescription,
    quickRecurrence,
    setQuickRecurrence,
    quickCustomDays,
    setQuickCustomDays,
    quickRecurrenceEndDate,
    setQuickRecurrenceEndDate,
    saving,
  } = calData;

  return (
    <Modal isOpen={!!quickCreate} onClose={closeQuickCreate} title={quickType === 'task' ? 'Nowe zadanie' : 'Nowe wydarzenie'} size="md">
      {quickCreate && <>
        <div className="flex gap-1 p-1 rounded-xl bg-surface/40 border border-border-custom/40">
          <Button
            type="button"
            variant="ghost"
            icon={<Calendar size={13} />}
            onClick={() => setQuickType('event')}
            className={`flex-1 gap-1.5 text-sm font-bold py-2 rounded-lg ${quickType === 'event' ? 'bg-background text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
          >
            Wydarzenie
          </Button>
          <Button
            type="button"
            variant="ghost"
            icon={<Clock size={13} />}
            onClick={() => {
              setQuickType('task');
              if (quickRecurrence === 'custom') setQuickRecurrence('');
            }}
            className={`flex-1 gap-1.5 text-sm font-bold py-2 rounded-lg ${quickType === 'task' ? 'bg-background text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
          >
            Zadanie
          </Button>
        </div>

        <ControlInput
          autoFocus
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Tytuł..."
          className="min-h-14 w-full rounded-xl border border-border-custom bg-surface-solid px-4 text-lg font-bold tracking-tight text-text-primary focus:border-primary/50 placeholder:text-text-muted/40"
        />

        <ControlTextarea
          value={quickDescription}
          onChange={(event) => setQuickDescription(event.target.value)}
          rows={2}
          placeholder="Notatka lub kontekst (opcjonalnie)"
          className="w-full resize-y rounded-xl border border-border-custom bg-surface-solid px-3 py-3 text-sm text-text-primary placeholder:text-text-muted"
        />

        <div className="flex items-center gap-2.5 text-text-secondary bg-surface-solid border border-border-custom/40 rounded-xl px-3.5 py-2.5">
          <Clock size={14} className="text-text-muted shrink-0" />
          <span className="text-sm font-semibold">
            {monthLabel(quickCreate.date)}, {minutesLabel(quickCreate.startMin)} – {minutesLabel(quickCreate.startMin + quickDuration)}
          </span>
        </div>

        <div className="space-y-2">
          <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Czas trwania:</span>
          <div className="flex gap-1.5">
            {[30, 60, 90, 120].map((d) => (
              <Button
                key={d}
                type="button"
                variant="ghost"
                onClick={() => setQuickDuration(d)}
                className={`flex-1 text-xs font-bold py-2 rounded-xl border ${quickDuration === d ? 'bg-primary/10 text-primary border-primary/30 font-black' : 'border-border-custom/60 text-text-muted hover:text-text-primary bg-surface-solid/20'}`}
              >
                {d} min
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Obszar życia:</span>
          <CategoryPicker selected={quickCategory} onSelect={setQuickCategory} />
        </div>

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

        <div className="flex gap-2.5 pt-2">
          <Button
            variant="primary"
            onClick={handleQuickSave}
            disabled={saving || !quickTitle.trim() || (quickRecurrence === 'custom' && quickCustomDays.length === 0)}
            className="flex-1 py-3 text-sm uppercase tracking-wider"
            loading={saving}
          >
            {saving ? 'Zapisywanie...' : 'Zapisz'}
          </Button>
        </div>
      </>}
    </Modal>
  );
};
