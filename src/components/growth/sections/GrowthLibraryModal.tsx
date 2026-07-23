import { useState } from 'react';
import type { LibraryItem, VanguardIdentityData } from '../../../lib/growth/growth.types';
import type { LearningSkill } from '../../../lib/growth/growth';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Button from '../../ui/Button';

interface Props {
  identity: VanguardIdentityData | null;
  item?: LibraryItem | null;
  skills: LearningSkill[];
  onClose: () => void;
  onSave: (updates: Partial<VanguardIdentityData>) => Promise<void>;
}

export function GrowthLibraryModal({ identity, item, skills, onClose, onSave }: Props) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [type, setType] = useState<LibraryItem['type']>(item?.type ?? 'book');
  const [status, setStatus] = useState<LibraryItem['status']>(item?.status ?? 'inbox');
  const [url, setUrl] = useState(item?.url ?? '');
  const [notes, setNotes] = useState(item?.connectedNotes ?? '');
  const [skill, setSkill] = useState(item?.connectedSkill ?? '');

  const save = async () => {
    const current = identity?.library_items ?? [];
    const value: LibraryItem = {
      id: item?.id ?? crypto.randomUUID(),
      title,
      type,
      status,
      url,
      connectedNotes: notes,
      connectedSkill: skill,
      createdAt: item?.createdAt ?? new Date().toISOString(),
    };
    const library_items = item
      ? current.map((entry) => entry.id === item.id ? value : entry)
      : [...current, value];
    await onSave({ library_items });
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title={item ? 'Edytuj materiał' : 'Dodaj materiał'}>
      <div className="space-y-4 py-2">
        <Input label="Tytuł" value={title} onChange={(event) => setTitle(event.target.value)} />
        <Select label="Typ" value={type} onChange={(event) => setType(event.target.value as LibraryItem['type'])} options={LIBRARY_TYPES} />
        <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value as LibraryItem['status'])} options={LIBRARY_STATUSES} />
        <Input label="Link URL" value={url} onChange={(event) => setUrl(event.target.value)} />
        <Input label="Podłączona notatka" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <Select label="Podłączona umiejętność" value={skill} onChange={(event) => setSkill(event.target.value)} options={[{ value: '', label: 'Brak' }, ...skills.map((entry) => ({ value: entry.id, label: entry.label }))]} />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="outline" onClick={save}>Zapisz</Button>
        </div>
      </div>
    </Modal>
  );
}

const LIBRARY_TYPES = [
  { value: 'book', label: 'Książka' }, { value: 'article', label: 'Artykuł' },
  { value: 'podcast', label: 'Podcast' }, { value: 'video', label: 'Wideo' },
  { value: 'course', label: 'Kurs' }, { value: 'note', label: 'Notatka' },
  { value: 'mentor', label: 'Mentor' }, { value: 'experiment', label: 'Eksperyment' },
];
const LIBRARY_STATUSES = [
  { value: 'inbox', label: 'Skrzynka' }, { value: 'want_to_learn', label: 'Chcę poznać' },
  { value: 'in_progress', label: 'W trakcie' }, { value: 'processed', label: 'Przetworzone' },
  { value: 'applied', label: 'Zastosowane' }, { value: 'deferred', label: 'Odłożone' },
];
