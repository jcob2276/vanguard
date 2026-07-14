import Modal from '../ui/Modal';
import Button from '../ui/Button';
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
          <Button
            variant="danger"
            onClick={() => executeDelete('this')}
            disabled={deleting}
            className="w-full py-2.5 text-[11.5px]"
            loading={deleting}
          >
            {deleting ? 'Usuwanie...' : 'Usuń tylko to wystąpienie'}
          </Button>
          <Button
            variant="outline"
            onClick={() => executeDelete('all')}
            disabled={deleting}
            className="w-full py-2.5 text-[11.5px] text-danger border-danger/40 hover:bg-danger/10"
          >
            {deleting ? 'Usuwanie...' : 'Usuń całą serię'}
          </Button>
          <Button
            variant="secondary"
            onClick={onClose}
            className="w-full py-2.5 text-[11.5px] text-text-muted hover:text-text-primary"
          >
            Anuluj
          </Button>
        </div>
      ) : (
        <div className="flex gap-2.5 pt-2">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1 py-2.5 text-[11.5px] text-text-muted hover:text-text-primary"
          >
            Anuluj
          </Button>
          <Button
            variant="danger"
            onClick={() => executeDelete('this')}
            disabled={deleting}
            className="flex-1 py-2.5 text-[11.5px]"
            loading={deleting}
          >
            {deleting ? 'Usuwanie...' : 'Usuń'}
          </Button>
        </div>
      )}
    </Modal>
  );
}
