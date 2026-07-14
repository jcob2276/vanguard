import { useState } from 'react';
import type { LearningSkill, LearningWeekFocus } from '../../lib/growth/growth';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

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
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Ustaw Focus Tygodnia"
      subtitle="Rozwój osobisty"
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className="text-2xs font-black uppercase tracking-wider text-text-muted">Główna umiejętność</label>
          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2 text-sm text-text-primary"
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
          <label className="text-2xs font-black uppercase tracking-wider text-text-muted">
            Cel / Dlaczego? (Intencja)
          </label>
          <textarea
            value={whyText}
            onChange={(e) => setWhyText(e.target.value)}
            placeholder="Po co uczysz się tego skilla? Jaki problem rozwiąże?"
            rows={3}
            className="mt-1 w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2 text-sm text-text-primary resize-none placeholder:text-text-muted"
          />
        </div>

        <div>
          <label className="text-2xs font-black uppercase tracking-wider text-text-muted">
            Drill / Ćwiczenie (Jak będziesz ćwiczyć w praktyce?)
          </label>
          <textarea
            value={drillText}
            onChange={(e) => setDrillText(e.target.value)}
            placeholder="np. Napisanie 3 serwisów w TS, przebiegnięcie 2x5km, przeczytanie 2 rozdziałów o architekturze i wdrożenie ich..."
            rows={3}
            className="mt-1 w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2 text-sm text-text-primary resize-none placeholder:text-text-muted"
          />
        </div>

        <div>
          <label className="text-2xs font-black uppercase tracking-wider text-text-muted">Docelowy poziom na ten tydzień</label>
          <div className="flex gap-2 mt-1">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <Button
                key={lvl}
                variant={targetLevel === lvl ? 'primary' : 'outline'}
                onClick={() => setTargetLevel(lvl)}
                className="flex-1 rounded-xl py-2 text-xs shadow-none hover:translate-y-0"
              >
                Lvl {lvl}
              </Button>
            ))}
          </div>
          <p className="text-2xs text-text-muted mt-1.5 leading-relaxed">
            Lvl 1-2: Zrozumienie, poprawność. Lvl 3-4: Spójność, łatwość wykonania. Lvl 5: Biegłość/Mastery.
          </p>
        </div>

        <div className="flex gap-2 pt-2 border-t border-border-custom">
          <Button
            variant="primary"
            disabled={!skillId}
            loading={saving}
            onClick={handleSave}
            className="flex-1"
          >
            Zapisz Focus
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
          >
            Anuluj
          </Button>
        </div>
      </div>
    </Modal>
  );
}
