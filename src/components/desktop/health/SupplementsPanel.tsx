import { Pill, Plus, X, AlertCircle } from 'lucide-react';
import Spinner from '../../ui/Spinner';
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
    <div className="rounded-[20px] border border-border-custom bg-surface/60 px-5 py-4 space-y-4 text-text-primary">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill size={14} className="text-emerald-500 shrink-0" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-text-muted">Suplementy & Cykle</h3>
        </div>
        <button type="button" onClick={() => {
          data.setShowAddForm(!data.showAddForm);
          if (!data.startDate) {
            data.setStartDate(shiftDateStr(getTodayWarsaw(), 0));
            data.setEndDate(shiftDateStr(getTodayWarsaw(), 21));
          }
        }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border-custom hover:border-emerald-500/50 bg-surface-solid/40 text-[9px] font-black uppercase tracking-wider text-text-muted hover:text-emerald-500 transition-colors cursor-pointer">
          {data.showAddForm ? <X size={10} /> : <Plus size={10} />}
          <span>{data.showAddForm ? 'Anuluj' : 'Dodaj Cykl'}</span>
        </button>
      </div>

      {data.error && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-500 text-[10px]">
          <AlertCircle size={12} /><span>{data.error}</span>
        </div>
      )}

      {data.showAddForm && (
        <SupplementAddForm onClose={() => data.setShowAddForm(false)}
          name={data.name} setName={data.setName} emoji={data.emoji} setEmoji={data.setEmoji}
          unit={data.unit} setUnit={data.setUnit} skipQty={data.skipQty} setSkipQty={data.setSkipQty}
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
        <div className="py-6 text-center border border-dashed border-border-custom rounded-xl text-text-muted text-[11px]">
          Brak aktywnych suplementów. Kliknij "Dodaj Cykl" powyżej.
        </div>
      ) : (
        <div className="space-y-3">
          {data.activeSups.map(sup => (
            <SupplementCard key={sup.id} sup={sup} takenToday={data.isLogged(sup.id, data.today)}
              last7Days={data.last7Days} today={data.today}
              onToggle={() => void data.handleToggle(sup)}
              onDeactivate={() => void data.handleDeactivate(sup)}
              isLogged={data.isLogged} />
          ))}
        </div>
      )}
    </div>
  );
}
