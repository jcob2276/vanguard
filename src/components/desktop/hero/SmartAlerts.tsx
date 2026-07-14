import { useState } from 'react';

interface AlertItem {
  type: 'warn' | 'info' | 'ok';
  msg: string;
}

interface SmartAlertsProps {
  alerts: AlertItem[];
}

import Button from '../../ui/Button';

export default function SmartAlerts({ alerts }: SmartAlertsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = alerts.filter(a => !dismissed.has(a.msg));
  if (!visible.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((a) => {
        const cfg = {
          warn: 'bg-warning/[0.07] border-warning/25 text-warning dark:text-warning',
          info: 'bg-info/[0.07] border-info/25 text-info dark:text-info',
          ok:   'bg-success/[0.07] border-success/25 text-success dark:text-success',
        }[a.type];
        const icon = { warn: '⚠', info: 'ℹ', ok: '✓' }[a.type];

        return (
          <div key={a.msg} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold ${cfg}`}>
            <span>{icon}</span>
            <span>{a.msg}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissed(d => {
                const next = new Set(d);
                next.add(a.msg);
                return next;
              })}
              className="ml-1 opacity-40 hover:opacity-100 transition-opacity cursor-pointer text-[13px] leading-none"
            >
              ×
            </Button>
          </div>
        );
      })}
    </div>
  );
}
