import { useState } from 'react';
import type { VanguardIdentityData } from '../../../lib/growth/growth.types';
import type { LearningSkill } from '../../../lib/growth/growth';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Button from '../../ui/Button';

interface Props {
  identity: VanguardIdentityData | null;
  skills: LearningSkill[];
  onClose: () => void;
  onSave: (updates: Partial<VanguardIdentityData>) => Promise<void>;
}

export function GrowthDirectionModal({ identity, skills, onClose, onSave }: Props) {
  const [theme, setTheme] = useState(identity?.development_theme ?? '');
  const [gap, setGap] = useState(identity?.development_gap ?? '');
  const [activeSkillId, setActiveSkillId] = useState(identity?.active_path?.mainSkillId ?? '');
  const [nextPractice, setNextPractice] = useState(identity?.active_path?.mainSkillWhy ?? '');

  const save = async () => {
    await onSave({
      development_theme: theme,
      development_gap: gap,
      active_path: {
        ...identity?.active_path,
        mainSkillId: activeSkillId || undefined,
        mainSkillWhy: nextPractice || undefined,
      },
    });
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title="Zmień kierunek rozwoju">
      <div className="space-y-4 py-2">
        <Input label="Motyw rozwoju" value={theme} onChange={(event) => setTheme(event.target.value)} />
        <Input label="Najważniejsza luka" value={gap} onChange={(event) => setGap(event.target.value)} />
        <Select
          label="Aktywna umiejętność"
          value={activeSkillId}
          onChange={(event) => setActiveSkillId(event.target.value)}
          options={[{ value: '', label: 'Wybierz…' }, ...skills.map((skill) => ({ value: skill.id, label: skill.label }))]}
        />
        <Input label="Następna praktyka" value={nextPractice} onChange={(event) => setNextPractice(event.target.value)} />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="outline" onClick={save}>Zapisz</Button>
        </div>
      </div>
    </Modal>
  );
}
