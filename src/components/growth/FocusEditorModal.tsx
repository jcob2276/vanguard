import { useState } from 'react';
import { Target, X } from 'lucide-react';
import type { LearningSkill, LearningWeekFocus } from '../../lib/growth';

export default function FocusEditorModal({
  skills,
  currentFocus,
  onClose,
  onSave,
}: {
  skills: LearningSkill[];
  currentFocus: LearningWeekFocus | null;
  onClose: () => void;
  onSave: (skillId: string | null, why: string, drill: string, targetLevel: number) => Promise<void>;
}) {
  // Only parent skills (parent_id is null) are allowed as focus parents
  const parentSkills = skills.filter((s) => s.parent_id === null);

  const [skillId, setSkillId] = useState(
    currentFocus?.skill_id ?? parentSkills[0]?.id ?? ''
  );
  const [whyText, setWhyText] = useState(currentFocus?.why_text ?? '');
  const [drillText, setDrillText] = useState(currentFocus?.drill_text ?? '');
  const [targetLevel, setTargetLevel] = useState<number>(currentFocus?.target_level ?? 3);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(skillId || null, whyText.trim(), drillText.trim(), targetLevel);
      onClose();
    } catch {
      // handled in parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border-custom bg-background shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border-custom px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Target size={16} className="text-primary" />
            <h2 className="text-[13px] font-black uppercase tracking-wider text-text-primary">
              Ustaw Focus Tygodnia
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-text-muted hover:text-text-primary cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-[9px] font-black uppercase tracking-wider text-text-muted">Główna umiejętność</label>
            <select
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2 text-[12px] text-text-primary"
            >
              <option value="">-- Wybierz skill --</option>
              {parentSkills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-wider text-text-muted">
              Cel / Dlaczego? (Intencja)
            </label>
            <textarea
              value={whyText}
              onChange={(e) => setWhyText(e.target.value)}
              placeholder="Po co uczysz się tego skilla? Jaki problem rozwiąże?"
              rows={3}
              className="mt-1 w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2 text-[12px] text-text-primary resize-none placeholder:text-text-muted"
            />
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-wider text-text-muted">
              Drill / Ćwiczenie (Jak będziesz ćwiczyć w praktyce?)
            </label>
            <textarea
              value={drillText}
              onChange={(e) => setDrillText(e.target.value)}
              placeholder="np. Napisanie 3 serwisów w TS, przebiegnięcie 2x5km, przeczytanie 2 rozdziałów o architekturze i wdrożenie ich..."
              rows={3}
              className="mt-1 w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2 text-[12px] text-text-primary resize-none placeholder:text-text-muted"
            />
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-wider text-text-muted">Docelowy poziom na ten tydzień</label>
            <div className="flex gap-2 mt-1">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setTargetLevel(lvl)}
                  className={`flex-1 rounded-xl py-2 text-[11px] font-bold border transition-all cursor-pointer ${
                    targetLevel === lvl
                      ? 'bg-primary border-primary text-white'
                      : 'border-border-custom bg-surface text-text-muted hover:border-primary/30'
                  }`}
                >
                  Lvl {lvl}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-text-muted mt-1.5 leading-relaxed">
              Lvl 1-2: Zrozumienie, poprawność. Lvl 3-4: Spójność, łatwość wykonania. Lvl 5: Biegłość/Mastery.
            </p>
          </div>
        </div>

        <div className="border-t border-border-custom p-4 flex gap-2">
          <button
            type="button"
            disabled={saving || !skillId}
            onClick={handleSave}
            className="flex-1 rounded-xl bg-primary py-2.5 text-[11px] font-black uppercase text-white disabled:opacity-40 cursor-pointer"
          >
            {saving ? 'Zapisywanie...' : 'Zapisz Focus'}
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
  );
}
