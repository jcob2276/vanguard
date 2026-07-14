import type { Dispatch, SetStateAction } from 'react';
import { X, Repeat } from 'lucide-react';
import Button from '../ui/Button';

interface RecurrencePickerProps {
  recurrence: '' | 'daily' | 'weekly' | 'monthly' | 'custom';
  setRecurrence: (r: '' | 'daily' | 'weekly' | 'monthly' | 'custom') => void;
  customDays: string[];
  setCustomDays: Dispatch<SetStateAction<string[]>>;
  endDate: string;
  setEndDate: (d: string) => void;
  minDate: string;
}

export default function RecurrencePicker({
  recurrence,
  setRecurrence,
  customDays,
  setCustomDays,
  endDate,
  setEndDate,
  minDate,
}: RecurrencePickerProps) {
  return (
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEndDate('')}
              icon={<X size={13} />}
              className="shrink-0 text-text-muted/50 hover:text-danger"
            />
          )}
        </div>
      )}
    </div>
  );
}
