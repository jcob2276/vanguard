import Modal from '../ui/Modal';
import { recurringSeriesBaseId } from './calendarHelpers';
import type { CalRow } from './calendarHelpers';

interface DeleteEventConfirmModalProps {
  selectedEvent: CalRow | null;
  deleting: boolean;
  onClose: () => void;
  executeDelete: (scope: 'this' | 'all') => void;
}

export default function DeleteEventConfirmModal({ selectedEvent, deleting, onClose, executeDelete }: DeleteEventConfirmModalProps) {
  const isRecurringInstance = !!recurringSeriesBaseId(selectedEvent?.event_id || selectedEvent?.id);

  return (
    <Modal isOpen onClose={onClose} showCloseButton={false} size="xs">
      <p className="text-[14px] font-black text-text-primary text-center">Usuń wydarzenie</p>
      <p className="text-[11.5px] font-bold text-text-secondary text-center">
        {isRecurringInstance
          ? 'To wydarzenie jest częścią cyklu. Usunąć tylko to wystąpienie, czy całą serię?'
          : 'Czy na pewno chcesz usunąć to wydarzenie?'}
      </p>
      {isRecurringInstance ? (
        <div className="space-y-2 pt-2">
          <button
            onClick={() => executeDelete('this')}
            disabled={deleting}
            className="w-full rounded-xl bg-rose-500 hover:bg-rose-600 disabled:bg-slate-400 text-white py-2.5 text-[11.5px] font-bold transition-colors"
          >
            {deleting ? 'Usuwanie...' : 'Usuń tylko to wystąpienie'}
          </button>
          <button
            onClick={() => executeDelete('all')}
            disabled={deleting}
            className="w-full rounded-xl border border-rose-500/40 hover:bg-rose-500/10 disabled:opacity-50 text-rose-500 py-2.5 text-[11.5px] font-bold transition-colors"
          >
            {deleting ? 'Usuwanie...' : 'Usuń całą serię'}
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-border-custom/60 py-2.5 text-[11.5px] font-bold text-text-muted hover:text-text-primary hover:bg-surface-solid/40 transition-colors"
          >
            Anuluj
          </button>
        </div>
      ) : (
        <div className="flex gap-2.5 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border-custom/60 py-2.5 text-[11.5px] font-bold text-text-muted hover:text-text-primary hover:bg-surface-solid/40 transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={() => executeDelete('this')}
            disabled={deleting}
            className="flex-1 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:bg-slate-400 text-white py-2.5 text-[11.5px] font-bold transition-colors"
          >
            {deleting ? 'Usuwanie...' : 'Usuń'}
          </button>
        </div>
      )}
    </Modal>
  );
}
