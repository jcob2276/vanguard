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
      <button onClick={() => setSelected(null)} className="text-[11px] font-bold text-text-muted hover:text-text-primary cursor-pointer">← Wstecz</button>
      <div>
        <p className="text-[15px] font-black text-text-primary leading-tight">{selected.name}</p>
        {selected.brand && <p className="text-[11px] text-text-muted">{selected.brand}</p>}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input type="number" inputMode="numeric" autoFocus value={grams} onChange={(e) => setGrams(e.target.value)}
            className="w-20 rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-[14px] font-bold text-text-primary text-center outline-none focus:border-primary/40" />
          <span className="text-[12px] text-text-muted">gram</span>
        </div>
        <div className="flex gap-1.5">
          {[50, 100, 150, 200, 250].map((g) => (
            <button key={g} onClick={() => setGrams(String(g))}
              className={`flex-1 rounded-lg py-1 text-[10px] font-black transition-all cursor-pointer ${
                grams === String(g)
                  ? 'bg-primary text-white'
                  : 'border border-border-custom text-text-muted hover:border-primary/40 hover:text-primary'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {MEAL_TYPES.map((m) => (
          <button key={m.id} onClick={() => setMealType(m.id)}
            className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${mealType === m.id ? 'bg-primary text-white' : 'border border-border-custom text-text-muted'}`}>
            {m.label}
          </button>
        ))}
      </div>
      {preview && (
        <div className="rounded-xl bg-text-primary/[0.02] border border-border-custom/50 p-3 grid grid-cols-4 gap-2 text-center">
          {[['kcal', preview.calories], ['B', preview.protein], ['W', preview.carbs], ['T', preview.fat]].map(([label, val]) => (
            <div key={String(label)}>
              <p className="text-[13px] font-black text-text-primary">{val ?? '–'}</p>
              <p className="text-[8px] uppercase text-text-muted">{label}</p>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-[11px] text-rose-500">{error}</p>}
      <button onClick={save} disabled={saving}
        className="w-full rounded-2xl bg-primary py-3 text-[12px] font-black uppercase tracking-wider text-white disabled:opacity-50 active:scale-95 transition-all cursor-pointer">
        {saving ? 'Zapisuję...' : savedFlash ? 'Zapisano ✓' : 'Zapisz'}
      </button>
    </div>
  );
}
