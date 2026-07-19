import { Pressable } from '../../ui/ControlPrimitives';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, RefreshCw } from 'lucide-react';
import { Card } from '../../ui/Card';
import { ToggleChip } from '../../ui/ToggleChip';
import {
  BEHAVIOR_CONFOUNDERS,
  type BehaviorConfounderKey,
} from '../../../lib/behavior/behaviorCapture';
import { fetchBehaviorLogsSince, setBehaviorConfounder } from '../../../lib/behavior/behaviorLogClient';
import { getTodayWarsaw } from '../../../lib/date';
import { daysBefore } from '../desktopUtils';

interface BehaviorCapturePanelProps {
  userId: string;
}

export default function BehaviorCapturePanel({ userId }: BehaviorCapturePanelProps) {
  const today = getTodayWarsaw();
  const queryClient = useQueryClient();
  const [savingKey, setSavingKey] = useState<BehaviorConfounderKey | null>(null);

  const logsQuery = useQuery({
    queryKey: ['behavior-logs', userId],
    queryFn: () => fetchBehaviorLogsSince(userId, daysBefore(7)),
    enabled: !!userId,
  });

  const activeKeys = (() => {
    const keys = new Set<BehaviorConfounderKey>();
    for (const row of logsQuery.data ?? []) {
      if (row.date !== today) continue;
      const key = row.behavior_key as BehaviorConfounderKey;
      if (BEHAVIOR_CONFOUNDERS.some((c) => c.key === key)) keys.add(key);
    }
    return keys;
  })();

  const loading = logsQuery.isLoading;

  async function toggleConfounder(key: BehaviorConfounderKey) {
    if (savingKey) return;
    const next = !activeKeys.has(key);
    setSavingKey(key);
    try {
      await setBehaviorConfounder(userId, key, next, today);
      void queryClient.invalidateQueries({ queryKey: ['behavior-logs', userId] });
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <Card padding="1rem 1.25rem" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Activity size={12} className="text-primary shrink-0" />
          <p className="text-2xs font-black uppercase tracking-[var(--ds-arbitrary-0-25em)] text-text-muted">
            Sygnały dnia ({today})
          </p>
        </div>
        <Pressable
          onClick={() => void logsQuery.refetch()}
          variant="ghost"
          icon={<RefreshCw size={12} className={loading ? 'animate-spin' : ''} />}
          className="p-1.5 rounded-lg"
          title="Odśwież sygnały dnia"
        />
      </div>

      <p className="text-2xs text-text-secondary leading-relaxed">
        Codzienne confoundery rejestrowane bezpośrednio w <code className="text-2xs">behavior_log</code> (np. alkohol, stres, choroba, podróż).
      </p>

      <div className="grid grid-cols-2 gap-2">
        {BEHAVIOR_CONFOUNDERS.map(({ key, label, icon }) => {
          const on = activeKeys.has(key);
          return (
            <ToggleChip
              key={key}
              active={on}
              onClick={() => void toggleConfounder(key)}
              disabled={savingKey === key}
              className="text-left justify-start py-2"
            >
              <span className="text-xs mr-1">{icon}</span>
              <span className="text-2xs font-black uppercase tracking-wide">{label}</span>
            </ToggleChip>
          );
        })}
      </div>
    </Card>
  );
}
