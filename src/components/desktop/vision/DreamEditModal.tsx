import { Sparkles, Check, Star, Trash2 } from 'lucide-react';
import Modal from '../../ui/Modal';
import type { DreamRow } from '../../../lib/dreamsApi';

interface DreamEditModalProps {
  editingDream: DreamRow | null;
  setEditingDream: React.Dispatch<React.SetStateAction<DreamRow | null>>;
  editDreamTitle: string;
  setEditDreamTitle: (v: string) => void;
  editDreamCat: string;
  setEditDreamCat: (v: string) => void;
  editDreamLifeGoal: string | null;
  setEditDreamLifeGoal: (v: string | null) => void;
  editDreamDesc: string;
  setEditDreamDesc: (v: string) => void;
  saveDreamEdit: () => void;
  savingDream: boolean;
  toggleTop5: (dream: DreamRow) => void;
  deleteDream: (id: string) => void;
  DREAM_CATEGORIES: string[];
  DREAM_CAT_LABEL: Record<string, string>;
}

export default function DreamEditModal({
  editingDream,
  setEditingDream,
  editDreamTitle,
  setEditDreamTitle,
  editDreamCat,
  setEditDreamCat,
  editDreamLifeGoal,
  setEditDreamLifeGoal,
  editDreamDesc,
  setEditDreamDesc,
  saveDreamEdit,
  savingDream,
  toggleTop5,
  deleteDream,
  DREAM_CATEGORIES,
  DREAM_CAT_LABEL,
}: DreamEditModalProps) {
  if (!editingDream) return null;

  return (
    <Modal
      isOpen
      onClose={() => setEditingDream(null)}
      title={<span className="flex items-center gap-2"><Sparkles size={14} className="text-primary" /> Pogłęb wizję</span>}
      size="lg"
      showCloseButton={false}
    >
        <div className="space-y-1.5">
          <label className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">Marzenie</label>
          <input
            value={editDreamTitle}
            onChange={e => setEditDreamTitle(e.target.value)}
            className="w-full rounded-xl border border-border-custom bg-surface px-3.5 py-2.5 text-sm font-semibold text-text-primary outline-none focus:border-primary"
          />
        </div>

        <div className="flex gap-3">
          <div className="space-y-1.5 flex-1">
            <label className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">Kategoria</label>
            <select
              value={editDreamCat}
              onChange={e => setEditDreamCat(e.target.value)}
              className="w-full rounded-xl border border-border-custom bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-primary cursor-pointer"
            >
              {DREAM_CATEGORIES.filter(c => c !== 'all').map(c => (
                <option key={c} value={c}>{DREAM_CAT_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">Cel życiowy</label>
            <div className="flex gap-1.5">
              {([['cialo', 'Ciało', 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'], ['duch', 'Duch', 'border-indigo-500/40 bg-indigo-500/10 text-indigo-500'], ['konto', 'Konto', 'border-amber-500/40 bg-amber-500/10 text-amber-600']] as [string, string, string][]).map(([val, label, active]) => (
                <button key={val} onClick={() => setEditDreamLifeGoal(editDreamLifeGoal === val ? null : val)}
                  className={`rounded-xl border px-3 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${editDreamLifeGoal === val ? active : 'border-border-custom text-text-muted hover:text-text-secondary'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">
            Wizja — jak się czujesz gdy to osiągasz?
          </label>
          <textarea
            value={editDreamDesc}
            onChange={e => setEditDreamDesc(e.target.value)}
            placeholder="Opisz jak to wygląda, jak się czujesz, co widzisz, słyszysz, czujesz w tym momencie..."
            rows={5}
            className="w-full rounded-xl border border-border-custom bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-primary resize-none placeholder:text-text-muted/40"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={saveDreamEdit}
            disabled={savingDream || !editDreamTitle.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-40"
          >
            <Check size={11} strokeWidth={2.5} /> Zapisz wizję
          </button>
          <button
            onClick={() => { toggleTop5(editingDream); setEditingDream((prev) => prev ? { ...prev, is_top5: !prev.is_top5 } : null); }}
            className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
              editingDream.is_top5
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                : 'border-border-custom text-text-muted hover:border-amber-500/30 hover:text-amber-500'
            }`}
          >
            <Star size={11} fill={editingDream.is_top5 ? 'currentColor' : 'none'} />
            Top 5
          </button>
          <button
            onClick={() => { deleteDream(editingDream.id); }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/20 text-rose-400/50 hover:text-rose-500 hover:border-rose-500/30 transition-all cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </div>
    </Modal>
  );
}
