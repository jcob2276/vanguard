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
    setQuickCreate,
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

  return (
    <Modal isOpen={!!quickCreate} onClose={() => setQuickCreate(null)} title={quickType === 'task' ? 'Nowe zadanie' : 'Nowe wydarzenie'} size="sm">
      {quickCreate && <>
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-border-custom/40">
          <button
            type="button"
            onClick={() => setQuickType('event')}
            className={`flex-1 flex items-center justify-center gap-1.5 text-[12px] font-bold py-2 rounded-lg transition-all ${quickType === 'event' ? 'bg-background text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
          >
            <Calendar size={13} /> Wydarzenie
          </button>
          <button
            type="button"
            onClick={() => {
              setQuickType('task');
              if (quickRecurrence === 'custom') setQuickRecurrence('');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 text-[12px] font-bold py-2 rounded-lg transition-all ${quickType === 'task' ? 'bg-background text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
          >
            <Clock size={13} /> Zadanie
          </button>
        </div>

        <input
          autoFocus
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Tytuł..."
          className="w-full bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-4 py-3.5 text-[14px] font-semibold text-text-primary outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-text-muted/30"
        />

        <div className="flex items-center gap-2.5 text-text-secondary bg-slate-50 dark:bg-white/[0.02] border border-border-custom/40 rounded-xl px-3.5 py-2.5">
          <Clock size={14} className="text-text-muted shrink-0" />
          <span className="text-[12px] font-semibold">
            {monthLabel(quickCreate.date)}, {minutesLabel(quickCreate.startMin)} – {minutesLabel(quickCreate.startMin + quickDuration)}
          </span>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Czas trwania:</span>
          <div className="flex gap-1.5">
            {[30, 60, 90, 120].map((d) => (
              <button
                key={d}
                onClick={() => setQuickDuration(d)}
                className={`flex-1 text-[11px] font-bold py-2 rounded-xl border transition-all ${quickDuration === d ? 'bg-primary/10 text-primary border-primary/30 font-black' : 'border-border-custom/60 text-text-muted hover:text-text-primary bg-surface-solid/20'}`}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Obszar życia:</span>
          <CategoryPicker selected={quickCategory} onSelect={setQuickCategory} />
        </div>

        {quickType === 'event' && (
          <RecurrencePicker
            recurrence={quickRecurrence}
            setRecurrence={setQuickRecurrence}
            customDays={quickCustomDays}
            setCustomDays={setQuickCustomDays}
            endDate={quickRecurrenceEndDate}
            setEndDate={setQuickRecurrenceEndDate}
            minDate={quickCreate.date}
          />
        )}

        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleQuickSave}
            disabled={saving}
            className="flex-1 rounded-xl bg-primary hover:bg-primary-hover disabled:bg-slate-400 text-white py-3 text-[13px] font-black uppercase tracking-wider shadow-md shadow-primary/10 transition-colors"
          >
            {saving ? 'Zapisywanie...' : 'Zapisz'}
          </button>
        </div>
      </>}
    </Modal>
  );
};
