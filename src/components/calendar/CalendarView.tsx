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
  Trash2,
  Sliders,
  Sparkles,
  Shield,
  Zap,
  Moon,
  StickyNote,
  Check,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCalendarWrite, type CalendarEvent } from '../../hooks/useCalendarWrite';
import { useTimeBudgets } from '../../hooks/useTimeBudgets';
import { useCalendarTodos, type CalendarTodo } from '../../hooks/useCalendarTodos';
import { warsawDayBoundsISO } from '../../lib/date';
import { LIFE_SPHERES, LEGACY_CATEGORY_TO_SPHERE } from '../../lib/lifeSpheres';
import { GOAL_ICON } from '../todo/todoUtils';

import {
  WARSAW_OFFSET,
  HOUR_START,
  HOUR_END,
  HOURS,
  PX_PER_HOUR,
  PX_PER_MIN,
  toLocalISO,
  addDays,
  weekMon,
  todayStr,
  dayLabel,
  monthLabel,
  getWarsawParts,
  parseTime,
  formatTime,
  dateOfISO,
  nowMinutes,
  eventColor,
  layoutDayEvents,
  type CalRow,
} from './calendarHelpers';

import MiniCalendar from './MiniCalendar';
import CalendarSidebarTodos from './CalendarSidebarTodos';
import CalendarBudgetPanel from './CalendarBudgetPanel';

import { useAIScheduling } from '../../hooks/useAIScheduling';
import { useSyncOura } from '../../hooks/useSyncOura';
import { useSyncActivities } from '../../hooks/useSyncActivities';

interface Props {
  session: any;
  onBack: () => void;
  onSyncCalendar: () => void;
  isSyncing: boolean;
  onNavigateTo?: (dest: string) => void;
}

type CalView = 'dzien' | 'tydzien' | 'agenda';

interface QuickCreateState {
  date: string;
  startMin: number; // minutes from midnight
}

