import { useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { calculateAvailableMinutes, DEFAULT_DAY_CAPACITY, formatMinutes, type DayCapacitySettings } from '../../lib/todo/dayCapacity';
import { useTodayCalendarEvents } from '../calendar/hooks/useTodayCalendarEvents';
import { ControlInput, ControlSelect, Pressable } from '../ui/ControlPrimitives';

interface Props {
  userId: string;
  today: string;
  plannedMinutes: number;
}

export default function DayCapacityBar({ userId, today, plannedMinutes }: Props) {
  const storageKey = `vanguard-day-capacity:${userId}`;
  const [settings, setSettings] = useState<DayCapacitySettings>(() => {
    try { return { ...DEFAULT_DAY_CAPACITY, ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; }
    catch { return DEFAULT_DAY_CAPACITY; }
  });
  const [editing, setEditing] = useState(false);
  const { events } = useTodayCalendarEvents(userId, today);
  const available = calculateAvailableMinutes(settings, events);
  const over = plannedMinutes > available;
  const pct = available > 0 ? Math.min(100, Math.round((plannedMinutes / available) * 100)) : 100;

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(settings)); }, [settings, storageKey]);

  const update = (patch: Partial<DayCapacitySettings>) => setSettings((current) => ({ ...current, ...patch }));

  return (
    <div className="mb-3 rounded-xl bg-surface-solid/20 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted/45">Pojemność dnia</span>
        <Pressable onClick={() => setEditing((value) => !value)} className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-2xs font-bold tabular-nums text-text-muted hover:bg-surface-solid/50">
          {formatMinutes(plannedMinutes)} / {formatMinutes(available)} <Settings2 size={11} />
        </Pressable>
      </div>
      <div className="mt-1.5 h-[var(--ds-h-3px)] overflow-hidden rounded-full bg-surface-solid">
        <div className={`h-full rounded-full transition-[width] duration-[var(--motion-medium)] ${over ? 'bg-danger/75' : 'bg-primary/65'}`} style={{ width: `${pct}%` }} />
      </div>
      {over && <p className="mt-1.5 text-2xs font-medium text-danger">Za dużo o {formatMinutes(plannedMinutes - available)}. Przenieś albo skróć zadanie.</p>}
      {editing && (
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border-custom/20 pt-3">
          <label className="text-2xs text-text-muted">Start<ControlInput type="time" value={settings.start} onChange={(e) => update({ start: e.target.value })} className="mt-1 w-full rounded-lg border border-border-custom/35 bg-background px-2 py-1.5 text-xs text-text-primary" /></label>
          <label className="text-2xs text-text-muted">Koniec<ControlInput type="time" value={settings.end} onChange={(e) => update({ end: e.target.value })} className="mt-1 w-full rounded-lg border border-border-custom/35 bg-background px-2 py-1.5 text-xs text-text-primary" /></label>
          <label className="text-2xs text-text-muted">Przerwa<ControlSelect value={settings.breakMinutes} onChange={(e) => update({ breakMinutes: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-border-custom/35 bg-background px-2 py-1.5 text-xs text-text-primary"><option value={0}>0 min</option><option value={30}>30 min</option><option value={60}>1 godz.</option><option value={90}>1,5 godz.</option></ControlSelect></label>
        </div>
      )}
    </div>
  );
}
