import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Glasses } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import PrescriptionCard from './PrescriptionCard';
import AddPrescriptionModal from './AddPrescriptionModal';

export type Prescription = {
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
      setPrescriptions((data || []) as Prescription[]);
    } catch (error: unknown) {
      console.error('[Background Error]', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFromExcel = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const excelData = [
        { user_id: user.id, type: 'normalized', status: 'active', started_at: '2022-06-15', sphere_r: -2.75, cyl_r: null, axis_r: null, sphere_l: -4.25, cyl_l: -0.75, axis_l: 10, notes: 'PD 61mm' },
        { user_id: user.id, type: 'normalized', status: 'past', started_at: '2020-10-24', ended_at: '2022-06-15', sphere_r: -3.25, cyl_r: null, axis_r: null, sphere_l: -4.50, cyl_l: -0.75, axis_l: 10, notes: 'Stare - normalizacja' },
        { user_id: user.id, type: 'normalized', status: 'past', started_at: '2019-07-24', ended_at: '2020-10-24', sphere_r: -3.50, cyl_r: null, axis_r: null, sphere_l: -4.50, cyl_l: -0.75, axis_l: 10, notes: 'Stare - normalizacja' },
        { user_id: user.id, type: 'differential', status: 'active', started_at: '2024-12-25', notes: 'mg być idealne', sphere_r: -1.50, cyl_r: null, axis_r: null, sphere_l: -3.00, cyl_l: -0.75, axis_l: 10 },
        { user_id: user.id, type: 'differential', status: 'past', started_at: '2024-12-25', ended_at: '2024-12-25', notes: 'za mocne', sphere_r: -1.75, cyl_r: null, axis_r: null, sphere_l: -3.25, cyl_l: -0.75, axis_l: 10 },
        { user_id: user.id, type: 'differential', status: 'past', started_at: '2024-12-25', ended_at: '2024-12-25', notes: 'za słabe', sphere_r: -1.25, cyl_r: null, axis_r: null, sphere_l: -2.75, cyl_l: -0.75, axis_l: 10 }
      ];
      
      const { error } = await supabase.from('endmyopia_prescriptions').insert(excelData);
      if (error) throw error;
      
      await loadPrescriptions();
    } catch (error: unknown) {
      console.error('[Background Error]', error);
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
        <h3 className="text-xl font-bold">Twoja Szafka ze Szkłami</h3>
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
