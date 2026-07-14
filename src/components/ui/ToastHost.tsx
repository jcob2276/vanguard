import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { subscribeToasts, type ToastItem } from '../../lib/notify';
import ConfirmDialog from './ConfirmDialog';
import Button from './Button';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const TONE = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  error: 'border-danger/30 bg-danger/10 text-rose-700 dark:text-rose-300',
  info: 'border-primary/20 bg-primary/10 text-text-primary',
};

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  return (
    <>
      <div className="fixed bottom-20 md:bottom-6 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        {items.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 shadow-lg backdrop-blur-md text-[12px] font-semibold animate-in slide-in-from-right-4 ${TONE[t.type]}`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="flex-1 leading-snug">{t.message}</span>
              {t.action && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={t.action.onClick}
                  className="ml-1 shrink-0 rounded-[var(--radius-sm)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide bg-black/10 hover:bg-black/20 text-current hover:text-current border-none shadow-none active:scale-95"
                >
                  {t.action.label}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog />
    </>
  );
}
