import { useCallback, useEffect, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import {
  BEHAVIOR_CAPTURE_ENTRIES,
  BEHAVIOR_CONFOUNDERS,
  storeLabel,
  type BehaviorConfounderKey,
} from '../../lib/behaviorCapture';
import { fetchBehaviorLogsSince, setBehaviorConfounder } from '../../lib/behaviorLogClient';
import { getTodayWarsaw } from '../../lib/date';
import { daysBefore } from './desktopUtils';

interface BehaviorCapturePanelProps {
  userId: string;
}

export default function BehaviorCapturePanel({ userId }: BehaviorCapturePanelProps) {
  const today = getTodayWarsaw();
  const [loading, setLoading] = useState(true);
  const [activeKeys, setActiveKeys] = useState<Set<BehaviorConfounderKey>>(new Set());
  const [savingKey, setSavingKey] = useState<BehaviorConfounderKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchBehaviorLogsSince(userId, daysBefore(7));
      const todayKeys = new Set<BehaviorConfounderKey>();
      for (const row of rows) {
        if (row.date !== today) continue;
        const key = row.behavior_key as BehaviorConfounderKey;
        if (BEHAVIOR_CONFOUNDERS.some((c) => c.key === key)) todayKeys.add(key);
      }
      setActiveKeys(todayKeys);
    } finally {
      setLoading(false);
    }
  }, [userId, today]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleConfounder(key: BehaviorConfounderKey) {
    if (savingKey) return;
    const next = !activeKeys.has(key);
    setSavingKey(key);
    try {
      await setBehaviorConfounder(userId, key, next, today);
      setActiveKeys((prev) => {
        const copy = new Set(prev);
        if (next) copy.add(key);
        else copy.delete(key);
        return copy;
      });
    } finally {
      setSavingKey(null);
    }
  }

  const visibleEntries = BEHAVIOR_CAPTURE_ENTRIES.filter((e) => !e.deprecated);

  return (
    <div className="rounded-[20px] border border-border-custom bg-surface/60 px-5 py-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={12} className="text-primary shrink-0" />
          <p className="text-[8px] font-black uppercase tracking-[0.25em] text-text-muted">
            Gdzie co logować
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="p-1.5 text-text-muted hover:text-text-primary rounded-lg cursor-pointer"
          title="Odśwież sygnały dnia"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <p className="text-[10px] text-text-secondary leading-relaxed">
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
              <p className="text-[10px] font-black uppercase text-text-primary">{entry.label}</p>
              <span className="text-[8px] font-bold uppercase tracking-wider text-primary/80">
                {storeLabel(entry.store)}
              </span>
            </div>
            <p className="mt-1 text-[9px] text-text-secondary">
              <span className="font-bold text-text-muted">Loguj:</span> {entry.logVia}
            </p>
            <p className="text-[9px] text-text-muted">
              <span className="font-bold">Używa:</span> {entry.usedBy}
            </p>
            {entry.note ? (
              <p className="mt-1 text-[9px] text-amber-500/90 leading-snug">{entry.note}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3 space-y-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-text-primary">
          Sygnały dnia ({today})
        </p>
        <p className="text-[9px] text-text-muted leading-relaxed">
          Confoundery na dziś — trafiają do <code className="text-[8px]">behavior_log</code> (illness, strain,
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
                <span className="text-[11px] mr-1">{icon}</span>
                <span className="text-[9px] font-black uppercase tracking-wide">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
