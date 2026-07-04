export interface TimelineBlock {
  id: string;
  startMin: number; // minutes from midnight
  durationMin: number;
  label: string;
  variant: 'existing' | 'planned';
}

const PX_PER_MIN = 0.55;

/**
 * Compact read-only day timeline — existing calendar events (muted) vs.
 * newly-assigned task times (solid) on the same hour grid, so a conflict is
 * visible while picking a time instead of only after saving.
 */
export default function DayTimeline({
  blocks,
  dayStartHour = 7,
  dayEndHour = 22,
}: {
  blocks: TimelineBlock[];
  dayStartHour?: number;
  dayEndHour?: number;
}) {
  const dayStartMin = dayStartHour * 60;
  const totalMinutes = (dayEndHour - dayStartHour) * 60;
  const heightPx = totalMinutes * PX_PER_MIN;
  const hours = Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, i) => dayStartHour + i);

  return (
    <div className="rounded-2xl border border-border-custom/40 bg-surface-solid/10 overflow-y-auto" style={{ maxHeight: 240 }}>
      <div className="relative" style={{ height: heightPx }}>
        {hours.map((h) => (
          <div key={h} className="absolute left-0 right-0 flex items-start" style={{ top: (h - dayStartHour) * 60 * PX_PER_MIN }}>
            <span className="w-10 shrink-0 text-[8px] font-bold text-text-muted/50 -translate-y-1.5 text-right pr-1.5">
              {String(h).padStart(2, '0')}:00
            </span>
            <div className="flex-1 border-t border-border-custom/20" />
          </div>
        ))}
        <div className="absolute inset-y-0 right-1" style={{ left: 42 }}>
          {blocks.map((b) => {
            const clampedStart = Math.max(b.startMin, dayStartMin);
            const top = (clampedStart - dayStartMin) * PX_PER_MIN;
            const height = Math.max(9, b.durationMin * PX_PER_MIN);
            const isExisting = b.variant === 'existing';
            return (
              <div
                key={b.id}
                title={b.label}
                className={`absolute left-0 right-0 rounded-md px-1.5 overflow-hidden whitespace-nowrap text-[9px] font-bold leading-tight ${
                  isExisting
                    ? 'bg-text-primary/[0.08] text-text-secondary border border-border-custom/40'
                    : 'bg-primary text-white shadow-sm z-10'
                }`}
                style={{ top, height }}
              >
                {b.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
