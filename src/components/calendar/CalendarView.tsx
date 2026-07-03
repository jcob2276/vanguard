import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Calendar,
  List,
  LayoutGrid,
  X,
  Clock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCalendarWrite, type CalendarEvent } from '../../hooks/useCalendarWrite';

interface Props {
  session: any;
  onBack: () => void;
  onSyncCalendar: () => void;
  isSyncing: boolean;
}

type CalView = 'dzien' | 'tydzien' | 'agenda';

interface CalRow {
  id: string;
  event_id: string | null;
  summary: string | null;
  start_time: string | null;
  end_time: string | null;
  category: string | null;
}

const HOUR_START = 6;
const HOUR_END = 23;
const HOURS = HOUR_END - HOUR_START;
const PX_PER_HOUR = 64;
const PX_PER_MIN = PX_PER_HOUR / 60;

const WARSAW_OFFSET = '+02:00'; // CEST; simplified constant

function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return toLocalISO(new Date(dt.getTime()));
}

function weekMon(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // Mon=0
  dt.setUTCDate(dt.getUTCDate() - dow);
  return toLocalISO(new Date(dt.getTime()));
}

function todayStr() {
  return toLocalISO(new Date());
}

function dayLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric' });
}

function monthLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function parseTime(iso: string) {
  // Returns minutes from midnight
  const parts = iso.split('T');
  if (parts.length < 2) return 0;
  const timePart = parts[1];
  const [h, min] = timePart.split(':').map(Number);
  return h * 60 + (min || 0);
}

function formatTime(iso: string) {
  const parts = iso.split('T');
  if (parts.length < 2) return '';
  return parts[1].slice(0, 5);
}

function dateOfISO(iso: string) {
  return iso.split('T')[0];
}

function nowMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

const CATEGORY_COLORS: Record<string, string> = {
  work: 'bg-blue-500/80 border-blue-600/50',
  health: 'bg-emerald-500/80 border-emerald-600/50',
  personal: 'bg-violet-500/80 border-violet-600/50',
  sport: 'bg-orange-500/80 border-orange-600/50',
  study: 'bg-sky-500/80 border-sky-600/50',
};

function eventColor(ev: CalRow) {
  if (ev.category && CATEGORY_COLORS[ev.category.toLowerCase()]) {
    return CATEGORY_COLORS[ev.category.toLowerCase()];
  }
  return 'bg-primary/75 border-primary/50';
}

interface QuickCreateState {
  date: string;
  startMin: number; // minutes from midnight
}

