import { Pressable, ControlInput } from '../../../ui/ControlPrimitives';
import { Card } from '../../../ui/Card';
import type { FoodBase } from '../hooks/useFoodEntryData';

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Śniadanie' },
  { id: 'lunch', label: 'Obiad' },
  { id: 'dinner', label: 'Kolacja' },
  { id: 'snack', label: 'Przekąska' },
];

interface PortionScreenProps {
  selected: FoodBase;
  setSelected: (v: FoodBase | null) => void;
  grams: string;
  setGrams: (v: string) => void;
  mealType: string;
  setMealType: (v: string) => void;
  preview: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null } | null;
  error: string | null;
  saving: boolean;
  savedFlash: boolean;
  save: () => void;
}

export default function PortionScreen({
  selected, setSelected,
  grams, setGrams,
  mealType, setMealType,
  preview, error,
  saving, savedFlash, save,
}: PortionScreenProps) {
  return (
    <div className="space-y-4">
      <Pressable variant="ghost" size="sm" onClick={() => setSelected(null)} className="px-0 py-0">← Wstecz</Pressable>
      <div>
        <p className="text-base font-black text-text-primary leading-tight">{selected.name}</p>
        {selected.brand && <p className="text-xs text-text-muted">{selected.brand}</p>}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ControlInput type="number" inputMode="numeric" autoFocus value={grams} onChange={(e) => setGrams(e.target.value)}
            className="w-20 rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-base font-bold text-text-primary text-center outline-none focus:border-primary/40" />
          <span className="text-sm text-text-muted">gram</span>
        </div>
        <div className="flex gap-1.5">
          {[50, 100, 150, 200, 250].map((g) => (
            <Pressable key={g} onClick={() => setGrams(String(g))}
              className={`flex-1 rounded-lg py-1 text-xs font-black transition-all cursor-pointer ${
                grams === String(g)
                  ? 'bg-primary text-on-accent'
                  : 'border border-border-custom text-text-muted hover:border-primary/40 hover:text-primary'
              }`}
            >
              {g}
            </Pressable>
          ))}
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {MEAL_TYPES.map((m) => (
          <Pressable key={m.id} onClick={() => setMealType(m.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${mealType === m.id ? 'bg-primary text-on-accent' : 'border border-border-custom text-text-muted'}`}>
            {m.label}
          </Pressable>
        ))}
      </div>
      {preview && (
        <Card variant="outline" padding="0.75rem" className="grid grid-cols-4 gap-2 text-center">
          {[['kcal', preview.calories], ['B', preview.protein], ['W', preview.carbs], ['T', preview.fat]].map(([label, val]) => (
            <div key={String(label)}>
              <p className="text-sm font-black text-text-primary">{val ?? '–'}</p>
              <p className="text-2xs uppercase text-text-muted">{label}</p>
            </div>
          ))}
        </Card>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <Pressable
        variant="primary"
        onClick={save}
        disabled={saving}
        loading={saving}
        className="w-full"
      >
        {savedFlash ? 'Zapisano ✓' : 'Zapisz'}
      </Pressable>
    </div>
  );
}
