import { useEffect, useState } from 'react';
import { subscribeConfirm, resolveConfirm } from '../../lib/notify';

export default function ConfirmDialog() {
  const [confirm, setConfirm] = useState({ open: false, message: '' });

  useEffect(() => subscribeConfirm((open, message) => setConfirm({ open, message })), []);

  if (!confirm.open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border-custom bg-surface p-5 shadow-xl">
        <p className="text-[13px] font-semibold text-text-primary leading-relaxed">{confirm.message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => resolveConfirm(false)}
            className="rounded-xl border border-border-custom px-4 py-2 text-[11px] font-bold text-text-muted hover:bg-surface-solid cursor-pointer"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={() => resolveConfirm(true)}
            className="rounded-xl bg-primary px-4 py-2 text-[11px] font-bold text-white hover:bg-primary-hover cursor-pointer"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
