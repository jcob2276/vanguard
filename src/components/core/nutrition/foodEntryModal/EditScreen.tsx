import { Loader2 } from 'lucide-react';
import type { RecentEntry } from '../useFoodEntryData';

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
      <button onClick={() => setEditingEntry(null)} className="text-[11px] font-bold text-text-muted hover:text-text-primary cursor-pointer">← Wstecz</button>
      <div>
        <p className="text-[15px] font-black text-text-primary leading-tight">{editingEntry.name}</p>
        {editingEntry.brand && <p className="text-[11px] text-text-muted">{editingEntry.brand}</p>}
      </div>
      <div>
        <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted block mb-1">Gramatura</label>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="number" inputMode="numeric" autoFocus
            value={editGrams}
            onChange={(e) => setEditGrams(e.target.value)}
            className="w-24 rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-[14px] font-bold text-text-primary text-center outline-none focus:border-primary/40"
          />
          <span className="text-[12px] text-text-muted">gram</span>
        </div>
        <div className="flex gap-1.5">
          {[50, 100, 150, 200, 250].map((g) => (
            <button key={g} onClick={() => setEditGrams(String(g))}
              className={`flex-1 rounded-lg py-1 text-[10px] font-black transition-all cursor-pointer ${
                editGrams === String(g)
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
          <button key={m.id} onClick={() => setEditMealType(m.id)}
            className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${editMealType === m.id ? 'bg-primary text-white' : 'border border-border-custom text-text-muted'}`}>
            {m.label}
          </button>
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
              <p className="text-[13px] font-black text-text-primary">{val ?? '–'}</p>
              <p className="text-[8px] uppercase text-text-muted">{label}</p>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-[11px] text-rose-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={deleteEntry} disabled={editDeleting || editSaving}
          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[12px] font-black uppercase tracking-wider text-rose-500 disabled:opacity-50 active:scale-95 transition-all cursor-pointer">
          {editDeleting ? <Loader2 size={14} className="animate-spin" /> : 'Usuń'}
        </button>
        <button onClick={saveEntryEdit} disabled={editSaving || editDeleting}
          className="flex-1 rounded-2xl bg-primary py-3 text-[12px] font-black uppercase tracking-wider text-white disabled:opacity-50 active:scale-95 transition-all cursor-pointer">
          {editSaving ? 'Zapisuję...' : 'Zapisz'}
        </button>
      </div>
    </div>
  );
}
