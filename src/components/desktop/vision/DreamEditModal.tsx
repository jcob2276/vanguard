import { Pressable, ControlInput, ControlSelect, ControlTextarea } from '../../ui/ControlPrimitives';
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
          <label className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-002)] text-text-muted">Marzenie</label>
          <ControlInput
            value={editDreamTitle}
            onChange={e => setEditDreamTitle(e.target.value)}
            className="w-full rounded-xl border border-border-custom bg-surface px-3.5 py-2.5 text-sm font-semibold text-text-primary outline-none focus:border-primary"
          />
        </div>

        <div className="flex gap-3">
          <div className="space-y-1.5 flex-1">
            <label className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-002)] text-text-muted">Kategoria</label>
            <ControlSelect
              value={editDreamCat}
              onChange={e => setEditDreamCat(e.target.value)}
              className="w-full rounded-xl border border-border-custom bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-primary cursor-pointer"
            >
              {DREAM_CATEGORIES.filter(c => c !== 'all').map(c => (
                <option key={c} value={c}>{DREAM_CAT_LABEL[c]}</option>
              ))}
            </ControlSelect>
          </div>
          <div className="space-y-1.5">
            <label className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-002)] text-text-muted">Cel życiowy</label>
            <div className="flex gap-1.5">
              {([['cialo', 'Ciało', 'border-success/40 bg-success/10 text-success'], ['duch', 'Duch', 'border-primary/40 bg-primary/10 text-primary'], ['konto', 'Konto', 'border-warning/40 bg-warning/10 text-warning']] as [string, string, string][]).map(([val, label, active]) => (
                <Pressable key={val} onClick={() => setEditDreamLifeGoal(editDreamLifeGoal === val ? null : val)}
                  className={`rounded-xl border px-3 py-2.5 text-2xs font-black uppercase tracking-widest transition-all cursor-pointer ${editDreamLifeGoal === val ? active : 'border-border-custom text-text-muted hover:text-text-secondary'}`}>
                  {label}
                </Pressable>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-002)] text-text-muted">
            Wizja — jak się czujesz gdy to osiągasz?
          </label>
          <ControlTextarea
            value={editDreamDesc}
            onChange={e => setEditDreamDesc(e.target.value)}
            placeholder="Opisz jak to wygląda, jak się czujesz, co widzisz, słyszysz, czujesz w tym momencie..."
            rows={5}
            className="w-full rounded-xl border border-border-custom bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-primary resize-none placeholder:text-text-muted/40"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Pressable
            variant="primary"
            size="lg"
            onClick={saveDreamEdit}
            disabled={savingDream || !editDreamTitle.trim()}
            loading={savingDream}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all cursor-pointer"
            icon={<Check size={11} strokeWidth={2.5} />}
          >
            Zapisz wizję
          </Pressable>
          <Pressable
            variant={editingDream.is_top5 ? 'tonal' : 'outline'}
            size="lg"
            onClick={() => { toggleTop5(editingDream); setEditingDream((prev) => prev ? { ...prev, is_top5: !prev.is_top5 } : null); }}
            className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
              editingDream.is_top5
                ? 'border-warning/30 bg-warning/10 text-warning hover:bg-warning/20'
                : 'border-border-custom text-text-muted hover:border-warning/30 hover:text-warning'
            }`}
            icon={<Star size={11} fill={editingDream.is_top5 ? 'currentColor' : 'none'} />}
          >
            Top 5
          </Pressable>
          <Pressable
            variant="ghost"
            size="lg"
            onClick={() => { deleteDream(editingDream.id); }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-danger/20 text-danger/50 hover:text-danger hover:border-danger/30 transition-all cursor-pointer"
            icon={<Trash2 size={13} />}
          />
        </div>
    </Modal>
  );
}
