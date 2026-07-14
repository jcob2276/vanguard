import Button from '../ui/Button';
import { ControlInput, ControlSelect } from '../ui/ControlPrimitives';
import React, { useState } from 'react';
import { createPrescription } from '../../lib/health/medicalApi';
import { notify } from '../../lib/notify';
import { getTodayWarsaw } from '../../lib/date';
import Modal from '../ui/Modal';

interface AddPrescriptionModalProps {
  onClose: () => void;
  onSaved: () => void;
  userId: string | null | undefined;
}

export default function AddPrescriptionModal({ onClose, onSaved, userId }: AddPrescriptionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: 'normalized',
    status: 'active',
    sphere_l: '', cyl_l: '', axis_l: '',
    sphere_r: '', cyl_r: '', axis_r: '',
    started_at: getTodayWarsaw(),
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setIsSubmitting(true);

    try {
      await createPrescription(userId, {
        type: formData.type,
        status: formData.status,
        sphere_l: formData.sphere_l ? parseFloat(formData.sphere_l) : null,
        cyl_l: formData.cyl_l ? parseFloat(formData.cyl_l) : null,
        axis_l: formData.axis_l ? parseInt(formData.axis_l) : null,
        sphere_r: formData.sphere_r ? parseFloat(formData.sphere_r) : null,
        cyl_r: formData.cyl_r ? parseFloat(formData.cyl_r) : null,
        axis_r: formData.axis_r ? parseInt(formData.axis_r) : null,
        started_at: formData.started_at,
        notes: formData.notes || null
      });

      notify('Zapisano szkła w szafce.', 'success');
      onSaved();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      notify('Błąd zapisu.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Dodaj Szkła do Szafki" size="md">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-text-muted mb-1 block">Typ</label>
            <ControlSelect className="w-full bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
              <option value="normalized">Normalizacja (Dal)</option>
              <option value="differential">Differentials (Bliskość)</option>
            </ControlSelect>
          </div>
          <div>
            <label className="text-xs font-bold text-text-muted mb-1 block">Status</label>
            <ControlSelect className="w-full bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
              <option value="active">Aktywne (obecne)</option>
              <option value="past">Historyczne (stare)</option>
            </ControlSelect>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-bold border-b border-border-custom pb-1 text-text-primary">Lewe Oko (OS)</h4>
          <div className="grid grid-cols-3 gap-2">
            <ControlInput type="number" step="0.25" placeholder="Sfera (np. -1.5)" className="bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.sphere_l} onChange={e => setFormData({...formData, sphere_l: e.target.value})} />
            <ControlInput type="number" step="0.25" placeholder="Cylinder" className="bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.cyl_l} onChange={e => setFormData({...formData, cyl_l: e.target.value})} />
            <ControlInput type="number" step="1" placeholder="Oś (np. 10)" className="bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.axis_l} onChange={e => setFormData({...formData, axis_l: e.target.value})} />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-bold border-b border-border-custom pb-1 text-text-primary">Prawe Oko (OD)</h4>
          <div className="grid grid-cols-3 gap-2">
            <ControlInput type="number" step="0.25" placeholder="Sfera (np. -2.75)" className="bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.sphere_r} onChange={e => setFormData({...formData, sphere_r: e.target.value})} />
            <ControlInput type="number" step="0.25" placeholder="Cylinder" className="bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.cyl_r} onChange={e => setFormData({...formData, cyl_r: e.target.value})} />
            <ControlInput type="number" step="1" placeholder="Oś (np. 10)" className="bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.axis_r} onChange={e => setFormData({...formData, axis_r: e.target.value})} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-text-muted mb-1 block">Data od</label>
            <ControlInput type="date" required className="w-full bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.started_at} onChange={e => setFormData({...formData, started_at: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-bold text-text-muted mb-1 block">Notatka</label>
            <ControlInput type="text" placeholder="np. za mocne" className="w-full bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
          </div>
        </div>

        <Button type="submit" loading={isSubmitting} className="w-full py-3 font-bold uppercase tracking-wider">
          Zapisz Szkła
        </Button>
      </form>
    </Modal>
  );
}
