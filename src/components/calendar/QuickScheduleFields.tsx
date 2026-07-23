import { AlignLeft, Bell, CalendarDays, Clock, MapPin } from 'lucide-react';
import { ControlInput, ControlSelect, ControlTextarea } from '../ui/ControlPrimitives';
import type { useCalendarData } from './hooks/useCalendarData';
import type { useCalendar } from './context/CalendarContext';
import CalendarConflictNotice from './CalendarConflictNotice';
import PlanningFrameNotice from './PlanningFrameNotice';
import { minutesLabel } from './calendarHelpers';

interface Props {
  calData: ReturnType<typeof useCalendarData>;
  conflicts: Array<{ summary?: string | null }>;
  budgets: ReturnType<typeof useCalendar>['timeBudgets']['budgets'];
}

export function QuickScheduleFields({ calData, conflicts, budgets }: Props) {
  const {
    quickCreate, setQuickCreate, quickDuration, setQuickDuration,
    quickAllDay, setQuickAllDay, quickLocation, setQuickLocation,
    quickDescription, setQuickDescription, quickReminder, setQuickReminder,
    quickCategory,
  } = calData;
  if (!quickCreate) return null;

  return (
    <>
      <div className="space-y-2.5 rounded-xl border border-border-custom/30 bg-surface-solid/30 p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-text-muted"><Clock size={14} /> Kiedy</span>
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-bold text-text-muted">
            <ControlInput type="checkbox" checked={quickAllDay} onChange={(event) => setQuickAllDay(event.target.checked)} className="h-3.5 w-3.5 cursor-pointer rounded border-border-custom text-primary" />
            Całodniowe
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="space-y-1 text-xs font-bold text-text-secondary">
            <span className="flex items-center gap-1 text-text-muted"><CalendarDays size={12} /> Data</span>
            <ControlInput type="date" value={quickCreate.date} onChange={(event) => event.target.value && setQuickCreate({ ...quickCreate, date: event.target.value })} className="h-9 w-full rounded-lg border border-border-custom/40 bg-surface-solid/50 px-2.5 text-xs font-semibold" />
          </label>
          <label className="space-y-1 text-xs font-bold text-text-secondary">
            <span className="text-text-muted">Od</span>
            <ControlInput
              type="time"
              disabled={quickAllDay}
              value={minutesLabel(quickCreate.startMin)}
              onChange={(event) => {
                if (!event.target.value) return;
                const [hours, minutes] = event.target.value.split(':').map(Number);
                setQuickCreate({ ...quickCreate, startMin: hours * 60 + minutes });
              }}
              className="h-9 w-full rounded-lg border border-border-custom/40 bg-surface-solid/50 px-2.5 text-xs font-semibold disabled:opacity-[var(--opacity-dimmed)]"
            />
          </label>
          <label className="space-y-1 text-xs font-bold text-text-secondary">
            <span className="text-text-muted">Do</span>
            <ControlInput
              type="time"
              disabled={quickAllDay}
              value={minutesLabel(quickCreate.startMin + quickDuration)}
              onChange={(event) => {
                if (!event.target.value) return;
                const [hours, minutes] = event.target.value.split(':').map(Number);
                const duration = hours * 60 + minutes - quickCreate.startMin;
                if (duration > 0) setQuickDuration(duration);
              }}
              className="h-9 w-full rounded-lg border border-border-custom/40 bg-surface-solid/50 px-2.5 text-xs font-semibold disabled:opacity-[var(--opacity-dimmed)]"
            />
          </label>
        </div>
      </div>
      <div className="relative flex items-center">
        <MapPin size={14} className="pointer-events-none absolute left-3.5 text-text-muted" />
        <ControlInput value={quickLocation} onChange={(event) => setQuickLocation(event.target.value)} placeholder="Lokalizacja (opcjonalnie)…" className="w-full rounded-xl border border-border-custom/40 bg-surface-solid/30 py-2 pl-9 pr-3 text-xs" />
      </div>
      <div className="relative flex items-start">
        <AlignLeft size={14} className="pointer-events-none absolute left-3.5 top-3 text-text-muted" />
        <ControlTextarea value={quickDescription} onChange={(event) => setQuickDescription(event.target.value)} rows={2} placeholder="Notatka lub kontekst…" className="w-full resize-y rounded-xl border border-border-custom/40 bg-surface-solid/30 py-2 pl-9 pr-3 text-xs" />
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border-custom/30 bg-surface-solid/30 px-3.5 py-2 text-xs font-bold">
        <Bell size={14} className="shrink-0 text-text-muted" />
        <span className="text-text-muted">Przypomnienie:</span>
        <ControlSelect value={quickReminder ?? ''} onChange={(event) => setQuickReminder(event.target.value ? Number(event.target.value) : null)} className="flex-1 bg-transparent font-bold">
          <option value="">Brak</option><option value="15">15 minut przed</option>
          <option value="30">30 minut przed</option><option value="60">1 godzina przed</option>
          <option value="1440">1 dzień przed</option>
        </ControlSelect>
      </div>
      <CalendarConflictNotice titles={conflicts.map((event) => event.summary || 'Wydarzenie')} />
      {quickCategory ? <PlanningFrameNotice frame={budgets.find((budget) => budget.category === quickCategory)} date={quickCreate.date} startMinutes={quickCreate.startMin} /> : null}
    </>
  );
}
