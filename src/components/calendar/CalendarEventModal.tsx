import React from 'react';
import { X, Clock, Repeat, Trash2, Calendar } from 'lucide-react';
import { useCalendarData } from './hooks/useCalendarData';
import { monthLabel, recurringSeriesBaseId } from './calendarHelpers';

import { LIFE_SPHERES } from '../../lib/projects/lifeSpheres';
import Modal from '../ui/Modal';

interface CalendarEventModalProps {
  calData: ReturnType<typeof useCalendarData>;
  userId: string | undefined;
  accessToken: string | undefined;
  handleQuickSave: () => void;
  handleEditSave: () => void;
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  calData,
  userId,
  accessToken,
  handleQuickSave,
  handleEditSave,
}) => {
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
    quickDescription,
    setQuickDescription,
    quickRecurrence,
    setQuickRecurrence,
    quickCustomDays,
    setQuickCustomDays,
    quickRecurrenceEndDate,
    setQuickRecurrenceEndDate,
    saving,

    selectedEvent,
    setSelectedEvent,
    editTitle,
    setEditTitle,
    editCategory,
    setEditCategory,
    editStart,
    setEditStart,
    editEnd,
    setEditEnd,
    editDate,
    setEditDate,
    editRecurrence,
    setEditRecurrence,
    editCustomDays,
    setEditCustomDays,
    editRecurrenceEndDate,
    setEditRecurrenceEndDate,
    deleting,

    showDeleteConfirm,
    setShowDeleteConfirm,
    executeDelete,
    handleEditDelete,
  } = calData;

  const minutesLabel = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };

  const renderCategoryPicker = (selected: string | null, onSelect: (key: string | null) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {[{ id: null as string | null, label: 'Brak', dot: 'bg-slate-400', border: 'border-border-custom', bgSoft: 'bg-surface-solid' }, ...LIFE_SPHERES].map((cat) => {
        const isSelected = selected === cat.id;
        return (
          <button
            key={cat.id || 'none'}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
              isSelected
                ? cat.id
                  ? `${cat.bgSoft.replace('/8', '/20')} ${cat.border} text-text-primary font-black shadow-sm`
                  : 'bg-text-primary/10 border-text-primary/30 text-text-primary font-black shadow-sm'
                : 'border-border-custom/40 bg-surface-solid/20 text-text-muted hover:text-text-primary'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
            <span>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderRecurrencePicker = (
    recurrence: '' | 'daily' | 'weekly' | 'monthly' | 'custom',
    setRecurrence: (r: '' | 'daily' | 'weekly' | 'monthly' | 'custom') => void,
    customDays: string[],
    setCustomDays: React.Dispatch<React.SetStateAction<string[]>>,
    endDate: string,
    setEndDate: (d: string) => void,
    minDate: string,
  ) => (
    <div className="space-y-2">
      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
        <Repeat size={11} /> Powtarzanie
      </label>
      <div className="flex flex-wrap gap-1.5">
        {(['', 'daily', 'weekly', 'monthly', 'custom'] as const).map((r) => (
          <button
            key={r || 'none'}
            type="button"
            onClick={() => setRecurrence(r)}
            className={`flex-1 min-w-[70px] text-[10.5px] font-bold py-2 rounded-xl border transition-all ${recurrence === r ? 'bg-primary/10 text-primary border-primary/30 font-black' : 'border-border-custom/60 text-text-muted hover:text-text-primary bg-surface-solid/20'}`}
          >
            {r === '' ? 'Nie powtarza się' : r === 'daily' ? 'Codziennie' : r === 'weekly' ? 'Co tydzień' : r === 'monthly' ? 'Co miesiąc' : 'Niestandardowe'}
          </button>
        ))}
      </div>
      {recurrence === 'custom' && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            { key: 'MO', label: 'Pon' },
            { key: 'TU', label: 'Wt' },
            { key: 'WE', label: 'Śr' },
            { key: 'TH', label: 'Czw' },
            { key: 'FR', label: 'Pt' },
            { key: 'SA', label: 'Sob' },
            { key: 'SU', label: 'Ndz' },
          ].map((day) => {
            const isSelected = customDays.includes(day.key);
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setCustomDays((prev) =>
                  isSelected ? prev.filter((k) => k !== day.key) : [...prev, day.key],
                )}
                className={`w-10 text-[10.5px] font-bold py-1.5 rounded-lg border transition-all ${isSelected ? 'bg-primary/10 text-primary border-primary/30 font-black' : 'border-border-custom/60 text-text-muted hover:text-text-primary bg-surface-solid/20'}`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      )}
      {recurrence !== '' && (
        <div className="flex items-center gap-2.5 pt-1">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider shrink-0">Kończy się:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={minDate}
            className="flex-1 bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-2.5 py-1.5 text-[12px] font-semibold text-text-primary outline-none focus:border-primary/50 transition-all cursor-pointer"
          />
          {endDate && (
            <button
              type="button"
              onClick={() => setEndDate('')}
              className="shrink-0 text-text-muted/50 hover:text-rose-400 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* 1. Quick Create Modal */}
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
              {renderCategoryPicker(quickCategory, setQuickCategory)}
            </div>

            {quickType === 'event' && (
              renderRecurrencePicker(
                quickRecurrence,
                setQuickRecurrence,
                quickCustomDays,
                setQuickCustomDays,
                quickRecurrenceEndDate,
                setQuickRecurrenceEndDate,
                quickCreate.date
              )
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

      {/* 2. Edit Event Modal */}
      <Modal isOpen={!!selectedEvent} onClose={() => setSelectedEvent(null)} title="Edytuj wydarzenie" size="sm">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Tytuł wydarzenia..."
              className="w-full bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-4 py-3.5 text-[14px] font-semibold text-text-primary outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
            />

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-[10px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1">Start</label>
                <input
                  type="time"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-3 py-2 text-[12px] font-semibold text-text-primary outline-none focus:border-primary/50 transition-all cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1">Koniec</label>
                <input
                  type="time"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-3 py-2 text-[12px] font-semibold text-text-primary outline-none focus:border-primary/50 transition-all cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Obszar życia:</span>
              {renderCategoryPicker(editCategory, setEditCategory)}
            </div>

            {renderRecurrencePicker(
              editRecurrence,
              setEditRecurrence,
              editCustomDays,
              setEditCustomDays,
              editRecurrenceEndDate,
              setEditRecurrenceEndDate,
              editDate
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleEditDelete}
                className="w-12 h-12 flex items-center justify-center rounded-xl border border-rose-500/20 hover:bg-rose-500/10 text-rose-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                disabled={saving}
                className="flex-1 rounded-xl bg-primary hover:bg-primary-hover disabled:bg-slate-400 text-white py-3 text-[13px] font-black uppercase tracking-wider transition-colors"
              >
                {saving ? 'Zapisywanie...' : 'Zapisz'}
              </button>
            </div>
      </Modal>

      {/* 3. Delete Confirmation Dialog */}
      {showDeleteConfirm && (() => {
        const isRecurringInstance = !!recurringSeriesBaseId(selectedEvent?.event_id || selectedEvent?.id);
        return (
          <Modal
            isOpen
            onClose={() => setShowDeleteConfirm(false)}
            showCloseButton={false}
            size="xs"
          >
            <p className="text-[14px] font-black text-text-primary text-center">Usuń wydarzenie</p>
            <p className="text-[11.5px] font-bold text-text-secondary text-center">
              {isRecurringInstance
                ? 'To wydarzenie jest częścią cyklu. Usunąć tylko to wystąpienie, czy całą serię?'
                : 'Czy na pewno chcesz usunąć to wydarzenie?'}
            </p>
            {isRecurringInstance ? (
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => executeDelete('this')}
                  disabled={deleting}
                  className="w-full rounded-xl bg-rose-500 hover:bg-rose-600 disabled:bg-slate-400 text-white py-2.5 text-[11.5px] font-bold transition-colors"
                >
                  {deleting ? 'Usuwanie...' : 'Usuń tylko to wystąpienie'}
                </button>
                <button
                  onClick={() => executeDelete('all')}
                  disabled={deleting}
                  className="w-full rounded-xl border border-rose-500/40 hover:bg-rose-500/10 disabled:opacity-50 text-rose-500 py-2.5 text-[11.5px] font-bold transition-colors"
                >
                  {deleting ? 'Usuwanie...' : 'Usuń całą serię'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full rounded-xl border border-border-custom/60 py-2.5 text-[11.5px] font-bold text-text-muted hover:text-text-primary hover:bg-surface-solid/40 transition-colors"
                >
                  Anuluj
                </button>
              </div>
            ) : (
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-xl border border-border-custom/60 py-2.5 text-[11.5px] font-bold text-text-muted hover:text-text-primary hover:bg-surface-solid/40 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  onClick={() => executeDelete('this')}
                  disabled={deleting}
                  className="flex-1 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:bg-slate-400 text-white py-2.5 text-[11.5px] font-bold transition-colors"
                >
                  {deleting ? 'Usuwanie...' : 'Usuń'}
                </button>
              </div>
            )}
          </Modal>
        );
      })()}
    </>
  );
};
