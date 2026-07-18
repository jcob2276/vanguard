import React from 'react';
import { Clock3, Repeat2 } from 'lucide-react';
import { Pressable } from '../../ui/ControlPrimitives';

const DURATIONS = [30, 60, 90, 120];
const RECURRENCES = [
  { value: '', label: 'Nigdy' },
  { value: 'daily', label: 'Codziennie' },
  { value: 'weekly', label: 'Co tydzień' },
  { value: 'monthly', label: 'Co miesiąc' },
] as const;

export function TaskPlacement({ isTimed, onChange }: { isTimed: boolean; onChange: (timed: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="group" aria-label="Umiejscowienie zadania">
      {[{ timed: false, label: 'Cały dzień' }, { timed: true, label: 'O godzinie' }].map((option) => {
        const active = option.timed === isTimed;
        return (
          <Pressable
            key={option.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.timed)}
            className={`min-h-11 rounded-lg px-3 text-sm font-bold transition-colors ${active ? 'bg-surface-solid text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
          >
            {option.label}
          </Pressable>
        );
      })}
    </div>
  );
}

export function TaskDurationPicker({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
        <Clock3 size={15} /> Czas trwania
      </div>
      <div className="grid grid-cols-4 gap-2">
        {DURATIONS.map((minutes) => (
          <Pressable
            key={minutes}
            type="button"
            aria-pressed={value === minutes}
            onClick={() => onChange(minutes)}
            className={`min-h-11 rounded-xl border text-sm font-bold transition-colors ${value === minutes ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border-custom text-text-muted hover:bg-surface-2'}`}
          >
            {minutes < 60 ? `${minutes} min` : `${minutes / 60} godz.`}
          </Pressable>
        ))}
      </div>
    </section>
  );
}

export function TaskRecurrencePicker({ value, onChange }: { value: string; onChange: (value: string | null) => void }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
        <Repeat2 size={15} /> Powtarzanie
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RECURRENCES.map((option) => (
          <Pressable
            key={option.label}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value || null)}
            className={`min-h-11 rounded-xl border px-2 text-xs font-bold transition-colors ${value === option.value ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border-custom text-text-muted hover:bg-surface-2'}`}
          >
            {option.label}
          </Pressable>
        ))}
      </div>
    </section>
  );
}
