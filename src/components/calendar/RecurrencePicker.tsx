import type { Dispatch, SetStateAction } from 'react';
import React from 'react';
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
  '': 'Jednorazowo',
  daily: 'Codziennie',
  weekly: 'Co tydzień',
  monthly: 'Co miesiąc',
  custom: 'Własne dni',
};

const WEEKDAYS = [
  { key: 'MO', label: 'Pon' },
  { key: 'TU', label: 'Wt' },
  { key: 'WE', label: 'Śr' },
  { key: 'TH', label: 'Czw' },
  { key: 'FR', label: 'Pt' },
  { key: 'SA', label: 'Sob' },
  { key: 'SU', label: 'Ndz' },
];

export default function RecurrencePicker({
  recurrence,
  setRecurrence,
  customDays,
  setCustomDays,
  endDate,
  setEndDate,
  minDate,
  allowCustom = true,
}: Props) {
  const options: Recurrence[] = allowCustom
    ? ['', 'daily', 'weekly', 'monthly', 'custom']
    : ['', 'daily', 'weekly', 'monthly'];

  return (
    <div className="space-y-2 rounded-xl border border-border-custom/30 bg-surface-solid/30 p-3">
      <div className="flex items-center gap-2 text-xs font-bold text-text-secondary">
        <Repeat size={14} className="text-text-muted" />
        <span>Powtarzanie</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <Pressable
            key={option || 'once'}
            type="button"
            onClick={() => setRecurrence(option)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all select-none ${
              recurrence === option
                ? 'border-primary/40 bg-primary/15 text-primary font-black shadow-sm'
                : 'border-border-custom/30 bg-surface-solid/40 text-text-muted hover:text-text-primary'
            }`}
          >
            {LABELS[option]}
          </Pressable>
        ))}
      </div>

      {recurrence === 'custom' && (
        <div className="flex gap-1 pt-1">
          {WEEKDAYS.map((day) => {
            const selected = customDays.includes(day.key);
            return (
              <Pressable
                key={day.key}
                type="button"
                onClick={() =>
                  setCustomDays((current) =>
                    selected ? current.filter((key) => key !== day.key) : [...current, day.key]
                  )
                }
                className={`flex-1 py-1 rounded-md border text-2xs font-black transition-all ${
                  selected
                    ? 'border-primary/40 bg-primary/20 text-primary'
                    : 'border-border-custom/30 bg-surface-solid/40 text-text-muted hover:text-text-primary'
                }`}
              >
                {day.label}
              </Pressable>
            );
          })}
        </div>
      )}

      {recurrence ? (
        <div className="flex items-center gap-2 pt-1">
          <span className="shrink-0 text-xs font-bold text-text-muted">Kończy się:</span>
          <ControlInput
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            min={minDate}
            className="h-8 flex-1 cursor-pointer rounded-lg border border-border-custom/40 bg-surface-solid/50 px-2.5 text-xs font-semibold text-text-primary focus:border-primary/50"
          />
          {endDate ? (
            <Pressable
              variant="ghost"
              size="sm"
              onClick={() => setEndDate('')}
              icon={<X size={13} />}
              aria-label="Usuń datę końcową"
              className="shrink-0 text-text-muted hover:text-danger"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
