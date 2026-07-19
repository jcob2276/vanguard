import { useState, useEffect } from 'react';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Button from '../../ui/Button';
import type { VanguardIdentityData, LibraryItem, PracticeEvidence } from '../../../lib/growth/growth.types';
import type { LearningSkill } from '../../../lib/growth/growth';
import { getTodayWarsaw } from '../../../lib/date';
import { ControlTextarea } from '../../ui/ControlPrimitives';

interface GrowthModalsProps {
  activeModal: 'direction' | 'identity' | 'library' | 'practice' | null;
  onClose: () => void;
  identity: VanguardIdentityData | null;
  skills: LearningSkill[];
  editingLibraryItem?: LibraryItem | null;
  editingPracticeItem?: PracticeEvidence | null;
  onSaveIdentity: (updates: Partial<VanguardIdentityData>) => Promise<void>;
}

export default function GrowthModals({
  activeModal,
  onClose,
  identity,
  skills,
  editingLibraryItem,
  editingPracticeItem,
  onSaveIdentity
}: GrowthModalsProps) {
  const [theme, setTheme] = useState(identity?.development_theme || '');
  const [gap, setGap] = useState(identity?.development_gap || '');
  const [activeSkillId, setActiveSkillId] = useState(identity?.active_path?.mainSkillId || '');
  const [nextPractice, setNextPractice] = useState(identity?.active_path?.mainSkillWhy || '');

  const [currentRole, setCurrentRole] = useState(identity?.current_role || '');
  const [developedRole, setDevelopedRole] = useState(identity?.developed_role || '');
  const [valuesStr, setValuesStr] = useState(identity?.values_standards?.join(', ') || '');
  const [confirmingStr, setConfirmingStr] = useState(identity?.confirming_behaviors?.join('\n') || '');
  const [conflictingStr, setConflictingStr] = useState(identity?.conflicting_behaviors?.join('\n') || '');

  const [libTitle, setLibTitle] = useState('');
  const [libType, setLibType] = useState<'book' | 'article' | 'podcast' | 'video' | 'course' | 'note' | 'mentor' | 'experiment'>('book');
  const [libStatus, setLibStatus] = useState<'inbox' | 'want_to_learn' | 'in_progress' | 'processed' | 'applied' | 'deferred'>('inbox');
  const [libUrl, setLibUrl] = useState('');
  const [libNotes, setLibNotes] = useState('');
  const [libSkill, setLibSkill] = useState('');

  const [pracTitle, setPracTitle] = useState('');
  const [pracType, setPracType] = useState<'task' | 'project' | 'talk' | 'material' | 'feature' | 'workout' | 'problem' | 'feedback' | 'result'>('task');
  const [pracLevel, setPracLevel] = useState<'consume' | 'understand' | 'try' | 'can_do' | 'apply_regularly'>('consume');
  const [pracDate, setPracDate] = useState(getTodayWarsaw());
  const [pracSkillId, setPracSkillId] = useState('');
  const [pracDetails, setPracDetails] = useState('');

  useEffect(() => {
    if (activeModal === 'direction') {
      setTheme(identity?.development_theme || '');
      setGap(identity?.development_gap || '');
      setActiveSkillId(identity?.active_path?.mainSkillId || '');
      setNextPractice(identity?.active_path?.mainSkillWhy || '');
    } else if (activeModal === 'identity') {
      setCurrentRole(identity?.current_role || '');
      setDevelopedRole(identity?.developed_role || '');
      setValuesStr(identity?.values_standards?.join(', ') || '');
      setConfirmingStr(identity?.confirming_behaviors?.join('\n') || '');
      setConflictingStr(identity?.conflicting_behaviors?.join('\n') || '');
    } else if (activeModal === 'library') {
      if (editingLibraryItem) {
        setLibTitle(editingLibraryItem.title);
        setLibType(editingLibraryItem.type);
        setLibStatus(editingLibraryItem.status);
        setLibUrl(editingLibraryItem.url || '');
        setLibNotes(editingLibraryItem.connectedNotes || '');
        setLibSkill(editingLibraryItem.connectedSkill || '');
      } else {
        setLibTitle('');
        setLibType('book');
        setLibStatus('inbox');
        setLibUrl('');
        setLibNotes('');
        setLibSkill('');
      }
    } else if (activeModal === 'practice') {
      if (editingPracticeItem) {
        setPracTitle(editingPracticeItem.title);
        setPracType(editingPracticeItem.type);
        setPracLevel(editingPracticeItem.competenceLevel);
        setPracDate(editingPracticeItem.date);
        setPracSkillId(editingPracticeItem.skillId || '');
        setPracDetails(editingPracticeItem.details || '');
      } else {
        setPracTitle('');
        setPracType('task');
        setPracLevel('consume');
        setPracDate(getTodayWarsaw());
        setPracSkillId('');
        setPracDetails('');
      }
    }
  }, [activeModal, identity, editingLibraryItem, editingPracticeItem]);

  const handleSaveDirection = async () => {
    await onSaveIdentity({
      development_theme: theme,
      development_gap: gap,
      active_path: {
        ...identity?.active_path,
        mainSkillId: activeSkillId || undefined,
        mainSkillWhy: nextPractice || undefined
      }
    });
    onClose();
  };

  const handleSaveIdentityDetails = async () => {
    await onSaveIdentity({
      current_role: currentRole,
      developed_role: developedRole,
      values_standards: valuesStr.split(',').map(s => s.trim()).filter(Boolean),
      confirming_behaviors: confirmingStr.split('\n').map(s => s.trim()).filter(Boolean),
      conflicting_behaviors: conflictingStr.split('\n').map(s => s.trim()).filter(Boolean)
    });
    onClose();
  };

  const handleSaveLibrary = async () => {
    const currentList = identity?.library_items || [];
    let updatedList;
    if (editingLibraryItem) {
      updatedList = currentList.map(item => item.id === editingLibraryItem.id ? {
        ...item, title: libTitle, type: libType, status: libStatus, url: libUrl, connectedNotes: libNotes, connectedSkill: libSkill
      } : item);
    } else {
      updatedList = [...currentList, {
        id: crypto.randomUUID(), title: libTitle, type: libType, status: libStatus, url: libUrl, connectedNotes: libNotes, connectedSkill: libSkill, createdAt: new Date().toISOString()
      }];
    }
    await onSaveIdentity({ library_items: updatedList });
    onClose();
  };

  const handleSavePractice = async () => {
    const currentList = identity?.practice_evidences || [];
    let updatedList;
    if (editingPracticeItem) {
      updatedList = currentList.map(item => item.id === editingPracticeItem.id ? {
        ...item, title: pracTitle, type: pracType, competenceLevel: pracLevel, date: pracDate, skillId: pracSkillId || undefined, details: pracDetails
      } : item);
    } else {
      updatedList = [...currentList, {
        id: crypto.randomUUID(), title: pracTitle, type: pracType, competenceLevel: pracLevel, date: pracDate, skillId: pracSkillId || undefined, details: pracDetails
      }];
    }
    await onSaveIdentity({ practice_evidences: updatedList });
    onClose();
  };

  return (
    <>
      <Modal isOpen={activeModal === 'direction'} onClose={onClose} title="Zmień Kierunek Rozwoju">
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase text-text-muted">Motyw rozwoju</label>
            <Input value={theme} onChange={e => setTheme(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase text-text-muted">Najważniejsza luka</label>
            <Input value={gap} onChange={e => setGap(e.target.value)} />
          </div>
          <Select label="Aktywna umiejętność" value={activeSkillId} onChange={e => setActiveSkillId(e.target.value)} options={[{ value: '', label: 'Wybierz...' }, ...skills.map(s => ({ value: s.id, label: s.label }))]} />
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase text-text-muted">Następna praktyka (zadanie/drill)</label>
            <Input value={nextPractice} onChange={e => setNextPractice(e.target.value)} />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Anuluj</Button>
            <Button variant="outline" onClick={handleSaveDirection} className="text-primary border-primary/30">Zapisz</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={activeModal === 'identity'} onClose={onClose} title="Edytuj Tożsamość">
        <div className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-1">
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase text-text-muted">Obecna rola</label>
            <Input value={currentRole} onChange={e => setCurrentRole(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase text-text-muted">Rozwijana rola</label>
            <Input value={developedRole} onChange={e => setDevelopedRole(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase text-text-muted">Wartości i standardy (oddziel przecinkami)</label>
            <Input value={valuesStr} onChange={e => setValuesStr(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase text-text-muted">Zachowania potwierdzające (jedno w linii)</label>
            <ControlTextarea value={confirmingStr} onChange={e => setConfirmingStr(e.target.value)} rows={4} className="w-full bg-background/50 border border-border-custom rounded-xl p-3 text-xs focus:outline-none focus:border-primary text-text-primary" />
          </div>
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase text-text-muted">Zachowania w konflikcie (jedno w linii)</label>
            <ControlTextarea value={conflictingStr} onChange={e => setConflictingStr(e.target.value)} rows={4} className="w-full bg-background/50 border border-border-custom rounded-xl p-3 text-xs focus:outline-none focus:border-primary text-text-primary" />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Anuluj</Button>
            <Button variant="outline" onClick={handleSaveIdentityDetails} className="text-primary border-primary/30">Zapisz</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={activeModal === 'library'} onClose={onClose} title={editingLibraryItem ? 'Edytuj Materiał' : 'Dodaj Materiał do Bazy Wiedzy'}>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase text-text-muted">Tytuł</label>
            <Input value={libTitle} onChange={e => setLibTitle(e.target.value)} />
          </div>
          <Select label="Typ" value={libType} onChange={e => setLibType(e.target.value as typeof libType)} options={[{ value: 'book', label: 'Książka' }, { value: 'article', label: 'Artykuł' }, { value: 'podcast', label: 'Podcast' }, { value: 'video', label: 'Wideo' }, { value: 'course', label: 'Kurs' }, { value: 'note', label: 'Notatka' }, { value: 'mentor', label: 'Rozmowa z mentorem' }, { value: 'experiment', label: 'Eksperyment' }]} />
          <Select label="Status" value={libStatus} onChange={e => setLibStatus(e.target.value as typeof libStatus)} options={[{ value: 'inbox', label: 'Skrzynka' }, { value: 'want_to_learn', label: 'Chcę poznać' }, { value: 'in_progress', label: 'W trakcie' }, { value: 'processed', label: 'Przetworzone' }, { value: 'applied', label: 'Zastosowane' }, { value: 'deferred', label: 'Odłożone' }]} />
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase text-text-muted">Link URL (opcjonalny)</label>
            <Input value={libUrl} onChange={e => setLibUrl(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase text-text-muted">Podłączona notatka / przemyślenie</label>
            <Input value={libNotes} onChange={e => setLibNotes(e.target.value)} />
          </div>
          <Select label="Podłączony skill" value={libSkill} onChange={e => setLibSkill(e.target.value)} options={[{ value: '', label: 'Brak' }, ...skills.map(s => ({ value: s.id, label: s.label }))]} />
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Anuluj</Button>
            <Button variant="outline" onClick={handleSaveLibrary} className="text-primary border-primary/30">Zapisz</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={activeModal === 'practice'} onClose={onClose} title={editingPracticeItem ? 'Edytuj Dowód Praktyki' : 'Zaloguj Nową Praktykę / Dowód'}>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase text-text-muted">Co zrobiłeś / jaki jest dowód?</label>
            <Input value={pracTitle} onChange={e => setPracTitle(e.target.value)} />
          </div>
          <Select label="Typ dowodu" value={pracType} onChange={e => setPracType(e.target.value as typeof pracType)} options={[{ value: 'task', label: 'Ukończone zadanie' }, { value: 'project', label: 'Rezultat projektu' }, { value: 'talk', label: 'Przeprowadzona rozmowa' }, { value: 'material', label: 'Opublikowany materiał' }, { value: 'feature', label: 'Zbudowana funkcja' }, { value: 'workout', label: 'Wykonany trening' }, { value: 'problem', label: 'Rozwiązany problem' }, { value: 'feedback', label: 'Informacja zwrotna' }, { value: 'result', label: 'Powtarzalny wynik' }]} />
          <Select label="Poziom zdolności" value={pracLevel} onChange={e => setPracLevel(e.target.value as typeof pracLevel)} options={[{ value: 'consume', label: 'Konsumuję' }, { value: 'understand', label: 'Rozumiem' }, { value: 'try', label: 'Próbuję' }, { value: 'can_do', label: 'Potrafię' }, { value: 'apply_regularly', label: 'Stosuję regularnie' }]} />
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase text-text-muted">Data</label>
            <Input type="date" value={pracDate} onChange={e => setPracDate(e.target.value)} />
          </div>
          <Select label="Rozwijany skill" value={pracSkillId} onChange={e => setPracSkillId(e.target.value)} options={[{ value: '', label: 'Brak' }, ...skills.map(s => ({ value: s.id, label: s.label }))]} />
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase text-text-muted">Szczegóły / opis</label>
            <Input value={pracDetails} onChange={e => setPracDetails(e.target.value)} />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Anuluj</Button>
            <Button variant="outline" onClick={handleSavePractice} className="text-primary border-primary/30">Zapisz</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
