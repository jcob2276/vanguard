import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import {
  subscribeToasts,
  subscribeConfirm,
  resolveConfirm,
  type ToastItem,
} from '../../lib/notify';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const TONE = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  error: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  info: 'border-primary/20 bg-primary/10 text-text-primary',
};

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [confirm, setConfirm] = useState({ open: false, message: '' });

  useEffect(() => subscribeToasts(setItems), []);
  useEffect(() => subscribeConfirm((open, message) => setConfirm({ open, message })), []);

  return (
    <>
      <div className="fixed bottom-20 md:bottom-6 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        {items.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-2 rounded-2xl border px-3 py-2.5 shadow-lg backdrop-blur-md text-[12px] font-semibold animate-in slide-in-from-right-4 ${TONE[t.type]}`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="flex-1 leading-snug">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={t.action.onClick}
                  className="ml-1 shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-wide bg-black/10 hover:bg-black/20 active:scale-95 transition-all cursor-pointer"
                >
                  {t.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {confirm.open && (
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
      )}
    </>
  );
}
