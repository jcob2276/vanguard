import { useEffect, useState } from 'react';
import { subscribeConfirm, resolveConfirm } from '../../lib/notify';
import Modal from './Modal';
import Button from './Button';

export default function ConfirmDialog() {
  const [confirm, setConfirm] = useState({ open: false, message: '' });

  useEffect(() => subscribeConfirm((open, message) => setConfirm({ open, message })), []);

  return (
    <Modal
      isOpen={confirm.open}
      onClose={() => resolveConfirm(false)}
      showCloseButton={false}
      size="sm"
      padding="p-5"
    >
      <p className="text-[13px] font-semibold text-text-primary leading-relaxed">{confirm.message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => resolveConfirm(false)}
        >
          Anuluj
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => resolveConfirm(true)}
        >
          OK
        </Button>
      </div>
    </Modal>
  );
}
