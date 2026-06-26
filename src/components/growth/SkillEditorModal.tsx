import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { LearningSkill } from '../../lib/growth';
import { MAX_PARENT_SKILLS } from '../../lib/growth';

export default function SkillEditorModal({
  parentSkills,
  onClose,
  onSave,
  onRestoreDefaults,
}: {
  parentSkills: LearningSkill[];
  onClose: () => void;
  onSave: (next: { id?: string; key: string; label: string; sort_order: number }[]) => void;
  onRestoreDefaults: () => void;
}) {
  const [rows, setRows] = useState(
    parentSkills.map((s) => ({ id: s.id, key: s.key, label: s.label, sort_order: s.sort_order })),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border-custom bg-background shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border-custom px-4 py-3">
          <div>
            <h2 className="text-[13px] font-black uppercase tracking-wider text-text-primary">Skilli życiowe</h2>
            <p className="text-[10px] text-text-muted mt-0.5">Pod-skilli są pod każdym skillem w Radarze</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-text-muted hover:text-text-primary cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {rows.map((row, i) => (
            <div key={row.id ?? row.key} className="flex gap-2 items-center">
              <input
                value={row.label}
                onChange={(e) =>
                  setRows((rs) => rs.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))
                }
                className="flex-1 rounded-xl border border-border-custom bg-surface-solid px-3 py-2 text-[13px]"
              />
              <button
                type="button"
                disabled={rows.length <= 3}
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                className="p-2 text-text-muted hover:text-rose-500 cursor-pointer disabled:opacity-30"
                title="Ukryj skill (min. 3)"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {rows.length >= MAX_PARENT_SKILLS && (
            <p className="text-[10px] text-text-muted pt-1">Max {MAX_PARENT_SKILLS} skilli głównych.</p>
          )}
        </div>
        <div className="border-t border-border-custom p-4 space-y-2">
          <button
            type="button"
            onClick={onRestoreDefaults}
            className="w-full rounded-xl border border-dashed border-border-custom py-2 text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-primary hover:border-primary/30 cursor-pointer"
          >
            Przywróć domyślne drzewo skilli
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSave(rows.map((r, i) => ({ ...r, sort_order: i })))}
              className="flex-1 rounded-xl bg-primary py-2.5 text-[11px] font-black uppercase tracking-wider text-white cursor-pointer"
            >
              Zapisz nazwy
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border-custom px-4 py-2.5 text-[11px] font-black uppercase text-text-muted cursor-pointer"
            >
              Anuluj
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
