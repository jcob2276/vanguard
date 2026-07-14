import { Pressable, ControlInput } from '../../../ui/ControlPrimitives';
import type { RecentEntry } from '../hooks/useFoodEntryData';

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Śniadanie' },
  { id: 'lunch', label: 'Obiad' },
  { id: 'dinner', label: 'Kolacja' },
  { id: 'snack', label: 'Przekąska' },
];

interface EditScreenProps {
  editingEntry: RecentEntry;
  setEditingEntry: (entry: RecentEntry | null) => void;
  editGrams: string;
  setEditGrams: (v: string) => void;
  editMealType: string;
  setEditMealType: (v: string) => void;
  editPreview: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null } | null;
  error: string | null;
  editSaving: boolean;
  editDeleting: boolean;
  saveEntryEdit: () => void;
  deleteEntry: () => void;
}

export default function EditScreen({
  editingEntry, setEditingEntry,
  editGrams, setEditGrams,
  editMealType, setEditMealType,
  editPreview, error,
  editSaving, editDeleting,
  saveEntryEdit, deleteEntry,
}: EditScreenProps) {
  return (
    <div className="space-y-4">
      <Pressable
        variant="ghost"
        size="sm"
        onClick={() => setEditingEntry(null)}
        className="px-0 py-0 text-text-muted hover:text-text-primary"
      >
        ← Wstecz
      </Pressable>
      <div>
        <p className="text-base font-black text-text-primary leading-tight">{editingEntry.name}</p>
        {editingEntry.brand && <p className="text-xs text-text-muted">{editingEntry.brand}</p>}
      </div>
      <div>
        <label className="text-2xs font-bold uppercase tracking-wider text-text-muted block mb-1">Gramatura</label>
        <div className="flex items-center gap-2 mb-2">
          <ControlInput
            type="number" inputMode="numeric" autoFocus
            value={editGrams}
            onChange={(e) => setEditGrams(e.target.value)}
            className="w-24 rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-base font-bold text-text-primary text-center outline-none focus:border-primary/40"
          />
          <span className="text-sm text-text-muted">gram</span>
        </div>
        <div className="flex gap-1.5">
          {[50, 100, 150, 200, 250].map((g) => (
            <Pressable key={g} onClick={() => setEditGrams(String(g))}
              className={`flex-1 rounded-lg py-1 text-xs font-black transition-all cursor-pointer ${
                editGrams === String(g)
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
          <Pressable key={m.id} onClick={() => setEditMealType(m.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${editMealType === m.id ? 'bg-primary text-on-accent' : 'border border-border-custom text-text-muted'}`}>
            {m.label}
          </Pressable>
        ))}
      </div>
      {editPreview && (
        <div className="rounded-xl bg-text-primary/[0.02] border border-border-custom/50 p-3 grid grid-cols-4 gap-2 text-center">
          {(
            [
              ['kcal', editPreview.calories],
              ['B', editPreview.protein],
              ['W', editPreview.carbs],
              ['T', editPreview.fat],
            ] as [string, number | null][]
          ).map(([label, val]) => (
            <div key={label}>
              <p className="text-sm font-black text-text-primary">{val ?? '–'}</p>
              <p className="text-2xs uppercase text-text-muted">{label}</p>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <Pressable
          variant="danger"
          onClick={deleteEntry}
          loading={editDeleting}
          className="bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 shadow-none hover:translate-y-0"
        >
          Usuń
        </Pressable>
        <Pressable
          variant="primary"
          onClick={saveEntryEdit}
          loading={editSaving}
          className="flex-1"
        >
          Zapisz
        </Pressable>
      </div>
    </div>
  );
}
