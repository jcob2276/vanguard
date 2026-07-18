import { ControlInput, ControlSelect, Pressable } from '../../ui/ControlPrimitives';

const DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

interface TimeFrameFieldsProps {
  category: string;
  days: Record<string, number[]>;
  starts: Record<string, string>;
  ends: Record<string, string>;
  strengths: Record<string, 'prefer' | 'only'>;
  setDays: (value: Record<string, number[]>) => void;
  setStarts: (value: Record<string, string>) => void;
  setEnds: (value: Record<string, string>) => void;
  setStrengths: (value: Record<string, 'prefer' | 'only'>) => void;
}

export default function TimeFrameFields({
  category, days, starts, ends, strengths, setDays, setStarts, setEnds, setStrengths,
}: TimeFrameFieldsProps) {
  const selectedDays = days[category] || [];
  return (
    <div className="space-y-2 border-t border-border-custom/30 pt-3">
      <div>
        <span className="block text-2xs font-black uppercase tracking-widest text-text-muted">Preferowane dni</span>
        <span className="text-2xs text-text-muted">Wskazówka dla planowania, nigdy automatyczna zmiana.</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((day, index) => {
          const dayNumber = index + 1;
          const selected = selectedDays.includes(dayNumber);
          return (
            <Pressable
              key={day}
              aria-pressed={selected}
              onClick={() => setDays({
                ...days,
                [category]: selected
                  ? selectedDays.filter((value) => value !== dayNumber)
                  : [...selectedDays, dayNumber].sort(),
              })}
              className={`h-8 rounded-lg text-2xs font-bold ${selected ? 'bg-primary text-on-accent' : 'bg-surface-3 text-text-secondary hover:bg-primary/10'}`}
            >
              {day}
            </Pressable>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-1 text-2xs font-bold text-text-muted">
          Od
          <ControlInput type="time" value={starts[category] || ''} onChange={(event) => setStarts({ ...starts, [category]: event.target.value })} className="w-full rounded-xl border border-border-custom bg-surface px-2 py-2 text-xs" />
        </label>
        <label className="space-y-1 text-2xs font-bold text-text-muted">
          Do
          <ControlInput type="time" value={ends[category] || ''} onChange={(event) => setEnds({ ...ends, [category]: event.target.value })} className="w-full rounded-xl border border-border-custom bg-surface px-2 py-2 text-xs" />
        </label>
        <label className="space-y-1 text-2xs font-bold text-text-muted">
          Zasada
          <ControlSelect value={strengths[category] || 'prefer'} onChange={(event) => setStrengths({ ...strengths, [category]: event.target.value as 'prefer' | 'only' })} className="w-full rounded-xl border border-border-custom bg-surface px-2 py-2 text-xs">
            <option value="prefer">Preferuj</option>
            <option value="only">Tylko wtedy</option>
          </ControlSelect>
        </label>
      </div>
    </div>
  );
}
