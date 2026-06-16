import { useState } from 'react';

export interface AlertItem {
  type: 'warn' | 'info' | 'ok';
  msg: string;
}

interface SmartAlertsProps {
  alerts: AlertItem[];
}

export default function SmartAlerts({ alerts }: SmartAlertsProps) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const visible = alerts.filter((_, i) => !dismissed.has(i));
  if (!visible.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {alerts.map((a, i) => {
        if (dismissed.has(i)) return null;
        const cfg = {
          warn: 'bg-amber-500/[0.07] border-amber-500/25 text-amber-700 dark:text-amber-400',
          info: 'bg-sky-500/[0.07] border-sky-500/25 text-sky-700 dark:text-sky-400',
          ok:   'bg-emerald-500/[0.07] border-emerald-500/25 text-emerald-700 dark:text-emerald-400',
        }[a.type];
        const icon = { warn: '⚠', info: 'ℹ', ok: '✓' }[a.type];

        return (
          <div key={i} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold ${cfg}`}>
            <span>{icon}</span>
            <span>{a.msg}</span>
            <button
              onClick={() => setDismissed(d => {
                const next = new Set(d);
                next.add(i);
                return next;
              })}
              className="ml-1 opacity-40 hover:opacity-100 transition-opacity cursor-pointer text-[13px] leading-none"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
