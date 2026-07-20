import Button from '../ui/Button';
import { ControlInput } from '../ui/ControlPrimitives';

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  display?: string;
  onChange: (value: number) => void;
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  display,
  onChange,
}: SliderFieldProps) {
  return (
    <label className="block space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        <span className="text-sm font-medium tabular-nums tracking-[-0.02em] text-text-primary">
          {display ?? `${value.toLocaleString('pl-PL')}${suffix}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-primary"
      />
    </label>
  );
}

interface QuickAddProps {
  fields: { key: string; placeholder: string; type?: string; defaultValue?: string }[];
  onSubmit: (values: Record<string, string>) => void;
  submitLabel?: string;
}

export function QuickAddForm({ fields, onSubmit, submitLabel = 'Dodaj' }: QuickAddProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values: Record<string, string> = {};
    fields.forEach((f) => { values[f.key] = String(fd.get(f.key) ?? ''); });
    onSubmit(values);
    e.currentTarget.reset();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 px-4 pb-4 pt-1">
      {fields.map((f) => (
        <ControlInput
          key={f.key}
          name={f.key}
          type={f.type ?? 'text'}
          placeholder={f.placeholder}
          defaultValue={f.defaultValue}
          required
          className="min-h-11 min-w-[7.5rem] flex-1 rounded-xl border-0 bg-surface-2/70 px-3 py-2 text-sm ring-1 ring-border-custom/25 focus:ring-2 focus:ring-primary/35"
        />
      ))}
      <Button type="submit" size="sm" className="rounded-xl active:scale-[0.98]">
        {submitLabel}
      </Button>
    </form>
  );
}
