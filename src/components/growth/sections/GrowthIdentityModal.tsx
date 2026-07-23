import { useState } from 'react';
import type { VanguardIdentityData } from '../../../lib/growth/growth.types';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Button from '../../ui/Button';
import { ControlTextarea } from '../../ui/ControlPrimitives';

interface Props {
  identity: VanguardIdentityData | null;
  onClose: () => void;
  onSave: (updates: Partial<VanguardIdentityData>) => Promise<void>;
}

export function GrowthIdentityModal({ identity, onClose, onSave }: Props) {
  const [currentRole, setCurrentRole] = useState(identity?.current_role ?? '');
  const [developedRole, setDevelopedRole] = useState(identity?.developed_role ?? '');
  const [values, setValues] = useState(identity?.values_standards?.join(', ') ?? '');
  const [confirming, setConfirming] = useState(identity?.confirming_behaviors?.join('\n') ?? '');
  const [conflicting, setConflicting] = useState(identity?.conflicting_behaviors?.join('\n') ?? '');

  const save = async () => {
    const lines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean);
    await onSave({
      current_role: currentRole,
      developed_role: developedRole,
      values_standards: values.split(',').map((item) => item.trim()).filter(Boolean),
      confirming_behaviors: lines(confirming),
      conflicting_behaviors: lines(conflicting),
    });
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title="Edytuj tożsamość">
      <div className="max-h-[var(--growth-modal-height)] space-y-4 overflow-y-auto py-2 pr-1">
        <Input label="Obecna rola" value={currentRole} onChange={(event) => setCurrentRole(event.target.value)} />
        <Input label="Rozwijana rola" value={developedRole} onChange={(event) => setDevelopedRole(event.target.value)} />
        <Input label="Wartości i standardy" value={values} onChange={(event) => setValues(event.target.value)} />
        <label className="block space-y-1 text-2xs font-black uppercase text-text-muted">
          Zachowania potwierdzające
          <ControlTextarea value={confirming} onChange={(event) => setConfirming(event.target.value)} rows={4} className="w-full rounded-xl border border-border-custom bg-background/50 p-3 text-xs text-text-primary" />
        </label>
        <label className="block space-y-1 text-2xs font-black uppercase text-text-muted">
          Zachowania w konflikcie
          <ControlTextarea value={conflicting} onChange={(event) => setConflicting(event.target.value)} rows={4} className="w-full rounded-xl border border-border-custom bg-background/50 p-3 text-xs text-text-primary" />
        </label>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button variant="outline" onClick={save}>Zapisz</Button>
        </div>
      </div>
    </Modal>
  );
}
