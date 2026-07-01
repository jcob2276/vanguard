import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Glasses, Plus, Pencil, Trash, X, Calendar, Edit2, Info } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

type Prescription = {
  id: string;
  type: 'normalized' | 'differential';
  status: 'active' | 'past';
  sphere_l: number | null;
  cyl_l: number | null;
  axis_l: number | null;
  sphere_r: number | null;
  cyl_r: number | null;
  axis_r: number | null;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
};

export default function GlassesCabinet() {
  const [user, setUser] = useState<User | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const loadPrescriptions = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('endmyopia_prescriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });

      if (error) throw error;
      setPrescriptions(data || []);
    } catch (error) {
      console.error('Error loading prescriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFromExcel = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const excelData = [
        { user_id: user.id, type: 'normalized', status: 'active', started_at: '2022-06-15', sphere_l: -2.75, cyl_l: null, axis_l: null, sphere_r: -4.25, cyl_r: -0.75, axis_r: 10 },
        { user_id: user.id, type: 'normalized', status: 'past', started_at: '2020-10-24', ended_at: '2022-06-15', sphere_l: -3.25, cyl_l: null, axis_l: null, sphere_r: -4.50, cyl_r: -0.75, axis_r: 10 },
        { user_id: user.id, type: 'normalized', status: 'past', started_at: '2019-07-24', ended_at: '2020-10-24', sphere_l: -3.50, cyl_l: null, axis_l: null, sphere_r: -4.50, cyl_r: -0.75, axis_r: 10 },
        { user_id: user.id, type: 'differential', status: 'active', started_at: '2024-12-25', notes: 'mg być idealne', sphere_l: -1.50, cyl_l: null, axis_l: null, sphere_r: -3.00, cyl_r: -0.75, axis_r: 10 },
        { user_id: user.id, type: 'differential', status: 'past', started_at: '2024-12-25', ended_at: '2024-12-25', notes: 'za mocne', sphere_l: -1.75, cyl_l: null, axis_l: null, sphere_r: -3.25, cyl_r: -0.75, axis_r: 10 },
        { user_id: user.id, type: 'differential', status: 'past', started_at: '2024-12-25', ended_at: '2024-12-25', notes: 'za słabe', sphere_l: -1.25, cyl_l: null, axis_l: null, sphere_r: -2.75, cyl_r: -0.75, axis_r: 10 }
      ];
      
      const { error } = await supabase.from('endmyopia_prescriptions').insert(excelData);
      if (error) throw error;
      
      await loadPrescriptions();
    } catch (error) {
      console.error('Error seeding from excel:', error);
    }
  };

  useEffect(() => {
    loadPrescriptions();
  }, [user]);

  const activeNormalized = prescriptions.find((p) => p.status === 'active' && p.type === 'normalized');
  const activeDifferential = prescriptions.find((p) => p.status === 'active' && p.type === 'differential');

  const formatEye = (sph: number | null, cyl: number | null, axis: number | null) => {
    const s = sph !== null ? (sph > 0 ? `+${sph}` : `${sph}`) : '-';
    const c = cyl !== null ? (cyl > 0 ? `+${cyl}` : `${cyl}`) : '-';
    const a = axis !== null ? `${axis}°` : '-';
    return `${s} / ${c} / ${a}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Glasses className="text-primary" />
          Twoja Szafka ze Szkłami
        </h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover transition-colors"
        >
          <Plus size={16} /> Dodaj szkła
        </button>
      </div>

      {loading ? (
        <div className="h-24 rounded-2xl border border-border-custom bg-surface/30 animate-pulse" />
      ) : prescriptions.length === 0 ? (
        <div className="text-center p-12 border border-dashed border-border-custom rounded-3xl bg-surface/20">
          <Glasses className="mx-auto text-text-muted opacity-50 mb-4" size={48} />
          <h3 className="text-lg font-bold mb-2">Brak wprowadzonych szkieł</h3>
          <p className="text-sm text-text-muted mb-6">Rozpocznij wypełnianie swojej szafki lub załaduj historyczne dane ze swojego arkusza Excela.</p>
          <button 
            onClick={loadFromExcel}
            className="bg-emerald-500/10 text-emerald-500 font-bold px-6 py-3 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
          >
            Załaduj historię z Excela
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PrescriptionCard title="Aktualna Normalizacja (Długi Dystans)" prescription={activeNormalized} />
          <PrescriptionCard title="Aktualne Differentials (Krótki Dystans)" prescription={activeDifferential} />
        </div>
      )}

      {/* Historical List (Collapsed/Simple View) */}
      {prescriptions.filter(p => p.status === 'past').length > 0 && (
        <div className="mt-8">
          <h4 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-4">Historia Szkieł</h4>
          <div className="space-y-2">
            {prescriptions.filter(p => p.status === 'past').map(p => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border-custom bg-surface/20">
                <div>
                  <span className={`text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full ${p.type === 'normalized' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {p.type}
                  </span>
                  <div className="text-xs text-text-secondary mt-2 flex gap-4">
                    <span><strong className="text-text-primary">L:</strong> {formatEye(p.sphere_l, p.cyl_l, p.axis_l)}</span>
                    <span><strong className="text-text-primary">P:</strong> {formatEye(p.sphere_r, p.cyl_r, p.axis_r)}</span>
                  </div>
                </div>
                <div className="text-xs text-text-muted mt-2 sm:mt-0">
                  {p.started_at} {p.ended_at ? ` - ${p.ended_at}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddForm && (
        <AddPrescriptionModal onClose={() => setShowAddForm(false)} onSaved={loadPrescriptions} user={user} />
      )}
    </div>
  );
}

function PrescriptionCard({ title, prescription }: { title: string; prescription?: Prescription }) {
  if (!prescription) {
    return (
      <div className="rounded-2xl border border-border-custom bg-surface/40 p-6 flex flex-col items-center justify-center text-center">
        <Glasses className="text-text-muted opacity-30 mb-2" size={32} />
        <h4 className="text-sm font-semibold text-text-muted">{title}</h4>
        <p className="text-xs text-text-muted mt-1">Brak aktywnych szkieł w bazie</p>
      </div>
    );
  }

  const isNormalized = prescription.type === 'normalized';

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${isNormalized ? 'bg-blue-500/5 border-blue-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-20 pointer-events-none ${isNormalized ? 'bg-blue-500' : 'bg-emerald-500'}`} />
      
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${isNormalized ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {isNormalized ? 'NORMALIZATION' : 'DIFFERENTIALS'}
          </span>
          <p className="text-xs text-text-muted mt-2 flex items-center gap-1">
            <Calendar size={12} /> Od {prescription.started_at}
          </p>
        </div>
        {prescription.notes && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-amber-500 bg-amber-500/10 px-2 py-1 rounded">
            <Info size={12} /> {prescription.notes}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left Eye */}
        <div className="bg-surface/50 rounded-xl p-3 border border-border-custom">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Lewe Oko (OS)</div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-[10px] text-text-muted">Sfera</div>
              <div className="font-display font-black text-xl">{prescription.sphere_l ?? '-'}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-text-muted">Cyl / Oś</div>
              <div className="text-sm font-semibold">{prescription.cyl_l ?? '-'} / {prescription.axis_l ? `${prescription.axis_l}°` : '-'}</div>
            </div>
          </div>
        </div>

        {/* Right Eye */}
        <div className="bg-surface/50 rounded-xl p-3 border border-border-custom">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Prawe Oko (OD)</div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-[10px] text-text-muted">Sfera</div>
              <div className="font-display font-black text-xl">{prescription.sphere_r ?? '-'}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-text-muted">Cyl / Oś</div>
              <div className="text-sm font-semibold">{prescription.cyl_r ?? '-'} / {prescription.axis_r ? `${prescription.axis_r}°` : '-'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddPrescriptionModal({ onClose, onSaved, user }: { onClose: () => void, onSaved: () => void, user: User | null }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: 'normalized',
    status: 'active',
    sphere_l: '', cyl_l: '', axis_l: '',
    sphere_r: '', cyl_r: '', axis_r: '',
    started_at: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    try {
      if (formData.status === 'active') {
        // Mark existing active as past
        await supabase
          .from('endmyopia_prescriptions')
          .update({ status: 'past', ended_at: formData.started_at })
          .eq('user_id', user.id)
          .eq('type', formData.type)
          .eq('status', 'active');
      }

      const { error } = await supabase.from('endmyopia_prescriptions').insert({
        user_id: user.id,
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

      if (error) throw error;
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Błąd zapisu.');
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
              <select className="w-full bg-background border border-border-custom rounded-lg p-2 text-sm" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="normalized">Normalizacja (Dal)</option>
                <option value="differential">Differentials (Bliskość)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-text-muted mb-1 block">Status</label>
              <select className="w-full bg-background border border-border-custom rounded-lg p-2 text-sm" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="active">Aktywne (obecne)</option>
                <option value="past">Historyczne (stare)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold border-b border-border-custom pb-1">Lewe Oko (OS)</h4>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" step="0.25" placeholder="Sfera (np. -1.5)" className="bg-background border border-border-custom rounded-lg p-2 text-sm" value={formData.sphere_l} onChange={e => setFormData({...formData, sphere_l: e.target.value})} />
              <input type="number" step="0.25" placeholder="Cylinder" className="bg-background border border-border-custom rounded-lg p-2 text-sm" value={formData.cyl_l} onChange={e => setFormData({...formData, cyl_l: e.target.value})} />
              <input type="number" step="1" placeholder="Oś (np. 10)" className="bg-background border border-border-custom rounded-lg p-2 text-sm" value={formData.axis_l} onChange={e => setFormData({...formData, axis_l: e.target.value})} />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold border-b border-border-custom pb-1">Prawe Oko (OD)</h4>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" step="0.25" placeholder="Sfera (np. -2.75)" className="bg-background border border-border-custom rounded-lg p-2 text-sm" value={formData.sphere_r} onChange={e => setFormData({...formData, sphere_r: e.target.value})} />
              <input type="number" step="0.25" placeholder="Cylinder" className="bg-background border border-border-custom rounded-lg p-2 text-sm" value={formData.cyl_r} onChange={e => setFormData({...formData, cyl_r: e.target.value})} />
              <input type="number" step="1" placeholder="Oś (np. 10)" className="bg-background border border-border-custom rounded-lg p-2 text-sm" value={formData.axis_r} onChange={e => setFormData({...formData, axis_r: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-text-muted mb-1 block">Data od</label>
              <input type="date" required className="w-full bg-background border border-border-custom rounded-lg p-2 text-sm" value={formData.started_at} onChange={e => setFormData({...formData, started_at: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-bold text-text-muted mb-1 block">Notatka</label>
              <input type="text" placeholder="np. za mocne" className="w-full bg-background border border-border-custom rounded-lg p-2 text-sm" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
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
