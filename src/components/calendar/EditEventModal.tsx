import React from 'react';
import { Trash2 } from 'lucide-react';
import { useCalendarData } from './hooks/useCalendarData';

import Modal from '../ui/Modal';
import CategoryPicker from './CategoryPicker';
import RecurrencePicker from './RecurrencePicker';

interface EditEventModalProps {
  calData: ReturnType<typeof useCalendarData>;
  handleEditSave: () => void;
}

export const EditEventModal: React.FC<EditEventModalProps> = ({ calData, handleEditSave }) => {
  const {
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
    editRecurrence,
    setEditRecurrence,
    editCustomDays,
    setEditCustomDays,
    editRecurrenceEndDate,
    setEditRecurrenceEndDate,
    saving,
    handleEditDelete,
  } = calData;

  return (
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
        <CategoryPicker selected={editCategory} onSelect={setEditCategory} />
      </div>

      <RecurrencePicker
        recurrence={editRecurrence}
        setRecurrence={setEditRecurrence}
        customDays={editCustomDays}
        setCustomDays={setEditCustomDays}
        endDate={editRecurrenceEndDate}
        setEndDate={setEditRecurrenceEndDate}
        minDate={editDate}
      />

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
  );
};