export default function CalendarView({ session, onBack, onSyncCalendar, isSyncing }: Props) {
  const userId = session?.user?.id as string | undefined;
  const accessToken = session?.access_token as string | undefined;

  const today = todayStr();
  const [calView, setCalView] = useState<CalView>('dzien');
  const [selectedDay, setSelectedDay] = useState(today);
  const [weekStart, setWeekStart] = useState(() => weekMon(today));
  const [events, setEvents] = useState<CalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickCreate, setQuickCreate] = useState<QuickCreateState | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDuration, setQuickDuration] = useState(60);
  const [saving, setSaving] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);

  const { createEvent } = useCalendarWrite({ userId, accessToken });

  // Fetch events for visible date range
  const fetchEvents = useCallback(async () => {
    if (!userId) return;
    let rangeStart = '';
    let rangeEnd = '';
    if (calView === 'dzien') {
      rangeStart = selectedDay;
      rangeEnd = addDays(selectedDay, 1);
    } else if (calView === 'tydzien') {
      rangeStart = weekStart;
      rangeEnd = addDays(weekStart, 7);
    } else {
      // agenda: next 14 days
      rangeStart = today;
      rangeEnd = addDays(today, 14);
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vanguard_calendar')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', `${rangeStart}T00:00:00`)
        .lt('start_time', `${rangeEnd}T00:00:00`)
        .order('start_time', { ascending: true });
      if (error) throw error;
      setEvents((data as CalRow[]) || []);
    } catch (e) {
      console.error('CalendarView fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [userId, calView, selectedDay, weekStart, today]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Scroll to current time on day view mount
  useEffect(() => {
    if (calView !== 'dzien' && calView !== 'tydzien') return;
    const el = gridRef.current;
    if (!el) return;
    const min = nowMinutes();
    const top = (min - HOUR_START * 60) * PX_PER_MIN - 80;
    el.scrollTop = Math.max(0, top);
  }, [calView]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const eventsForDay = useCallback((day: string) => {
    return events.filter((e) => e.start_time && dateOfISO(e.start_time) === day);
  }, [events]);

  function handleSlotClick(date: string, hour: number, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clickedMin = Math.round(((hour * 60 + (offsetY / PX_PER_HOUR) * 60)) / 15) * 15;
    setQuickCreate({ date, startMin: clickedMin });
    setQuickTitle('');
    setQuickDuration(60);
  }

  async function handleQuickSave() {
    if (!quickCreate || !quickTitle.trim()) return;
    setSaving(true);
    const { date, startMin } = quickCreate;
    const endMin = startMin + quickDuration;
    const [y, m, d] = date.split('-');
    const startH = Math.floor(startMin / 60);
    const startM = startMin % 60;
    const endH = Math.floor(endMin / 60);
    const endM = endMin % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    const start = `${y}-${m}-${d}T${pad(startH)}:${pad(startM)}:00${WARSAW_OFFSET}`;
    const end = `${y}-${m}-${d}T${pad(Math.min(endH, 23))}:${pad(endM)}:00${WARSAW_OFFSET}`;
    const ev: CalendarEvent = { summary: quickTitle.trim(), start, end };
    try {
      const result = await createEvent(ev);
      const newRow: CalRow = {
        id: result.eventId || String(Date.now()),
        event_id: result.eventId || null,
        summary: ev.summary,
        start_time: start,
        end_time: end,
        category: null,
      };
      setEvents((prev) => [...prev, newRow].sort((a, b) =>
        (a.start_time || '').localeCompare(b.start_time || ''),
      ));
      setQuickCreate(null);
    } catch (err) {
      console.error('create event error:', err);
    } finally {
      setSaving(false);
    }
  }

  function minutesLabel(m: number) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  // ── Render helpers ──

  function renderEventBlock(ev: CalRow, colWidth: string) {
    if (!ev.start_time || !ev.end_time) return null;
    const startMin = parseTime(ev.start_time);
    const endMin = parseTime(ev.end_time);
    const top = Math.max(0, (startMin - HOUR_START * 60) * PX_PER_MIN);
    const height = Math.max(20, (endMin - startMin) * PX_PER_MIN);
    const tooShort = height < 32;
    return (
      <div
        key={ev.id}
        className={`absolute left-0.5 right-0.5 rounded-lg border px-1.5 py-1 overflow-hidden cursor-pointer hover:brightness-110 transition-all shadow-sm ${eventColor(ev)}`}
        style={{ top, height, width: colWidth }}
        title={ev.summary || ''}
      >
        <p className="text-white text-[9px] font-black leading-tight line-clamp-2">
          {ev.summary}
        </p>
        {!tooShort && (
          <p className="text-white/70 text-[8px] leading-tight mt-0.5">
            {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
          </p>
        )}
      </div>
    );
  }

  function renderTimeGutter() {
    return (
      <div className="flex flex-col shrink-0" style={{ width: 36 }}>
        {Array.from({ length: HOURS + 1 }, (_, i) => (
          <div
            key={i}
            className="text-[9px] font-bold text-text-muted/60 text-right pr-1 shrink-0"
            style={{ height: PX_PER_HOUR, lineHeight: `${PX_PER_HOUR}px` }}
          >
            {String(HOUR_START + i).padStart(2, '0')}:00
          </div>
        ))}
      </div>
    );
  }

  function renderDayColumn(day: string, colClass = '') {
    const dayEvents = eventsForDay(day);
    const isToday = day === today;
    const nowLine = isToday ? (nowMinutes() - HOUR_START * 60) * PX_PER_MIN : null;
    return (
      <div
        key={day}
        className={`relative flex-1 min-w-0 ${colClass}`}
        style={{ height: HOURS * PX_PER_HOUR }}
      >
        {/* Hour rows */}
        {Array.from({ length: HOURS }, (_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-t border-border-custom/20 cursor-pointer hover:bg-primary/5 transition-colors"
            style={{ top: i * PX_PER_HOUR, height: PX_PER_HOUR }}
            onClick={(e) => handleSlotClick(day, HOUR_START + i, e)}
          />
        ))}
        {/* Events */}
        {dayEvents.map((ev) => renderEventBlock(ev, 'calc(100% - 4px)'))}
        {/* Now line */}
        {nowLine !== null && nowLine >= 0 && (
          <div
            className="absolute left-0 right-0 flex items-center pointer-events-none z-10"
            style={{ top: nowLine }}
          >
            <div className="w-2 h-2 rounded-full bg-rose-500 -ml-1" />
            <div className="flex-1 h-[1.5px] bg-rose-500/80" />
          </div>
        )}
      </div>
    );
  }

  // ── Views ──

  function renderDayView() {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Day nav */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-custom/20">
          <button onClick={() => setSelectedDay(addDays(selectedDay, -1))} className="p-2 rounded-full hover:bg-surface-solid transition-colors">
            <ChevronLeft size={18} className="text-text-muted" />
          </button>
          <div className="text-center">
            <p className="text-[14px] font-bold text-text-primary">{monthLabel(selectedDay)}</p>
            {selectedDay !== today && (
              <button onClick={() => setSelectedDay(today)} className="text-[10px] text-primary font-semibold">Wróć do dziś</button>
            )}
          </div>
          <button onClick={() => setSelectedDay(addDays(selectedDay, 1))} className="p-2 rounded-full hover:bg-surface-solid transition-colors">
            <ChevronRight size={18} className="text-text-muted" />
          </button>
        </div>
        {/* Grid */}
        <div ref={gridRef} className="flex-1 overflow-y-auto">
          <div className="flex" style={{ minHeight: HOURS * PX_PER_HOUR + 40 }}>
            {renderTimeGutter()}
            <div className="flex-1 relative">
              {renderDayColumn(selectedDay)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderWeekView() {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Week nav */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-custom/20">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded-full hover:bg-surface-solid transition-colors">
            <ChevronLeft size={18} className="text-text-muted" />
          </button>
          <div className="text-center">
            <p className="text-[12px] font-bold text-text-primary">
              {dayLabel(weekStart)} – {dayLabel(addDays(weekStart, 6))}
            </p>
            {!weekDays.includes(today) && (
              <button onClick={() => setWeekStart(weekMon(today))} className="text-[10px] text-primary font-semibold">Bieżący tydzień</button>
            )}
          </div>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded-full hover:bg-surface-solid transition-colors">
            <ChevronRight size={18} className="text-text-muted" />
          </button>
        </div>
        {/* Day headers */}
        <div className="flex border-b border-border-custom/20" style={{ paddingLeft: 36 }}>
          {weekDays.map((day) => {
            const isToday = day === today;
            return (
              <div key={day} className="flex-1 text-center py-1.5">
                <p className={`text-[9px] font-black uppercase ${isToday ? 'text-primary' : 'text-text-muted'}`}>
                  {new Date(day + 'T12:00:00').toLocaleDateString('pl-PL', { weekday: 'short' })}
                </p>
                <p className={`text-[13px] font-black leading-none mt-0.5 ${isToday ? 'text-primary' : 'text-text-secondary'}`}>
                  {parseInt(day.split('-')[2])}
                </p>
              </div>
            );
          })}
        </div>
        {/* Grid */}
        <div ref={gridRef} className="flex-1 overflow-y-auto">
          <div className="flex" style={{ minHeight: HOURS * PX_PER_HOUR + 40 }}>
            {renderTimeGutter()}
            {weekDays.map((day) => (
              <div
                key={day}
                className={`flex-1 relative border-l border-border-custom/10 ${day === today ? 'bg-primary/[0.02]' : ''}`}
              >
                {renderDayColumn(day)}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderAgendaView() {
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
    return (
      <div className="flex-1 overflow-y-auto pb-20">
        {days.map((day) => {
          const dayEv = eventsForDay(day);
          if (dayEv.length === 0 && day !== today) return null;
          return (
            <div key={day} className="px-4 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[11px] font-black ${day === today ? 'text-primary' : 'text-text-muted'}`}>
                  {day === today ? 'Dziś' : dayLabel(day)}
                </span>
                {dayEv.length === 0 && (
                  <span className="text-[9px] text-text-muted/40">brak wydarzeń</span>
                )}
              </div>
              <div className="space-y-1.5">
                {dayEv.map((ev) => (
                  <div
                    key={ev.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${eventColor(ev).replace('bg-', 'border-').split(' ')[0]} bg-surface-solid/50`}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${eventColor(ev).split(' ')[0].replace('bg-', 'bg-')}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-text-primary line-clamp-1">{ev.summary}</p>
                      {ev.start_time && (
                        <p className="text-[9px] text-text-muted mt-0.5">
                          {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-b border-border-custom/10" />
            </div>
          );
        })}
        {events.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Calendar size={32} className="text-text-muted/30" />
            <div className="text-center">
              <p className="text-[13px] font-bold text-text-muted">Brak wydarzeń</p>
              <p className="text-[11px] text-text-muted/60 mt-1">Zsynchronizuj Google Calendar</p>
            </div>
            <button
              onClick={onSyncCalendar}
              className="flex items-center gap-2 rounded-full bg-primary/10 text-primary border border-primary/20 px-4 py-2 text-[12px] font-bold"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              Synchronizuj
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Quick create modal ──
  function renderQuickCreate() {
    if (!quickCreate) return null;
    const { date, startMin } = quickCreate;
    const endMin = startMin + quickDuration;
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0" onClick={() => setQuickCreate(null)}>
        <div
          className="w-full max-w-md rounded-t-3xl bg-background border-t border-border-custom shadow-2xl p-5 pb-10 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-black text-text-primary">Nowe wydarzenie</p>
            <button onClick={() => setQuickCreate(null)} className="p-1 text-text-muted hover:text-text-primary">
              <X size={18} />
            </button>
          </div>
          <input
            autoFocus
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleQuickSave(); }}
            placeholder="Tytuł wydarzenia..."
            className="w-full bg-surface-solid/50 border border-border-custom/60 rounded-xl px-4 py-3 text-[14px] font-medium text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40"
          />
          <div className="flex items-center gap-3">
            <Clock size={14} className="text-text-muted shrink-0" />
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[12px] font-semibold text-text-secondary">
                {monthLabel(date)}, {minutesLabel(startMin)} – {minutesLabel(endMin)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted font-semibold">Czas:</span>
            {[30, 60, 90, 120].map((d) => (
              <button
                key={d}
                onClick={() => setQuickDuration(d)}
                className={`text-[11px] font-black px-2.5 py-1.5 rounded-xl border transition-all ${quickDuration === d ? 'bg-primary/15 text-primary border-primary/30' : 'border-border-custom/60 text-text-muted hover:text-text-primary'}`}
              >
                {d < 60 ? `${d}min` : `${d / 60}h`}
              </button>
            ))}
          </div>
          <button
            onClick={handleQuickSave}
            disabled={saving || !quickTitle.trim()}
            className="w-full rounded-xl bg-primary text-white py-3 text-[13px] font-black disabled:opacity-40 transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            {saving ? 'Dodaję...' : 'Dodaj wydarzenie'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-text-primary overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-custom/60 bg-background/90 px-4 py-3 backdrop-blur-xl shrink-0">
        <button onClick={onBack} className="p-1.5 text-primary">
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <h1 className="text-[18px] font-black text-text-primary flex-1">Kalendarz</h1>

        {/* View switcher */}
        <div className="flex items-center rounded-xl border border-border-custom/50 bg-surface/40 p-0.5 gap-0.5">
          {([['dzien', Calendar], ['tydzien', LayoutGrid], ['agenda', List]] as [CalView, any][]).map(([v, Icon]) => (
            <button
              key={v}
              onClick={() => setCalView(v)}
              className={`rounded-lg p-1.5 transition-all ${calView === v ? 'bg-primary/15 text-primary' : 'text-text-muted hover:text-text-primary'}`}
              title={v}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>

        <button
          onClick={() => { onSyncCalendar(); setTimeout(fetchEvents, 2000); }}
          disabled={isSyncing}
          className="p-1.5 text-text-muted hover:text-primary transition-colors"
          title="Synchronizuj"
        >
          <RefreshCw size={16} className={isSyncing || loading ? 'animate-spin' : ''} />
        </button>

        <button
          onClick={() => {
            setQuickCreate({ date: selectedDay, startMin: 9 * 60 });
            setQuickTitle('');
            setQuickDuration(60);
          }}
          className="rounded-full bg-primary p-2 text-white shadow-md shadow-primary/20"
          title="Nowe wydarzenie"
        >
          <Plus size={16} />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {calView === 'dzien' && renderDayView()}
        {calView === 'tydzien' && renderWeekView()}
        {calView === 'agenda' && renderAgendaView()}
      </div>

      {/* Quick create modal */}
      {renderQuickCreate()}
    </div>
  );
}
