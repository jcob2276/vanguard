import { notify } from '../../lib/notify';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import { Card } from '../ui/Card';
import { useUserId } from '../../store/useStore';
import PrescriptionCard from './PrescriptionCard';
import AddPrescriptionModal from './AddPrescriptionModal';
import { fetchPrescriptions, importPrescriptions } from '../../lib/visionApi';
import type { Prescription } from '../../lib/visionApi';

export type { Prescription };

export default function GlassesCabinet() {
  const userId = useUserId();
  const [showAddForm, setShowAddForm] = useState(false);

  const prescriptionsQuery = useQuery({
    queryKey: ['prescriptions', userId],
    queryFn: () => fetchPrescriptions(userId!),
    enabled: !!userId,
  });
 
  const prescriptions = prescriptionsQuery.data ?? [];
  const loading = prescriptionsQuery.isLoading;
 
  const loadFromExcel = async () => {
    if (!userId) return;
    try {
      const excelData = [
        { user_id: userId, type: 'normalized' as const, status: 'active' as const, started_at: '2022-06-15', sphere_r: -2.75, cyl_r: null, axis_r: null, sphere_l: -4.25, cyl_l: -0.75, axis_l: 10, notes: 'PD 61mm' },
        { user_id: userId, type: 'normalized' as const, status: 'past' as const, started_at: '2020-10-24', ended_at: '2022-06-15', sphere_r: -3.25, cyl_r: null, axis_r: null, sphere_l: -4.50, cyl_l: -0.75, axis_l: 10, notes: 'Stare - normalizacja' },
        { user_id: userId, type: 'normalized' as const, status: 'past' as const, started_at: '2019-07-24', ended_at: '2020-10-24', sphere_r: -3.50, cyl_r: null, axis_r: null, sphere_l: -4.50, cyl_l: -0.75, axis_l: 10, notes: 'Stare - normalizacja' },
        { user_id: userId, type: 'differential' as const, status: 'active' as const, started_at: '2024-12-25', notes: 'mg być idealne', sphere_r: -1.50, cyl_r: null, axis_r: null, sphere_l: -3.00, cyl_l: -0.75, axis_l: 10 },
        { user_id: userId, type: 'differential' as const, status: 'past' as const, started_at: '2024-12-25', ended_at: '2024-12-25', notes: 'za mocne', sphere_r: -1.75, cyl_r: null, axis_r: null, sphere_l: -3.25, cyl_l: -0.75, axis_l: 10 },
        { user_id: userId, type: 'differential' as const, status: 'past' as const, started_at: '2024-12-25', ended_at: '2024-12-25', notes: 'za słabe', sphere_r: -1.25, cyl_r: null, axis_r: null, sphere_l: -2.75, cyl_l: -0.75, axis_l: 10 }
      ];
 
      await importPrescriptions(excelData);

      await prescriptionsQuery.refetch();
    } catch (error: unknown) {
      notify('Nie udało się zaimportować okularów.', 'error');
      console.warn('[GlassesCabinet] Failed to import from excel:', error);
    }
  };

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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover transition-colors"
          icon={<Plus size={16} />}
        >
          Dodaj szkła
        </Button>
      </div>

      {loading ? (
        <div className="h-24 rounded-2xl border border-border-custom bg-surface/30 animate-pulse" />
      ) : prescriptions.length === 0 ? (
        <EmptyState
          icon="👓"
          label="Brak wprowadzonych szkieł. Zacznij od załadowania historii z Excela lub dodaj ręcznie."
          action={{ label: 'Załaduj historię z Excela', onClick: loadFromExcel }}
        />
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
              <Card key={p.id} variant="outline" padding="1rem" className="flex flex-col sm:flex-row sm:items-center justify-between">
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
              </Card>
            ))}
          </div>
        </div>
      )}

      {showAddForm && (
        <AddPrescriptionModal onClose={() => setShowAddForm(false)} onSaved={() => void prescriptionsQuery.refetch()} userId={userId} />
      )}
    </div>
  );
}
