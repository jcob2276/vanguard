import type { Dispatch, SetStateAction } from 'react';
import { Repeat, X } from 'lucide-react';
import { ControlInput, Pressable } from '../ui/ControlPrimitives';

type Recurrence = '' | 'daily' | 'weekly' | 'monthly' | 'custom';

interface Props {
  recurrence: Recurrence;
  setRecurrence: (value: Recurrence) => void;
  customDays: string[];
  setCustomDays: Dispatch<SetStateAction<string[]>>;
  endDate: string;
  setEndDate: (date: string) => void;
  minDate: string;
  allowCustom?: boolean;
}

const LABELS: Record<Recurrence, string> = {
  '': 'Jednorazowo', daily: 'Codziennie', weekly: 'Co tydzień', monthly: 'Co miesiąc', custom: 'Własne dni',
};

const WEEKDAYS = [
  { key: 'MO', label: 'Pon' }, { key: 'TU', label: 'Wt' }, { key: 'WE', label: 'Śr' },
  { key: 'TH', label: 'Czw' }, { key: 'FR', label: 'Pt' }, { key: 'SA', label: 'Sob' },
  { key: 'SU', label: 'Ndz' },
];

export default function RecurrencePicker({
  recurrence, setRecurrence, customDays, setCustomDays, endDate, setEndDate,
  minDate, allowCustom = true,
}: Props) {
  const options: Recurrence[] = allowCustom
    ? ['', 'daily', 'weekly', 'monthly', 'custom']
    : ['', 'daily', 'weekly', 'monthly'];

  return (
    <div className="space-y-2.5 rounded-[var(--radius-lg)] border border-border-custom bg-surface-tonal p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold text-text-secondary"><Repeat size={14} /> Powtarzanie</p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        {options.map((option) => (
          <Pressable key={option || 'once'} onClick={() => setRecurrence(option)} className={`min-h-11 flex-1 rounded-xl border px-2 text-xs font-bold ${recurrence === option ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border-custom bg-surface-solid text-text-secondary hover:bg-surface-2'}`}>
            {LABELS[option]}
          </Pressable>
        ))}
      </div>

      {recurrence === 'custom' ? (
        <div className="flex gap-1.5 pt-1">
          {WEEKDAYS.map((day) => {
            const selected = customDays.includes(day.key);
            return (
              <Pressable key={day.key} onClick={() => setCustomDays((current) => selected ? current.filter((key) => key !== day.key) : [...current, day.key])} className={`min-h-11 min-w-0 flex-1 rounded-xl border text-2xs font-bold ${selected ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border-custom bg-surface-solid text-text-secondary'}`}>
                {day.label}
              </Pressable>
            );
          })}
        </div>
      ) : null}

      {recurrence ? (
        <div className="flex items-center gap-2 pt-1">
          <span className="shrink-0 text-xs font-bold text-text-secondary">Kończy się</span>
          <ControlInput type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} min={minDate} className="min-h-11 flex-1 cursor-pointer rounded-xl border border-border-custom bg-surface-solid px-3 text-sm font-semibold text-text-primary focus:border-primary/50" />
          {endDate ? <Pressable variant="ghost" size="sm" onClick={() => setEndDate('')} icon={<X size={13} />} aria-label="Usuń datę końcową" className="shrink-0 text-text-muted hover:text-danger" /> : null}
        </div>
      ) : null}
    </div>
  );
}
