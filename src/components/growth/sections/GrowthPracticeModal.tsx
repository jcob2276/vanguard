import { useState } from 'react';
import type { PracticeEvidence, VanguardIdentityData } from '../../../lib/growth/growth.types';
import type { LearningSkill } from '../../../lib/growth/growth';
import { getTodayWarsaw } from '../../../lib/date';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Button from '../../ui/Button';

interface Props {
  identity: VanguardIdentityData | null;
  item?: PracticeEvidence | null;
  skills: LearningSkill[];
  onClose: () => void;
  onSave: (updates: Partial<VanguardIdentityData>) => Promise<void>;
}

export function GrowthPracticeModal({ identity, item, skills, onClose, onSave }: Props) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [type, setType] = useState<PracticeEvidence['type']>(item?.type ?? 'task');
  const [level, setLevel] = useState<PracticeEvidence['competenceLevel']>(item?.competenceLevel ?? 'consume');
  const [date, setDate] = useState(item?.date ?? getTodayWarsaw());
  const [skillId, setSkillId] = useState(item?.skillId ?? '');
  const [details, setDetails] = useState(item?.details ?? '');

  const save = async () => {
    const current = identity?.practice_evidences ?? [];
    const value: PracticeEvidence = {
      id: item?.id ?? crypto.randomUUID(),
      title,
      type,
      competenceLevel: level,
      date,
      skillId: skillId || undefined,
      details,
    };
    const practice_evidences = item
      ? current.map((entry) => entry.id === item.id ? value : entry)
      : [...current, value];
    await onSave({ practice_evidences });
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title={item ? 'Edytuj dowód praktyki' : 'Zaloguj praktykę'}>
      <div className="space-y-4 py-2">
        <Input label="Co zrobiłeś?" value={title} onChange={(event) => setTitle(event.target.value)} />
        <Select label="Typ dowodu" value={type} onChange={(event) => setType(event.target.value as PracticeEvidence['type'])} options={PRACTICE_TYPES} />
        <Select label="Poziom zdolności" value={level} onChange={(event) => setLevel(event.target.value as PracticeEvidence['competenceLevel'])} options={LEVELS} />
        <Input label="Data" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <Select label="Rozwijana umiejętność" value={skillId} onChange={(event) => setSkillId(event.target.value)} options={[{ value: '', label: 'Brak' }, ...skills.map((entry) => ({ value: entry.id, label: entry.label }))]} />
        <Input label="Szczegóły" value={details} onChange={(event) => setDetails(event.target.value)} />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="outline" onClick={save}>Zapisz</Button>
        </div>
      </div>
    </Modal>
  );
}

const PRACTICE_TYPES = [
  { value: 'task', label: 'Zadanie' }, { value: 'project', label: 'Projekt' },
  { value: 'talk', label: 'Rozmowa' }, { value: 'material', label: 'Materiał' },
  { value: 'feature', label: 'Funkcja' }, { value: 'workout', label: 'Trening' },
  { value: 'problem', label: 'Problem' }, { value: 'feedback', label: 'Feedback' },
  { value: 'result', label: 'Wynik' },
];
const LEVELS = [
  { value: 'consume', label: 'Konsumuję' }, { value: 'understand', label: 'Rozumiem' },
  { value: 'try', label: 'Próbuję' }, { value: 'can_do', label: 'Potrafię' },
  { value: 'apply_regularly', label: 'Stosuję regularnie' },
];
