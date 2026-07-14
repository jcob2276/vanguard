import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, RefreshCw } from 'lucide-react';
import Button from '../../ui/Button';
import { Card } from '../../ui/Card';
import {
  BEHAVIOR_CAPTURE_ENTRIES,
  BEHAVIOR_CONFOUNDERS,
  storeLabel,
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

  const visibleEntries = BEHAVIOR_CAPTURE_ENTRIES.filter((e) => !e.deprecated);

  return (
    <Card padding="1rem 1.25rem" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={12} className="text-primary shrink-0" />
          <p className="text-2xs font-black uppercase tracking-[0.25em] text-text-muted">
            Gdzie co logować
          </p>
        </div>
        <Button
          onClick={() => void logsQuery.refetch()}
          variant="ghost"
          icon={<RefreshCw size={12} className={loading ? 'animate-spin' : ''} />}
          className="p-1.5 rounded-lg"
          title="Odśwież sygnały dnia"
        />
      </div>

      <p className="text-xs text-text-secondary leading-relaxed">
        Jedna mapa pamięci behawioralnej — unikaj duplikatów w złych tabelach. Lenie, sauna i stream mają osobne,
        kanoniczne ścieżki.
      </p>

      <div className="space-y-2">
        {visibleEntries.map((entry) => (
          <div
            key={entry.id}
            className="rounded-xl border border-border-custom/80 bg-surface/40 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <p className="text-xs font-black uppercase text-text-primary">{entry.label}</p>
              <span className="text-2xs font-bold uppercase tracking-wider text-primary/80">
                {storeLabel(entry.store)}
              </span>
            </div>
            <p className="mt-1 text-2xs text-text-secondary">
              <span className="font-bold text-text-muted">Loguj:</span> {entry.logVia}
            </p>
            <p className="text-2xs text-text-muted">
              <span className="font-bold">Używa:</span> {entry.usedBy}
            </p>
            {entry.note ? (
              <p className="mt-1 text-2xs text-warning/90 leading-snug">{entry.note}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3 space-y-2">
        <p className="text-2xs font-black uppercase tracking-widest text-text-primary">
          Sygnały dnia ({today})
        </p>
        <p className="text-2xs text-text-muted leading-relaxed">
          Confoundery na dziś — trafiają do <code className="text-2xs">behavior_log</code> (illness, strain,
          korelacje). Nie mylić z nawykami ani sauną.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {BEHAVIOR_CONFOUNDERS.map(({ key, label, icon }) => {
            const on = activeKeys.has(key);
            return (
              <button
                key={key}
                type="button"
                disabled={savingKey === key}
                onClick={() => void toggleConfounder(key)}
                className={`rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer disabled:opacity-60 ${
                  on
                    ? 'border-primary/40 bg-primary/10 text-text-primary'
                    : 'border-border-custom bg-surface text-text-muted hover:text-text-secondary'
                }`}
              >
                <span className="text-xs mr-1">{icon}</span>
                <span className="text-2xs font-black uppercase tracking-wide">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
