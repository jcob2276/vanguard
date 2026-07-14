import { Pressable } from '../ui/ControlPrimitives';
import { AlertTriangle, ArrowRight, CalendarDays, Flag } from 'lucide-react';
import { Card } from '../ui/Card';
import type { EnrichedCheckpoint } from '../../lib/checkpoints';

const PILLAR_COLOR = {
  cialo: 'text-success',
  duch: 'text-primary',
  konto: 'text-warning',
};

const DOT_COLOR: Record<string, string> = {
  indigo: 'bg-primary',
  violet: 'bg-primary',
  sky: 'bg-info',
  emerald: 'bg-success',
  amber: 'bg-warning',
  rose: 'bg-danger',
};

type CheckpointFillPayload = {
  title: string;
  checkpointId: string;
  projectId: string;
};

type Props = {
  checkpoints: EnrichedCheckpoint[];
  loading?: boolean;
  onFillSlot: (payload: CheckpointFillPayload, slotIndex?: number) => void;
  occupiedSlots?: boolean[];
  compact?: boolean;
};

export default function PlanningCheckpointsStrip({
  checkpoints,
  loading = false,
  onFillSlot,
  occupiedSlots = [],
  compact = false,
}: Props) {
  if (loading || checkpoints.length === 0) return null;

  const firstEmpty = occupiedSlots.findIndex((o) => !o);

  const handleFill = (cp: EnrichedCheckpoint) => {
    const slot = firstEmpty >= 0 ? firstEmpty : occupiedSlots.length;
    onFillSlot(
      { title: cp.title, checkpointId: cp.id, projectId: cp.project_id },
      slot >= 0 && slot < 5 ? slot : undefined,
    );
  };

  const shown = checkpoints.slice(0, compact ? 3 : 5);

  return (
    <Card variant="notice" padding="0.875rem" className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Flag size={12} className="text-warning dark:text-warning shrink-0" />
        <p className="text-2xs font-black uppercase tracking-widest text-warning dark:text-warning">
          Checkpointy → wpisz do 5 zadań
        </p>
      </div>
      <div className="space-y-1.5">
        {shown.map((cp) => {
          const dotClass = DOT_COLOR[cp.project.color ?? ''] ?? 'bg-primary';
          const pillarClass = PILLAR_COLOR[cp.project.pillar as keyof typeof PILLAR_COLOR] ?? 'text-text-muted';
          return (
            <div
              key={cp.id}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
                cp.isOverdue ? 'border-danger/25 bg-danger/[0.03]' : 'border-border-custom bg-surface/60'
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-text-primary">{cp.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-text-muted">
                  <span className={`truncate ${pillarClass}`}>{cp.project.name}</span>
                  {cp.isOverdue ? (
                    <span className="flex shrink-0 items-center gap-0.5 font-black text-danger">
                      <AlertTriangle size={9} />
                      {cp.daysLate === 1 ? '1d po terminie' : `${cp.daysLate}d po terminie`}
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-0.5 font-bold">
                      <CalendarDays size={9} />
                      {cp.daysLeft === 0 ? 'dziś' : `${cp.daysLeft}d`}
                    </span>
                  )}
                </p>
              </div>
              <Pressable
                type="button"
                onClick={() => handleFill(cp)}
                disabled={firstEmpty < 0}
                className="flex shrink-0 items-center gap-0.5 rounded-lg border border-primary/25 bg-primary/10 px-2 py-1 text-2xs font-black uppercase text-primary transition-all hover:bg-primary/20 active:scale-95 disabled:opacity-[var(--opacity-40)] disabled:cursor-not-allowed cursor-pointer"
                title={firstEmpty >= 0 ? `Wpisz do zadania ${firstEmpty + 1}` : 'Wszystkie sloty zajęte'}
              >
                {firstEmpty >= 0 ? `→ ${firstEmpty + 1}` : 'Pełne'}
                <ArrowRight size={9} />
              </Pressable>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
