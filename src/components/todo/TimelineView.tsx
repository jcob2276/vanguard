import { useMemo, useRef, useEffect, useState } from 'react';
import { splitEmoji } from './todoUtils';

interface Item {
  id: string;
  title: string;
  status: string;
  duration_minutes: number | null;
  section_id: string | null;
  priority: string;
}

interface Props {
  items: Item[];
  sectionGoalMap: Record<string, string>;
  today: string;
  onToggle: (item: Item) => void;
  onExpand: (id: string) => void;
}

const HOUR_START = 7;
const HOUR_END = 22;
const HOURS = HOUR_END - HOUR_START;
const PX_PER_MIN = 2.4;
const DEFAULT_DURATION = 30;

const GOAL_COLOR: Record<string, { block: string; dot: string }> = {
  cialo:  { block: 'bg-emerald-500/15 border-emerald-500/30', dot: 'bg-emerald-500' },
  duch:   { block: 'bg-violet-500/15 border-violet-500/30',   dot: 'bg-violet-500'  },
  konto:  { block: 'bg-amber-500/15 border-amber-500/30',     dot: 'bg-amber-500'   },
};
const DEFAULT_COLOR = { block: 'bg-surface-solid border-border-custom/40', dot: 'bg-primary/60' };

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export default function TimelineView({ items, sectionGoalMap, today, onToggle, onExpand }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const pending = useMemo(
    () => items.filter((i) => i.status !== 'done' && i.status !== 'dropped'),
    [items]
  );
  const done = useMemo(
    () => items.filter((i) => i.status === 'done'),
    [items]
  );

  // Auto-schedule: stack tasks from 9:00
  const blocks = useMemo(() => {
    return pending.reduce<{ item: Item; start: number; end: number }[]>((acc, item) => {
      const dur = item.duration_minutes ?? DEFAULT_DURATION;
      const start = acc.length ? acc[acc.length - 1].end : 9 * 60; // 9:00 AM in minutes
      acc.push({ item, start, end: start + dur });
      return acc;
    }, []);
  }, [pending]);

  const totalHeight = HOURS * 60 * PX_PER_MIN;

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    const nowMin = nowMinutes();
    const top = Math.max(0, (nowMin - HOUR_START * 60) * PX_PER_MIN - 120);
    scrollRef.current.scrollTop = top;
     
  }, []);

  const nowMin = new Date(nowMs).getHours() * 60 + new Date(nowMs).getMinutes();
  const nowTop = (nowMin - HOUR_START * 60) * PX_PER_MIN;
  const showNow = nowMin >= HOUR_START * 60 && nowMin <= HOUR_END * 60;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-24">
        <div className="relative flex" style={{ height: totalHeight }}>
          {/* Time gutter */}
          <div className="shrink-0 w-12 relative select-none">
            {Array.from({ length: HOURS + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute right-2 text-[9px] font-bold text-text-muted/40 tabular-nums"
                style={{ top: i * 60 * PX_PER_MIN - 6 }}
              >
                {String(HOUR_START + i).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Grid lines + task column */}
          <div className="flex-1 relative border-l border-border-custom/20">
            {/* Hour lines */}
            {Array.from({ length: HOURS + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-border-custom/10"
                style={{ top: i * 60 * PX_PER_MIN }}
              />
            ))}

            {/* Now line */}
            {showNow && (
              <div
                className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                style={{ top: nowTop }}
              >
                <div className="w-2 h-2 rounded-full bg-rose-500 -ml-1 shrink-0" />
                <div className="flex-1 h-[1.5px] bg-rose-500/70" />
              </div>
            )}

            {/* Task blocks */}
            {blocks.map(({ item, start, end }) => {
              const goalKey = item.section_id ? sectionGoalMap[item.section_id] : null;
              const color = goalKey ? (GOAL_COLOR[goalKey] ?? DEFAULT_COLOR) : DEFAULT_COLOR;
              const top = Math.max(0, (start - HOUR_START * 60) * PX_PER_MIN);
              const height = Math.max(24, (end - start) * PX_PER_MIN - 2);
              const { icon, label } = splitEmoji(item.title);
              const tooShort = height < 36;

              return (
                <button
                  key={item.id}
                  onClick={() => onExpand(item.id)}
                  className={`absolute left-1.5 right-2 rounded-xl border px-2 py-1.5 text-left cursor-pointer hover:brightness-110 active:scale-[0.99] transition-all ${color.block}`}
                  style={{ top, height }}
                >
                  <div className="flex items-start gap-1.5 h-full overflow-hidden">
                    <div className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1 ${color.dot}`} />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className={`text-[11px] font-semibold leading-snug text-text-primary ${tooShort ? 'truncate' : 'line-clamp-2'}`}>
                        {icon ? `${icon} ${label}` : label}
                      </p>
                      {!tooShort && (end - start) >= 30 && (
                        <p className="text-[9px] text-text-muted/50 mt-0.5 tabular-nums">
                          {`${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')} – ${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggle(item); }}
                      className="shrink-0 mt-0.5 w-4 h-4 rounded-full border-[1.5px] border-current opacity-30 hover:opacity-80 hover:bg-emerald-500 hover:border-emerald-500 transition-all"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Done tasks */}
        {done.length > 0 && (
          <div className="px-4 pt-4 pb-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-text-muted/35 mb-2">Ukończone dziś</p>
            <div className="space-y-1">
              {done.map((item) => {
                const { icon, label } = splitEmoji(item.title);
                return (
                  <div key={item.id} className="flex items-center gap-2 text-[11px] text-text-muted/40 line-through">
                    <div className="w-3 h-3 rounded-full bg-emerald-500/40 shrink-0" />
                    {icon && <span className="opacity-60">{icon}</span>}
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
