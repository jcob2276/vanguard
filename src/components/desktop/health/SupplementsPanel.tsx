import Button from '../../ui/Button';
import { Pill, Plus, X, AlertCircle } from 'lucide-react';
import Spinner from '../../ui/Spinner';
import EmptyState from '../../ui/EmptyState';
import { Card } from '../../ui/Card';
import { getTodayWarsaw, shiftDateStr } from '../../../lib/date';
import { useSupplementsData } from './useSupplementsData';
import SupplementCard from './SupplementCard';
import SupplementAddForm from './SupplementAddForm';

interface SupplementsPanelProps {
  userId: string;
}

export default function SupplementsPanel({ userId }: SupplementsPanelProps) {
  const data = useSupplementsData(userId);

  return (
    <Card padding="1rem 1.25rem" className="space-y-4 text-text-primary">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill size={14} className="text-success shrink-0" />
          <h3 className="text-xs font-black uppercase tracking-[var(--ds-arbitrary-0-25em)] text-text-muted">Suplementy & Cykle</h3>
        </div>
        <Button variant="outline" size="sm" type="button" onClick={() => {
          data.setShowAddForm(!data.showAddForm);
          if (!data.startDate) {
            data.setStartDate(shiftDateStr(getTodayWarsaw(), 0));
            data.setEndDate(shiftDateStr(getTodayWarsaw(), 21));
          }
        }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border-custom hover:border-success/50 bg-surface-solid/40 text-2xs font-black uppercase tracking-wider text-text-muted hover:text-success transition-colors cursor-pointer"
          icon={data.showAddForm ? <X size={10} /> : <Plus size={10} />}
        >
          <span>{data.showAddForm ? 'Anuluj' : 'Dodaj Cykl'}</span>
        </Button>
      </div>

      {data.error && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-danger/20 bg-danger/5 text-danger text-xs">
          <AlertCircle size={12} /><span>{data.error}</span>
        </div>
      )}

      {data.showAddForm && (
        <SupplementAddForm
          name={data.name} setName={data.setName} emoji={data.emoji} setEmoji={data.setEmoji}
          unit={data.unit} setUnit={data.setUnit} skipQty={data.skipQty} setSkipQty={data.setSkipQty}
          reverseLogic={data.reverseLogic} setReverseLogic={data.setReverseLogic}
          hasCycle={data.hasCycle} setHasCycle={data.setHasCycle}
          startDate={data.startDate} setStartDate={data.setStartDate}
          endDate={data.endDate} setEndDate={data.setEndDate}
          hasReminder={data.hasReminder} setHasReminder={data.setHasReminder}
          reminderTime={data.reminderTime} setReminderTime={data.setReminderTime}
          submitting={data.submitting} onSubmit={data.handleSubmit} />
      )}

      {data.loading ? (
        <div className="flex justify-center items-center py-8"><Spinner size="sm" /></div>
      ) : data.activeSups.length === 0 ? (
        <EmptyState icon="💊" label='Brak aktywnych suplementów. Kliknij "Dodaj Cykl" powyżej.' />
      ) : (
        <div className="space-y-3">
          {data.activeSups.map(sup => {
            const isReverse = sup.name.toLowerCase().includes('pyłek') || sup.name.toLowerCase().includes('pollen') || sup.dose_per_unit?.['reverse_logic'] === true;
            const takenToday = isReverse ? !data.isLogged(sup.id, data.today) : data.isLogged(sup.id, data.today);
            return (
              <SupplementCard key={sup.id} sup={sup} takenToday={takenToday}
                last7Days={data.last7Days} today={data.today}
                onToggle={() => void data.handleToggle(sup)}
                onDeactivate={() => void data.handleDeactivate(sup)}
                onUpdateReminder={(reminderTime) => void data.handleUpdateReminder(sup, reminderTime)}
                isLogged={data.isLogged} />
            );
          })}
        </div>
      )}
    </Card>
  );
}
