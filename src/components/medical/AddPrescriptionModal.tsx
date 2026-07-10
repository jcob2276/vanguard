import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { createPrescription } from '../../lib/health/medicalApi';
import { notify } from '../../lib/notify';
import { getTodayWarsaw } from '../../lib/date';

interface AddPrescriptionModalProps {
  onClose: () => void;
  onSaved: () => void;
  user: User | null;
}

export default function AddPrescriptionModal({ onClose, onSaved, user }: AddPrescriptionModalProps) {
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
    if (!user) return;
    setIsSubmitting(true);

    try {
      await createPrescription(user.id, {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-border-custom bg-surface p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">Dodaj Szkła do Szafki</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-white/5"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-text-muted mb-1 block">Typ</label>
              <select className="w-full bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="normalized">Normalizacja (Dal)</option>
                <option value="differential">Differentials (Bliskość)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-text-muted mb-1 block">Status</label>
              <select className="w-full bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="active">Aktywne (obecne)</option>
                <option value="past">Historyczne (stare)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold border-b border-border-custom pb-1 text-text-primary">Lewe Oko (OS)</h4>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" step="0.25" placeholder="Sfera (np. -1.5)" className="bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.sphere_l} onChange={e => setFormData({...formData, sphere_l: e.target.value})} />
              <input type="number" step="0.25" placeholder="Cylinder" className="bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.cyl_l} onChange={e => setFormData({...formData, cyl_l: e.target.value})} />
              <input type="number" step="1" placeholder="Oś (np. 10)" className="bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.axis_l} onChange={e => setFormData({...formData, axis_l: e.target.value})} />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold border-b border-border-custom pb-1 text-text-primary">Prawe Oko (OD)</h4>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" step="0.25" placeholder="Sfera (np. -2.75)" className="bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.sphere_r} onChange={e => setFormData({...formData, sphere_r: e.target.value})} />
              <input type="number" step="0.25" placeholder="Cylinder" className="bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.cyl_r} onChange={e => setFormData({...formData, cyl_r: e.target.value})} />
              <input type="number" step="1" placeholder="Oś (np. 10)" className="bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.axis_r} onChange={e => setFormData({...formData, axis_r: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-text-muted mb-1 block">Data od</label>
              <input type="date" required className="w-full bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.started_at} onChange={e => setFormData({...formData, started_at: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-bold text-text-muted mb-1 block">Notatka</label>
              <input type="text" placeholder="np. za mocne" className="w-full bg-background border border-border-custom rounded-lg p-2 text-sm text-text-primary" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-primary text-white rounded-xl py-3 font-bold uppercase tracking-wider hover:bg-primary-hover active:scale-95 transition-all">
            {isSubmitting ? 'Zapisywanie...' : 'Zapisz Szkła'}
          </button>
        </form>
      </div>
    </div>
  );
}