export default function CalendarView({ session, onBack, onSyncCalendar, isSyncing, onNavigateTo }: Props) {
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
  const [quickCategory, setQuickCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit event state
  const [selectedEvent, setSelectedEvent] = useState<CalRow | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editDate, setEditDate] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Time Budgeting state
  const [budgetPanelExpanded, setBudgetPanelExpanded] = useState(false);
  const [showBudgetConfig, setShowBudgetConfig] = useState(false);
  const [budgetMinInputs, setBudgetMinInputs] = useState<Record<string, string>>({});
  const [budgetMaxInputs, setBudgetMaxInputs] = useState<Record<string, string>>({});

  // Reclaim.ai features states
  const [focusTimeDefense, setFocusTimeDefense] = useState(true);
  const [decompressionBuffer, setDecompressionBuffer] = useState(true);

  // Custom dialogs & notification states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [nowMin, setNowMin] = useState(() => nowMinutes());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMin(nowMinutes());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const gridRef = useRef<HTMLDivElement>(null);

  const { budgets, saveBudget } = useTimeBudgets(userId || '');
  const { createEvent, updateEvent, deleteEvent } = useCalendarWrite({ userId, accessToken });

  // Visible date range — shared by the calendar-event fetch and the todo-scheduling fetch
  const visibleRange = useMemo(() => {
    if (calView === 'dzien' || calView === 'tydzien') {
      return { rangeStart: weekStart, rangeEnd: addDays(weekStart, 7) };
    }
    return { rangeStart: today, rangeEnd: addDays(today, 14) }; // agenda: next 14 days
  }, [calView, weekStart, today]);

  const {
    inboxTodos,
    scheduledTodos,
    todosForDay,
    newTodoTitle,
    setNewTodoTitle,
    handleQuickAddTodo,
    completedTodoIds,
    handleToggleTodo,
    scheduleTodoAt,
    goalChipFor,
    fetchAllTodos,
  } = useCalendarTodos({ userId, rangeStart: visibleRange.rangeStart, rangeEnd: visibleRange.rangeEnd });

  // Sum event durations for the current week per category
  const categoryWeeklyTotals = useMemo(() => {
    const totals: Record<string, number> = Object.fromEntries(LIFE_SPHERES.map((s) => [s.id, 0]));
    events.forEach((ev) => {
      if (!ev.start_time || !ev.end_time || !ev.category) return;

      // Exclude sleep from the active budget calculations
      const isSleep = ev.summary?.toLowerCase()?.includes('sen') || ev.summary?.toLowerCase()?.includes('sleep');
      if (isSleep) return;

      const cat = LEGACY_CATEGORY_TO_SPHERE[ev.category.toLowerCase()] || ev.category.toLowerCase();

      if (!(cat in totals)) return;
      try {
        const start = new Date(ev.start_time.replace(' ', 'T')).getTime();
        const end = new Date(ev.end_time.replace(' ', 'T')).getTime();
        const diffMs = end - start;
        if (diffMs > 0) {
          const hours = diffMs / (1000 * 60 * 60);
          totals[cat] += hours;
        }
      } catch (e) {
        console.error('Error calculating event duration:', e);
      }
    });
    return totals;
  }, [events]);

  // Fetch events for visible date range
  const fetchEvents = useCallback(async () => {
    if (!userId) return;
    const { rangeStart, rangeEnd } = visibleRange;
    setLoading(true);
    try {
      const { fromISO } = warsawDayBoundsISO(rangeStart);
      const { fromISO: toISO } = warsawDayBoundsISO(rangeEnd);
      const { data, error } = await supabase
        .from('vanguard_calendar')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', fromISO)
        .lt('start_time', toISO)
        .order('start_time', { ascending: true });
      if (error) throw error;
      setEvents((data as CalRow[]) || []);
    } catch (e) {
      console.error('CalendarView fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [userId, visibleRange]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Keyboard shortcuts inspired by Notion Calendar / Cron
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedEvent(null);
        setQuickCreate(null);
        setShowBudgetConfig(false);
        setShowDeleteConfirm(false);
        return;
      }

      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.getAttribute('contenteditable') === 'true'
      )) {
        return;
      }

      const key = e.key.toLowerCase();

      if (key === 't') {
        e.preventDefault();
        setSelectedDay(today);
        setWeekStart(weekMon(today));
        setCalView('dzien');
        setToastMessage('Przejście do dzisiaj 📅');
      } else if (key === 'd') {
        e.preventDefault();
        setCalView('dzien');
      } else if (key === 'w') {
        e.preventDefault();
        setCalView('tydzien');
      } else if (key === 'a') {
        e.preventDefault();
        setCalView('agenda');
      } else if (key === 'r') {
        e.preventDefault();
        onSyncCalendar();
        setTimeout(fetchEvents, 2000);
        setToastMessage('Synchronizowanie kalendarza... 🔄');
      } else if (key === 'c') {
        e.preventDefault();
        setQuickCreate({ date: selectedDay, startMin: 9 * 60 });
        setQuickTitle('');
        setQuickDuration(60);
        setQuickCategory(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDay, today, onSyncCalendar, fetchEvents]);

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

  const { isScheduling, handleAISchedule } = useAIScheduling({
    userId,
    selectedDay,
    eventsForDay,
    focusTimeDefense,
    decompressionBuffer,
    inboxTodos,
    createEvent,
    scheduleTodoAt,
    fetchEvents,
    fetchAllTodos,
    setToastMessage,
  });

  const { syncingOuraSleep, handleSyncOuraSleep } = useSyncOura({
    userId,
    selectedDay,
    updateEvent,
    createEvent,
    fetchEvents,
    setToastMessage,
  });

  const { syncingActivities, handleSyncActivities } = useSyncActivities({
    userId,
    selectedDay,
    createEvent,
    fetchEvents,
    setToastMessage,
  });

  const handleSlotClick = (date: string, hour: number, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clickedMin = Math.round(((hour * 60 + (offsetY / PX_PER_HOUR) * 60)) / 15) * 15;
    setQuickCreate({ date, startMin: clickedMin });
    setQuickTitle('');
    setQuickDuration(60);
    setQuickCategory(null);
  }

  const handleQuickSave = async () => {
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
    const ev: CalendarEvent = { summary: quickTitle.trim(), start, end, category: quickCategory || undefined };
    try {
      const result = await createEvent(ev);
      const newRow: CalRow = {
        id: result.eventId || String(Date.now()),
        event_id: result.eventId || null,
        summary: ev.summary,
        start_time: start,
        end_time: end,
        category: ev.category || null,
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

  const handleEventClick = (ev: CalRow) => {
    if (!ev.start_time || !ev.end_time) return;
    setSelectedEvent(ev);
    setEditTitle(ev.summary || '');
    setEditCategory(ev.category || null);
    
    try {
      const startParts = getWarsawParts(ev.start_time);
      const endParts = getWarsawParts(ev.end_time);
      
      setEditDate(startParts.dateStr);
      setEditStart(startParts.timeStr);
      setEditEnd(endParts.timeStr);
    } catch (e) {
      console.error('Failed to parse event click time:', e);
      const partsStart = ev.start_time.split('T');
      const partsEnd = ev.end_time.split('T');
      setEditDate(partsStart[0]);
      setEditStart(partsStart[1] ? partsStart[1].slice(0, 5) : '12:00');
      setEditEnd(partsEnd[1] ? partsEnd[1].slice(0, 5) : '13:00');
    }
  }

  const handleEditSave = async () => {
    if (!selectedEvent || !editTitle.trim() || !editStart || !editEnd || !editDate) return;
    setSaving(true);
    
    const start = `${editDate}T${editStart}:00${WARSAW_OFFSET}`;
    let endDateStr = editDate;
    
    // If end time is chronologically before start time, it crosses midnight (ends the next day)
    if (editEnd < editStart) {
      endDateStr = addDays(editDate, 1);
    }
    
    const end = `${endDateStr}T${editEnd}:00${WARSAW_OFFSET}`;
    const evId = selectedEvent.event_id || selectedEvent.id;
    const ev: CalendarEvent & { id: string } = {
      id: evId,
      summary: editTitle.trim(),
      start,
      end,
      category: editCategory || undefined,
    };
    try {
      await updateEvent(ev);
      setEvents((prev) =>
        prev.map((item) =>
          item.id === selectedEvent.id
            ? {
                ...item,
                summary: ev.summary,
                start_time: start,
                end_time: end,
                category: ev.category || null,
              }
            : item,
        ).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
      );
      setSelectedEvent(null);
    } catch (err) {
      console.error('edit event error:', err);
      setToastMessage('Nie udało się zapisać zmian. Upewnij się, że godziny są poprawne.');
    } finally {
      setSaving(false);
    }
  }

  const executeDelete = async () => {
    if (!selectedEvent) return;
    setDeleting(true);
    const evId = selectedEvent.event_id || selectedEvent.id;
    try {
      await deleteEvent(evId);
      setEvents((prev) => prev.filter((item) => item.id !== selectedEvent.id));
      setSelectedEvent(null);
      setShowDeleteConfirm(false);
      setToastMessage('Wydarzenie zostało usunięte. 🗑️');
    } catch (err) {
      console.error('delete event error:', err);
      setToastMessage('Nie udało się usunąć wydarzenia.');
    } finally {
      setDeleting(false);
    }
  }

  const handleEditDelete = async () => {
    if (!selectedEvent) return;
    setShowDeleteConfirm(true);
  }

  const minutesLabel = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  // ── Render helpers ──

  const handleEventMouseDown = (
    ev: CalRow,
    e: React.MouseEvent<HTMLDivElement>,
    action: 'move' | 'resize'
  ) => {
    e.stopPropagation();
    e.preventDefault();

    if (!ev.start_time || !ev.end_time) return;

    const cardElement = action === 'resize'
      ? (e.currentTarget.parentElement as HTMLDivElement)
      : (e.currentTarget as HTMLDivElement);

    // Disable CSS transitions during interaction to eliminate browser latency
    if (cardElement) {
      cardElement.style.transition = 'none';
      cardElement.style.zIndex = '50';
    }

    const startMin = parseTime(ev.start_time);
    const endMin = parseTime(ev.end_time);
    const duration = endMin - startMin;

    const startY = e.clientY;
    const initialStartMin = startMin;
    const initialEndMin = endMin;
    const eventDate = dateOfISO(ev.start_time);

    let hasMoved = false;
    let lastDiffMins = 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      hasMoved = true;
      const diffY = moveEvent.clientY - startY;
      const diffMins = Math.round((diffY / PX_PER_MIN) / 15) * 15; // Snap to 15m intervals

      // Performance throttle: Only update React state if crossing grid boundaries
      if (diffMins === lastDiffMins) return;
      lastDiffMins = diffMins;

      setEvents((prevEvents) =>
        prevEvents.map((item) => {
          if (item.id !== ev.id) return item;

          let newStartMin = initialStartMin;
          let newEndMin = initialEndMin;

          if (action === 'move') {
            newStartMin = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - duration, initialStartMin + diffMins));
            newEndMin = newStartMin + duration;
          } else if (action === 'resize') {
            newEndMin = Math.max(newStartMin + 15, Math.min(HOUR_END * 60, initialEndMin + diffMins));
          }

          const pad = (n: number) => String(n).padStart(2, '0');
          const newStartISO = `${eventDate}T${pad(Math.floor(newStartMin / 60))}:${pad(newStartMin % 60)}:00${WARSAW_OFFSET}`;
          const newEndISO = `${eventDate}T${pad(Math.floor(newEndMin / 60))}:${pad(newEndMin % 60)}:00${WARSAW_OFFSET}`;

          return {
            ...item,
            start_time: newStartISO,
            end_time: newEndISO,
          };
        })
      );
    };

    const handleMouseUp = async (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Restore transitions and original depth
      if (cardElement) {
        cardElement.style.transition = '';
        cardElement.style.zIndex = '';
      }

      if (!hasMoved) {
        handleEventClick(ev);
        return;
      }

      const diffY = upEvent.clientY - startY;
      const diffMins = Math.round((diffY / PX_PER_MIN) / 15) * 15;

      let finalStartMin = initialStartMin;
      let finalEndMin = initialEndMin;

      if (action === 'move') {
        finalStartMin = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - duration, initialStartMin + diffMins));
        finalEndMin = finalStartMin + duration;
      } else if (action === 'resize') {
        finalEndMin = Math.max(finalStartMin + 15, Math.min(HOUR_END * 60, initialEndMin + diffMins));
      }

      const pad = (n: number) => String(n).padStart(2, '0');
      const startISO = `${eventDate}T${pad(Math.floor(finalStartMin / 60))}:${pad(finalStartMin % 60)}:00${WARSAW_OFFSET}`;
      const endISO = `${eventDate}T${pad(Math.floor(finalEndMin / 60))}:${pad(finalEndMin % 60)}:00${WARSAW_OFFSET}`;

      const updatePayload = {
        id: ev.event_id || ev.id,
        summary: ev.summary || '',
        start: startISO,
        end: endISO,
        category: ev.category || undefined,
      };

      try {
        await updateEvent(updatePayload);
        setToastMessage('Zaktualizowano czas wydarzenia! 🕒');
      } catch (err) {
        console.error('Failed to save drag/resize changes:', err);
        setToastMessage('Nie udało się zapisać zmian.');
        setEvents((prevEvents) =>
          prevEvents.map((item) =>
            item.id === ev.id
              ? { ...item, start_time: ev.start_time, end_time: ev.end_time }
              : item
          )
        );
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const renderEventBlock = (ev: CalRow, left: string, width: string) => {
    if (!ev.start_time || !ev.end_time) return null;
    const startMin = parseTime(ev.start_time);
    const endMin = parseTime(ev.end_time);
    const visibleStartMin = Math.max(HOUR_START * 60, startMin);
    const visibleEndMin = Math.min(HOUR_END * 60, endMin);
    const top = (visibleStartMin - HOUR_START * 60) * PX_PER_MIN;
    const height = Math.max(20, (visibleEndMin - visibleStartMin) * PX_PER_MIN);
    const tooShort = height < 32;
    const isAIScheduled = ev.summary?.includes('✨') || ev.summary?.includes('[AI]');
    const isFocusTime = ev.summary?.includes('Focus Time') || ev.summary?.includes('🛡️');

    // Display start/end hours inline if card height is too short for a separate line
    let displaySummary = ev.summary;
    if (tooShort) {
      const isSleep = ev.summary?.toLowerCase().includes('sen') || ev.summary?.toLowerCase().includes('sleep');
      if (isSleep) {
        displaySummary = `${formatTime(ev.start_time)}-${formatTime(ev.end_time)}`;
      } else {
        displaySummary = `${ev.summary} (${formatTime(ev.start_time)}–${formatTime(ev.end_time)})`;
      }
    }

    return (
      <div
        key={ev.id}
        onMouseDown={(e) => handleEventMouseDown(ev, e, 'move')}
        className={`absolute rounded-none shadow-sm ${tooShort ? 'px-1 py-0.5 flex items-center justify-start' : 'px-1.5 py-1'} overflow-hidden cursor-move hover:shadow-md hover:brightness-105 active:scale-[0.99] active:brightness-95 transition-all duration-150 hover:z-20 select-none ${eventColor(ev)}`}
        style={{ top, height, left: `calc(${left} + 1px)`, width: `calc(${width} - 2px)` }}
        title={ev.summary || ''}
      >
        <div className="flex items-start gap-0.5 min-w-0 w-full justify-start flex-wrap">
          {isAIScheduled && !tooShort && <Sparkles size={9} className="shrink-0 animate-pulse opacity-90 mt-0.5" />}
          {isFocusTime && !tooShort && <Shield size={9} className="shrink-0 opacity-90 mt-0.5" />}
          <p className={`${tooShort ? 'text-[8.5px]' : 'text-[9.5px]'} font-extrabold leading-tight break-all whitespace-normal line-clamp-3`}>
            {displaySummary}
          </p>
        </div>
        {!tooShort && (
          <div className="opacity-85 text-[8.5px] font-bold leading-none mt-0.5 break-all whitespace-normal">
            <span>{formatTime(ev.start_time)}–{formatTime(ev.end_time)}</span>
          </div>
        )}
        
        {/* Drag Resize Handle (Bottom Edge) */}
        <div
          onMouseDown={(e) => handleEventMouseDown(ev, e, 'resize')}
          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-s-resize hover:bg-black/10 dark:hover:bg-white/10 z-30"
        />
      </div>
    );
  }

  const renderTimeGutter = () => {
    return (
      <div className="flex flex-col shrink-0 relative" style={{ width: 44 }}>
        {Array.from({ length: HOURS + 1 }, (_, i) => (
          <div
            key={i}
            className="text-[10px] font-extrabold text-text-muted/40 text-right pr-2 absolute right-0"
            style={{ 
              top: i * PX_PER_HOUR, 
              transform: 'translateY(-50%)',
              height: 20,
              lineHeight: '20px'
            }}
          >
            {String(HOUR_START + i).padStart(2, '0')}:00
          </div>
        ))}
      </div>
    );
  }

  // Timed todos (due_date + scheduled_time) render in a slim lane on the right edge of the
  // day column — kept out of layoutDayEvents' column algorithm since they aren't draggable
  // calendar_event rows and shouldn't compete with real events for width.
  const renderTodoBlock = (todo: CalendarTodo) => {
    if (!todo.scheduled_time) return null;
    const startMin = parseTime(todo.scheduled_time);
    const duration = todo.duration_minutes || 30;
    const visibleStartMin = Math.max(HOUR_START * 60, startMin);
    const visibleEndMin = Math.min(HOUR_END * 60, startMin + duration);
    if (visibleEndMin <= visibleStartMin) return null;
    const top = (visibleStartMin - HOUR_START * 60) * PX_PER_MIN;
    const height = Math.max(18, (visibleEndMin - visibleStartMin) * PX_PER_MIN);
    const chip = goalChipFor(todo.section_id);
    const GoalIcon = chip ? GOAL_ICON[chip.pillar] : null;
    const isCompleting = completedTodoIds.has(todo.id);
    return (
      <div
        key={`todo-${todo.id}`}
        title={`${todo.title}${chip?.dreamTitle ? ` · ${chip.dreamTitle}` : ''}`}
        className={`absolute rounded-md border border-dashed border-primary/50 bg-primary/10 hover:bg-primary/20 px-1 py-0.5 overflow-hidden transition-colors z-10 ${isCompleting ? 'opacity-50' : ''}`}
        style={{ top, height, left: '75%', width: '24%' }}
      >
        <div className="flex items-start gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleTodo(todo.id);
              setToastMessage(`Ukończono: "${todo.title}" ✅`);
            }}
            className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm border flex items-center justify-center transition-colors ${isCompleting ? 'bg-emerald-500 border-emerald-500' : 'border-primary/50 hover:bg-primary/20'}`}
          >
            {isCompleting && <Check size={6} className="text-white" strokeWidth={4} />}
          </button>
          <p className={`flex items-center gap-0.5 text-[8px] font-bold text-primary leading-tight line-clamp-2 ${isCompleting ? 'line-through' : ''}`}>
            {GoalIcon && <GoalIcon size={7} className="shrink-0" />}
            <span className="truncate">{todo.title}</span>
          </p>
        </div>
      </div>
    );
  };

  const renderDayColumn = (day: string, colClass = '') => {
    const dayEvents = eventsForDay(day);
    const dayTodos = todosForDay(day).filter((t) => t.scheduled_time);
    const isToday = day === today;
    const nowLine = isToday ? (nowMin - HOUR_START * 60) * PX_PER_MIN : null;
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
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('bg-primary/10');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('bg-primary/10');
            }}
            onDrop={async (e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('bg-primary/10');
              const rawData = e.dataTransfer.getData('text/plain');
              if (!rawData) return;
              try {
                const todo = JSON.parse(rawData);
                // Calculate drop offset in the 1 hour block
                const rect = e.currentTarget.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                const clickedMin = Math.round((offsetY / PX_PER_HOUR) * 60 / 15) * 15;
                const startMin = (HOUR_START + i) * 60 + clickedMin;

                setSaving(true);
                // Write due_date + scheduled_time straight onto the todo — it stays open and
                // shows up on the grid via todosForDay(), instead of spawning a disconnected
                // calendar_event and silently completing the task.
                await scheduleTodoAt(todo, day, startMin, 60);
                setToastMessage(`Zaplanowano zadanie: "${todo.title}" 📅`);
              } catch (err) {
                console.error('Failed to drop and schedule task:', err);
                setToastMessage('Nie udało się zaplanować zadania.');
              } finally {
                setSaving(false);
              }
            }}
          />
        ))}
        {/* Events */}
        {(() => {
          const layouts = layoutDayEvents(dayEvents);
          return dayEvents.map((ev) => {
            const layout = layouts.get(ev.id) || { left: '0%', width: '100%' };
            return renderEventBlock(ev, layout.left, layout.width);
          });
        })()}
        {/* Timed todos (due_date + scheduled_time) */}
        {dayTodos.map(renderTodoBlock)}
        {/* Now line */}
        {nowLine !== null && nowLine >= 0 && (
          <div
            className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
            style={{ top: nowLine }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-md shadow-rose-500/50 animate-pulse -ml-[5px]" />
            <div className="flex-1 h-[1.5px] bg-rose-500" />
          </div>
        )}
      </div>
    );
  }

  // ── Views ──

  // Shared category picker for the quick-create and edit-event modals — one list, sourced
  // from LIFE_SPHERES, instead of two hand-maintained copies that could drift apart.
  const renderCategoryPicker = (selected: string | null, onSelect: (key: string | null) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {[{ id: null as string | null, label: 'Brak', dot: 'bg-slate-400', border: 'border-border-custom', bgSoft: 'bg-surface-solid' }, ...LIFE_SPHERES].map((cat) => {
        const isSelected = selected === cat.id;
        return (
          <button
            key={cat.id || 'none'}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
              isSelected
                ? cat.id
                  ? `${cat.bgSoft.replace('/8', '/20')} ${cat.border} text-text-primary font-black shadow-sm`
                  : 'bg-text-primary/10 border-text-primary/30 text-text-primary font-black shadow-sm'
                : 'border-border-custom/40 bg-surface-solid/20 text-text-muted hover:text-text-primary'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
            <span>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );

  // "Due today, no specific time" todos — a slim all-day strip above the hourly grid,
  // aligned with renderTimeGutter's 44px width so it lines up with the timed columns below.
  const renderAllDayTodos = (days: string[]) => {
    const untimedByDay = days.map((day) => todosForDay(day).filter((t) => !t.scheduled_time));
    if (!untimedByDay.some((list) => list.length > 0)) return null;
    return (
      <div className="flex border-b border-border-custom/20 bg-surface-solid/10" style={{ paddingLeft: 44 }}>
        {days.map((day, idx) => (
          <div key={day} className="flex-1 min-w-0 p-1 space-y-1 border-l border-border-custom/10 first:border-l-0">
            {untimedByDay[idx].map((todo) => {
              const chip = goalChipFor(todo.section_id);
              const GoalIcon = chip ? GOAL_ICON[chip.pillar] : null;
              const isCompleting = completedTodoIds.has(todo.id);
              return (
                <div
                  key={todo.id}
                  title={chip?.dreamTitle ? `${todo.title} · ${chip.dreamTitle}` : todo.title}
                  className={`flex items-center gap-1.5 truncate rounded border border-dashed border-primary/40 bg-primary/8 px-1.5 py-0.5 text-[9px] font-bold text-primary transition-colors ${isCompleting ? 'opacity-50' : ''}`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleTodo(todo.id);
                      setToastMessage(`Ukończono: "${todo.title}" ✅`);
                    }}
                    className={`h-2.5 w-2.5 shrink-0 rounded-sm border flex items-center justify-center transition-colors ${isCompleting ? 'bg-emerald-500 border-emerald-500' : 'border-primary/50 hover:bg-primary/20'}`}
                  >
                    {isCompleting && <Check size={7} className="text-white" strokeWidth={4} />}
                  </button>
                  {GoalIcon && <GoalIcon size={8} className="shrink-0" />}
                  <span className={`truncate ${isCompleting ? 'line-through' : ''}`}>{todo.title}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderDayView = () => {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Day nav */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-custom/20">
          <button
            onClick={() => {
              const d = addDays(selectedDay, -1);
              setSelectedDay(d);
              setWeekStart(weekMon(d));
            }}
            className="p-2 rounded-full hover:bg-surface-solid transition-colors"
          >
            <ChevronLeft size={18} className="text-text-muted" />
          </button>
          <div className="text-center">
            <p className="text-[14px] font-bold text-text-primary">{monthLabel(selectedDay)}</p>
            {selectedDay !== today && (
              <button
                onClick={() => {
                  setSelectedDay(today);
                  setWeekStart(weekMon(today));
                }}
                className="text-[10px] text-primary font-semibold"
              >
                Wróć do dziś
              </button>
            )}
          </div>
          <button
            onClick={() => {
              const d = addDays(selectedDay, 1);
              setSelectedDay(d);
              setWeekStart(weekMon(d));
            }}
            className="p-2 rounded-full hover:bg-surface-solid transition-colors"
          >
            <ChevronRight size={18} className="text-text-muted" />
          </button>
        </div>
        {renderAllDayTodos([selectedDay])}
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

  const renderWeekView = () => {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Week nav */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-custom/20">
          <button
            onClick={() => {
              const w = addDays(weekStart, -7);
              setWeekStart(w);
              setSelectedDay(w);
            }}
            className="p-2 rounded-full hover:bg-surface-solid transition-colors"
          >
            <ChevronLeft size={18} className="text-text-muted" />
          </button>
          <div className="text-center">
            <p className="text-[12px] font-bold text-text-primary">
              {dayLabel(weekStart)} – {dayLabel(addDays(weekStart, 6))}
            </p>
            {!weekDays.includes(today) && (
              <button
                onClick={() => {
                  const w = weekMon(today);
                  setWeekStart(w);
                  setSelectedDay(today);
                }}
                className="text-[10px] text-primary font-semibold"
              >
                Bieżący tydzień
              </button>
            )}
          </div>
          <button
            onClick={() => {
              const w = addDays(weekStart, 7);
              setWeekStart(w);
              setSelectedDay(w);
            }}
            className="p-2 rounded-full hover:bg-surface-solid transition-colors"
          >
            <ChevronRight size={18} className="text-text-muted" />
          </button>
        </div>
        {/* Day headers */}
        <div className="flex border-b border-border-custom/20" style={{ paddingLeft: 44 }}>
          {weekDays.map((day) => {
            const isToday = day === today;
            return (
              <div key={day} className="flex-1 text-center py-1.5 flex flex-col items-center justify-center">
                <p className={`text-[8.5px] font-bold uppercase tracking-wider ${isToday ? 'text-primary' : 'text-text-muted'}`}>
                  {new Date(day + 'T12:00:00').toLocaleDateString('pl-PL', { weekday: 'short' })}
                </p>
                <div className="mt-1 flex items-center justify-center h-6 w-6">
                  {isToday ? (
                    <span className="h-5.5 w-5.5 rounded-full bg-primary flex items-center justify-center text-[11.5px] font-black text-white leading-none shadow-sm shadow-primary/20">
                      {parseInt(day.split('-')[2])}
                    </span>
                  ) : (
                    <span className="text-[11.5px] font-bold text-text-secondary leading-none">
                      {parseInt(day.split('-')[2])}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {renderAllDayTodos(weekDays)}
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

  const renderAgendaView = () => {
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
    return (
      <div className="flex-1 overflow-y-auto pb-20">
        {days.map((day) => {
          const dayEv = eventsForDay(day);
          const dayTodos = todosForDay(day);
          if (dayEv.length === 0 && dayTodos.length === 0 && day !== today) return null;
          return (
            <div key={day} className="px-4 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[11px] font-black ${day === today ? 'text-primary' : 'text-text-muted'}`}>
                  {day === today ? 'Dziś' : dayLabel(day)}
                </span>
                {dayEv.length === 0 && dayTodos.length === 0 && (
                  <span className="text-[9px] text-text-muted/40">brak wydarzeń</span>
                )}
              </div>
              <div className="space-y-1.5">
                {dayEv.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => handleEventClick(ev)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer hover:scale-[1.005] active:scale-[0.995] transition-all ${eventColor(ev).replace('bg-', 'border-').split(' ')[0]} bg-surface-solid/50`}
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
                {dayTodos.map((todo) => {
                  const chip = goalChipFor(todo.section_id);
                  const GoalIcon = chip ? GOAL_ICON[chip.pillar] : null;
                  const isCompleting = completedTodoIds.has(todo.id);
                  return (
                    <div
                      key={todo.id}
                      className={`flex items-center gap-3 rounded-xl border border-dashed border-primary/30 px-3 py-2.5 transition-all bg-primary/[0.03] ${isCompleting ? 'opacity-50' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          handleToggleTodo(todo.id);
                          setToastMessage(`Ukończono: "${todo.title}" ✅`);
                        }}
                        className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${isCompleting ? 'bg-emerald-500 border-emerald-500' : 'border-primary/40 hover:bg-primary/10'}`}
                      >
                        {isCompleting && <Check size={10} className="text-white" strokeWidth={3} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[12px] font-semibold text-text-primary line-clamp-1 ${isCompleting ? 'line-through' : ''}`}>{todo.title}</p>
                        <p className="text-[9px] text-text-muted mt-0.5">
                          {todo.scheduled_time ? formatTime(todo.scheduled_time) : 'Cały dzień'}
                          {chip?.dreamTitle && <span className="opacity-70"> · {chip.dreamTitle}</span>}
                        </p>
                      </div>
                      {GoalIcon && <GoalIcon size={11} className="shrink-0 opacity-60" />}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 border-b border-border-custom/10" />
            </div>
          );
        })}
        {events.length === 0 && scheduledTodos.length === 0 && !loading && (
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
  const renderQuickCreate = () => {
    if (!quickCreate) return null;
    const { date, startMin } = quickCreate;
    const endMin = startMin + quickDuration;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]" onClick={() => setQuickCreate(null)}>
        <div
          className="w-full max-w-sm rounded-2xl bg-background border border-border-custom/80 shadow-2xl p-6 space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-black text-text-primary uppercase tracking-wider">Nowe wydarzenie</p>
            <button onClick={() => setQuickCreate(null)} className="p-1 text-text-muted hover:text-text-primary transition-colors">
              <X size={18} />
            </button>
          </div>
          <input
            autoFocus
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleQuickSave(); }}
            placeholder="Tytuł wydarzenia..."
            className="w-full bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-4 py-3.5 text-[14px] font-semibold text-text-primary outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-text-muted/30"
          />
          <div className="flex items-center gap-2.5 text-text-secondary bg-slate-50 dark:bg-white/[0.02] border border-border-custom/40 rounded-xl px-3.5 py-2.5">
            <Clock size={14} className="text-text-muted shrink-0" />
            <span className="text-[12px] font-semibold">
              {monthLabel(date)}, {minutesLabel(startMin)} – {minutesLabel(endMin)}
            </span>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Czas trwania:</span>
            <div className="flex gap-1.5">
              {[30, 60, 90, 120].map((d) => (
                <button
                  key={d}
                  onClick={() => setQuickDuration(d)}
                  className={`flex-1 text-[11px] font-bold py-2 rounded-xl border transition-all ${quickDuration === d ? 'bg-primary/10 text-primary border-primary/30 font-black' : 'border-border-custom/60 text-text-muted hover:text-text-primary bg-surface-solid/20'}`}
                >
                  {d < 60 ? `${d}m` : `${d / 60}h`}
                </button>
              ))}
            </div>
          </div>
          {/* Category selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Kategoria</label>
            {renderCategoryPicker(quickCategory, setQuickCategory)}
          </div>

          <button
            onClick={handleQuickSave}
            disabled={saving || !quickTitle.trim()}
            className="w-full rounded-xl bg-primary text-white py-3.5 text-[13px] font-black shadow-lg shadow-primary/10 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {saving ? 'Dodaję...' : 'Dodaj wydarzenie'}
          </button>
        </div>
      </div>
    );
  }

  // ── Edit event modal ──
  const renderEditModal = () => {
    if (!selectedEvent) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]" onClick={() => setSelectedEvent(null)}>
        <div
          className="w-full max-w-sm rounded-2xl bg-background border border-border-custom/80 shadow-2xl p-6 space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-black text-text-primary uppercase tracking-wider">Edytuj wydarzenie</p>
            <button onClick={() => setSelectedEvent(null)} className="p-1 text-text-muted hover:text-text-primary transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Title */}
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(); }}
            placeholder="Tytuł wydarzenia..."
            className="w-full bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-4 py-3 text-[14px] font-semibold text-text-primary outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-text-muted/30"
          />

          {/* Date & Time Row */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Data i Czas</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-2 py-2.5 text-[12px] font-semibold text-text-primary outline-none focus:border-primary/50 transition-all cursor-pointer"
              />
              <input
                type="time"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                className="bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-2 py-2.5 text-[12px] font-semibold text-text-primary outline-none focus:border-primary/50 transition-all cursor-pointer"
              />
              <input
                type="time"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                className="bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-2 py-2.5 text-[12px] font-semibold text-text-primary outline-none focus:border-primary/50 transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Category selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Kategoria</label>
            {renderCategoryPicker(editCategory, setEditCategory)}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleEditDelete}
              disabled={deleting || saving}
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 text-[13px] font-bold transition-all active:scale-95 disabled:opacity-40"
            >
              <Trash2 size={15} />
              <span>{deleting ? 'Usuwam...' : 'Usuń'}</span>
            </button>
            <button
              onClick={handleEditSave}
              disabled={saving || deleting || !editTitle.trim()}
              className="flex-1 rounded-xl bg-primary text-white py-3 text-[13px] font-black shadow-lg shadow-primary/10 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {saving ? 'Zapisuję...' : 'Zapisz zmiany'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Budget Config Modal ──
  const renderBudgetConfigModal = () => {
    if (!showBudgetConfig) return null;

    const handleSaveAll = async () => {
      try {
        const categories = LIFE_SPHERES.map((s) => s.id);
        for (const cat of categories) {
          const minRaw = budgetMinInputs[cat] || '';
          const maxRaw = budgetMaxInputs[cat] || '';
          const minHours = minRaw.trim() !== '' ? Number(minRaw) : null;
          const maxHours = maxRaw.trim() !== '' ? Number(maxRaw) : null;
          await saveBudget(cat, minHours, maxHours);
        }
        setShowBudgetConfig(false);
      } catch (err) {
        console.error('Error saving budgets:', err);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]" onClick={() => setShowBudgetConfig(false)}>
        <div
          className="w-full max-w-sm rounded-2xl bg-background border border-border-custom/80 shadow-2xl p-6 space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-black text-text-primary uppercase tracking-wider">Ustaw Budżety Czasu</p>
            <button onClick={() => setShowBudgetConfig(false)} className="p-1 text-text-muted hover:text-text-primary transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
            {[
              { key: 'praca', label: 'Praca', placeholderMin: 'brak', placeholderMax: 'np. 40' },
              { key: 'cialo_trening', label: 'Ciało / Trening', placeholderMin: 'np. 5', placeholderMax: 'brak' },
              { key: 'duch_refleksja', label: 'Duch / Refleksja', placeholderMin: 'np. 3', placeholderMax: 'brak' },
              { key: 'finanse', label: 'Finanse', placeholderMin: 'np. 1', placeholderMax: 'brak' },
              { key: 'relacje_rodzina', label: 'Relacje / Rodzina', placeholderMin: 'np. 4', placeholderMax: 'brak' },
              { key: 'odpoczynek_regeneracja', label: 'Odpoczynek / Regeneracja', placeholderMin: 'np. 3', placeholderMax: 'brak' },
            ].map((cat) => (
              <div key={cat.key} className="space-y-1.5 p-3 bg-slate-50 dark:bg-white/[0.015] border border-border-custom/50 rounded-xl">
                <span className="text-[11px] font-bold text-text-primary">{cat.label}</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-text-muted font-semibold uppercase tracking-wider block mb-0.5">Min (godz)</label>
                    <input
                      type="number"
                      step="0.5"
                      placeholder={cat.placeholderMin}
                      value={budgetMinInputs[cat.key] || ''}
                      onChange={(e) => setBudgetMinInputs({ ...budgetMinInputs, [cat.key]: e.target.value })}
                      className="w-full bg-background border border-border-custom/60 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-text-primary outline-none focus:border-primary/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-text-muted font-semibold uppercase tracking-wider block mb-0.5">Max (godz)</label>
                    <input
                      type="number"
                      step="0.5"
                      placeholder={cat.placeholderMax}
                      value={budgetMaxInputs[cat.key] || ''}
                      onChange={(e) => setBudgetMaxInputs({ ...budgetMaxInputs, [cat.key]: e.target.value })}
                      className="w-full bg-background border border-border-custom/60 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-text-primary outline-none focus:border-primary/50 transition-all"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSaveAll}
            className="w-full rounded-xl bg-primary text-white py-3.5 text-[13px] font-black shadow-lg shadow-primary/10 hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            Zapisz limity
          </button>
        </div>
      </div>
    );
  }

  // ── Delete Confirm Modal ──
  const renderDeleteConfirmModal = () => {
    if (!showDeleteConfirm) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]" onClick={() => setShowDeleteConfirm(false)}>
        <div
          className="w-full max-w-sm rounded-2xl bg-background border border-border-custom/80 shadow-2xl p-6 space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
              <Trash2 size={20} />
            </div>
            <div>
              <p className="text-[13px] font-black text-text-primary uppercase tracking-wider">Potwierdź usunięcie</p>
              <p className="text-[11.5px] text-text-muted mt-0.5">Czy na pewno chcesz usunąć to wydarzenie? Tej operacji nie można cofnąć.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 rounded-xl border border-border-custom/60 bg-surface-solid/20 hover:bg-surface-solid/40 text-text-primary py-3 text-[12px] font-black active:scale-[0.98] transition-all cursor-pointer"
            >
              Anuluj
            </button>
            <button
              onClick={executeDelete}
              disabled={deleting}
              className="flex-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white py-3 text-[12px] font-black shadow-lg shadow-rose-500/15 active:scale-[0.98] transition-all disabled:opacity-40 cursor-pointer"
            >
              {deleting ? 'Usuwanie...' : 'Usuń wydarzenie'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-text-primary overflow-hidden">
      {/* LEFT SIDEBAR (Notion Calendar / Cron Style - visible on desktop) */}
      <div className="hidden md:flex flex-col w-80 border-r border-border-custom/50 bg-background/95 shrink-0 h-full overflow-hidden">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border-custom/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6.5 h-6.5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-[12px] font-black shadow-sm">
              <Zap size={14} className="fill-primary text-primary" />
            </div>
            <span className="text-[13px] font-black tracking-wider uppercase text-text-primary">Vanguard OS</span>
          </div>
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] text-text-muted hover:text-text-primary transition-all" title="Wróć do pulpitu">
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Quick View Switcher */}
        <div className="px-4 py-3 border-b border-border-custom/25 bg-slate-500/5 dark:bg-white/[0.01] flex gap-1.5 shrink-0">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-black bg-primary/10 text-primary border border-primary/15"
          >
            <Calendar size={13} className="shrink-0" />
            <span>Kalendarz</span>
          </button>
          <button
            onClick={() => onNavigateTo?.('todo')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold text-text-muted hover:text-text-primary hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all border border-transparent cursor-pointer"
          >
            <List size={13} className="shrink-0" />
            <span>Zadania</span>
          </button>
          <button
            onClick={() => onNavigateTo?.('keep')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold text-text-muted hover:text-text-primary hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all border border-transparent cursor-pointer"
          >
            <StickyNote size={13} className="shrink-0" />
            <span>Notatki</span>
          </button>
        </div>

        {/* Sidebar Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Section 1: Monthly Mini Calendar */}
          <MiniCalendar selectedDay={selectedDay} onSelectDay={(day) => {
            setSelectedDay(day);
            setWeekStart(weekMon(day));
          }} />

          {/* Section 2: Reclaim.ai Options & AI scheduling */}
          <div className="bg-surface-solid/5 dark:bg-white/[0.015] border border-border-custom/30 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-1.5 pb-1 border-b border-border-custom/20">
              <Sparkles size={14} className="text-primary animate-pulse" />
              <span className="text-[10px] font-black text-text-primary uppercase tracking-wider">Silnik Reclaim.ai</span>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col">
                  <span className="text-[11.5px] font-bold text-text-primary group-hover:text-primary transition-colors">Ochrona Focus Time</span>
                  <span className="text-[9px] text-text-muted">Blokuj poranki na Deep Work</span>
                </div>
                <input
                  type="checkbox"
                  checked={focusTimeDefense}
                  onChange={(e) => setFocusTimeDefense(e.target.checked)}
                  className="w-4 h-4 rounded text-primary border-border-custom bg-transparent checked:bg-primary accent-primary cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col">
                  <span className="text-[11.5px] font-bold text-text-primary group-hover:text-primary transition-colors">Bufory Oddechu</span>
                  <span className="text-[9px] text-text-muted">15m przerwy po spotkaniach</span>
                </div>
                <input
                  type="checkbox"
                  checked={decompressionBuffer}
                  onChange={(e) => setDecompressionBuffer(e.target.checked)}
                  className="w-4 h-4 rounded text-primary border-border-custom bg-transparent checked:bg-primary accent-primary cursor-pointer"
                />
              </label>

            </div>

            <button
              onClick={handleAISchedule}
              disabled={isScheduling}
              className="w-full relative flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-600 hover:from-primary/95 hover:to-violet-600/95 text-white py-2.5 text-[12px] font-black shadow-md hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96] transition-all duration-200 disabled:opacity-50 cursor-pointer"
            >
              {isScheduling ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Planowanie...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Uruchom Silnik AI</span>
                </>
              )}
            </button>
          </div>

          {/* Section 2.5: Biometrics & Activity Sync */}
          <div className="bg-emerald-500/5 dark:bg-emerald-500/[0.02] border border-emerald-500/15 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-1.5 pb-1 border-b border-emerald-500/10">
              <Sliders size={13} className="text-emerald-500 shrink-0" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">Synchronizacja Danych</span>
            </div>

            <div className="space-y-3">
              {/* Oura Sleep */}
              <div className="space-y-1.5">
                <span className="text-[9.5px] font-bold text-text-muted">Sen (Oura Ring)</span>
                <button
                  onClick={handleSyncOuraSleep}
                  disabled={syncingOuraSleep}
                  title="Synchronizuje rzeczywisty czas zasypiania i obudzenia z Oura Ring"
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15 hover:scale-[1.015] active:scale-[0.985] text-emerald-500 py-2.5 text-[11px] font-black shadow-sm transition-all disabled:opacity-40 cursor-pointer"
                >
                  {syncingOuraSleep ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Synchronizowanie...</span>
                    </>
                  ) : (
                    <>
                      <Moon size={13} />
                      <span>Dopasuj Sen z Oura</span>
                    </>
                  )}
                </button>
              </div>

              {/* Gym, Sauna, Strava Activities */}
              <div className="space-y-1.5 pt-2 border-t border-border-custom/25">
                <span className="text-[9.5px] font-bold text-text-muted">Treningi, Sauna & Strava</span>
                <button
                  onClick={handleSyncActivities}
                  disabled={syncingActivities}
                  title="Pobiera treningi, sauny oraz biegi i nakłada je jako kolorowe bloki"
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 hover:bg-primary/15 hover:scale-[1.015] active:scale-[0.985] text-primary py-2.5 text-[11px] font-black shadow-sm transition-all disabled:opacity-40 cursor-pointer"
                >
                  {syncingActivities ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Synchronizowanie...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={13} />
                      <span>Wgraj Treningi do kalendarza</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Time Budgets */}
          <CalendarBudgetPanel
            categoryWeeklyTotals={categoryWeeklyTotals}
            budgets={budgets}
            onConfigure={() => {
              const mins: Record<string, string> = {};
              const maxs: Record<string, string> = {};
              LIFE_SPHERES.map((s) => s.id).forEach((cat) => {
                const b = budgets.find((item) => item.category === cat);
                mins[cat] = b?.min_hours !== null && b?.min_hours !== undefined ? String(b.min_hours) : '';
                maxs[cat] = b?.max_hours !== null && b?.max_hours !== undefined ? String(b.max_hours) : '';
              });
              setBudgetMinInputs(mins);
              setBudgetMaxInputs(maxs);
              setShowBudgetConfig(true);
            }}
          />

          {/* Section 4: Tasks (Notion Calendar Style) */}
          <CalendarSidebarTodos
            sidebarTodos={inboxTodos}
            newTodoTitle={newTodoTitle}
            setNewTodoTitle={setNewTodoTitle}
            handleQuickAddTodo={handleQuickAddTodo}
            handleToggleTodo={handleToggleTodo}
            completedTodoIds={completedTodoIds}
            goalChipFor={goalChipFor}
          />
        </div>
      </div>

      {/* RIGHT MAIN VIEW */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-custom/60 bg-background/90 px-4 py-3 backdrop-blur-xl shrink-0">
          <button onClick={onBack} className="p-1.5 text-primary md:hidden">
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
              const mins: Record<string, string> = {};
              const maxs: Record<string, string> = {};
              LIFE_SPHERES.map((s) => s.id).forEach((cat) => {
                const b = budgets.find((item) => item.category === cat);
                mins[cat] = b?.min_hours !== null && b?.min_hours !== undefined ? String(b.min_hours) : '';
                maxs[cat] = b?.max_hours !== null && b?.max_hours !== undefined ? String(b.max_hours) : '';
              });
              setBudgetMinInputs(mins);
              setBudgetMaxInputs(maxs);
              setShowBudgetConfig(true);
            }}
            className="p-1.5 text-text-muted hover:text-primary transition-colors md:hidden"
            title="Budżety sfer życia"
          >
            <Sliders size={16} />
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

        {/* Collapsible Budget Panel (visible only on mobile) */}
        <div className="block md:hidden border-b border-border-custom/40 bg-slate-50/50 dark:bg-white/[0.01] shrink-0">
          <button
            onClick={() => setBudgetPanelExpanded(!budgetPanelExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-bold text-text-muted hover:text-text-primary transition-all"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>BUDŻET CZASU (TYDZIEŃ)</span>
            </div>
            <span className="text-[10px] uppercase font-black tracking-wider text-primary">
              {budgetPanelExpanded ? 'Zwiń' : 'Rozwiń'}
            </span>
          </button>

          {budgetPanelExpanded && (
            <CalendarBudgetPanel
              categoryWeeklyTotals={categoryWeeklyTotals}
              budgets={budgets}
              isMobile={true}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {calView === 'dzien' && renderDayView()}
          {calView === 'tydzien' && renderWeekView()}
          {calView === 'agenda' && renderAgendaView()}
        </div>
      </div>

      {/* Quick create modal */}
      {renderQuickCreate()}

      {/* Edit event modal */}
      {renderEditModal()}

      {/* Budget config modal */}
      {renderBudgetConfigModal()}

      {/* Delete confirm modal */}
      {renderDeleteConfirmModal()}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2.5 rounded-2xl bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-950 px-4 py-3.5 shadow-2xl border border-white/10 dark:border-slate-800/10 backdrop-blur-md">
          <Sparkles size={14} className="text-primary animate-pulse shrink-0" />
          <span className="text-[12px] font-black tracking-wide leading-none">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
