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
  CalendarDays,
  Moon,
  StickyNote,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCalendarWrite, type CalendarEvent } from '../../hooks/useCalendarWrite';
import { useTimeBudgets } from '../../hooks/useTimeBudgets';
import { createTodoItem, setTodoStatus } from '../../lib/todo';
import { warsawDayBoundsISO } from '../../lib/date';

interface Props {
  session: any;
  onBack: () => void;
  onSyncCalendar: () => void;
  isSyncing: boolean;
  onNavigateTo?: (dest: string) => void;
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

interface SidebarTodo {
  id: string;
  title: string;
  status: string;
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

function getWarsawParts(isoStr: string) {
  const normalized = isoStr.includes(' ') && !isoStr.includes('T') ? isoStr.replace(' ', 'T') : isoStr;
  const date = new Date(normalized);
  if (isNaN(date.getTime())) throw new Error(`Invalid date string: ${isoStr}`);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  
  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    dateStr: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
    timeStr: `${getPart('hour')}:${getPart('minute')}`
  };
}

function parseTime(iso: string) {
  try {
    const { hour, minute } = getWarsawParts(iso);
    return Number(hour) * 60 + Number(minute);
  } catch (e) {
    return 0;
  }
}

function formatTime(iso: string) {
  try {
    const { timeStr } = getWarsawParts(iso);
    return timeStr;
  } catch (e) {
    return '';
  }
}

function dateOfISO(iso: string) {
  try {
    const { dateStr } = getWarsawParts(iso);
    return dateStr;
  } catch (e) {
    return iso.split('T')[0] || iso.split(' ')[0] || '';
  }
}

function nowMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

const CATEGORY_COLORS: Record<string, string> = {
  work: 'bg-blue-500/8 dark:bg-blue-500/12 border-l-blue-500 border-y-blue-500/10 border-r-blue-500/10 text-blue-600 dark:text-blue-400',
  health: 'bg-emerald-500/8 dark:bg-emerald-500/12 border-l-emerald-500 border-y-emerald-500/10 border-r-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  personal: 'bg-violet-500/8 dark:bg-violet-500/12 border-l-violet-500 border-y-violet-500/10 border-r-violet-500/10 text-violet-600 dark:text-violet-400',
  sport: 'bg-orange-500/8 dark:bg-orange-500/12 border-l-orange-500 border-y-orange-500/10 border-r-orange-500/10 text-orange-600 dark:text-orange-400',
  study: 'bg-sky-500/8 dark:bg-sky-500/12 border-l-sky-500 border-y-sky-500/10 border-r-sky-500/10 text-sky-600 dark:text-sky-400',
};

function eventColor(ev: CalRow) {
  const isFocusTime = ev.summary?.includes('Focus Time') || ev.summary?.includes('🛡️');
  if (isFocusTime) {
    return 'bg-indigo-500/8 dark:bg-indigo-500/12 border-l-indigo-500 border-y-indigo-500/10 border-r-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium';
  }
  if (ev.category && CATEGORY_COLORS[ev.category.toLowerCase()]) {
    return CATEGORY_COLORS[ev.category.toLowerCase()];
  }
  return 'bg-primary/8 border-l-primary border-y-primary/10 border-r-primary/10 text-primary';
}

interface QuickCreateState {
  date: string;
  startMin: number; // minutes from midnight
}

function MiniCalendar({ selectedDay, onSelectDay }: { selectedDay: string; onSelectDay: (day: string) => void }) {
  const [currentDate, setCurrentDate] = useState(() => {
    const [y, m] = selectedDay.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  useEffect(() => {
    const [y, m] = selectedDay.split('-').map(Number);
    setCurrentDate(new Date(y, m - 1, 1));
  }, [selectedDay]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const daysGrid: { dayStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dNum = prevMonthTotalDays - i;
    const prevMonthDate = new Date(year, month - 1, dNum);
    daysGrid.push({
      dayStr: toLocalISO(prevMonthDate),
      dayNum: dNum,
      isCurrentMonth: false,
    });
  }

  for (let i = 1; i <= totalDays; i++) {
    const curDate = new Date(year, month, i);
    daysGrid.push({
      dayStr: toLocalISO(curDate),
      dayNum: i,
      isCurrentMonth: true,
    });
  }

  const remainingSlots = 42 - daysGrid.length;
  for (let i = 1; i <= remainingSlots; i++) {
    const nextMonthDate = new Date(year, month + 1, i);
    daysGrid.push({
      dayStr: toLocalISO(nextMonthDate),
      dayNum: i,
      isCurrentMonth: false,
    });
  }

  const monthNames = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
  ];

  const today = todayStr();

  return (
    <div className="bg-surface-solid/5 dark:bg-white/[0.015] border border-border-custom/30 rounded-2xl p-4 space-y-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-black text-text-primary tracking-wide">
          {monthNames[month]} {year}
        </span>
        <div className="flex gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] active:scale-90 transition-all duration-150 border border-border-custom/20 hover:scale-[1.05]"
          >
            <ChevronLeft size={13} className="text-text-muted hover:text-text-primary" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] active:scale-90 transition-all duration-150 border border-border-custom/20 hover:scale-[1.05]"
          >
            <ChevronRight size={13} className="text-text-muted hover:text-text-primary" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map((d, idx) => (
          <span key={idx} className="text-[9px] font-bold text-text-muted/50 uppercase tracking-wider">
            {d}
          </span>
        ))}
        {daysGrid.map((item, idx) => {
          const isSelected = item.dayStr === selectedDay;
          const isToday = item.dayStr === today;
          return (
            <button
              key={idx}
              onClick={() => onSelectDay(item.dayStr)}
              className={`h-6.5 w-6.5 mx-auto rounded-full flex items-center justify-center text-[10.5px] transition-all duration-150 active:scale-90 ${
                isSelected
                  ? 'bg-primary text-white font-black shadow-md shadow-primary/25 scale-[1.08] hover:scale-[1.12]'
                  : isToday
                  ? 'bg-rose-500/10 text-rose-500 font-black border border-rose-500/30 hover:scale-[1.08]'
                  : item.isCurrentMonth
                  ? 'text-text-primary hover:bg-slate-100 dark:hover:bg-white/[0.04] font-semibold hover:scale-[1.08]'
                  : 'text-text-muted/30 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
              }`}
            >
              {item.dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
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
  const [smartHabitsFlex, setSmartHabitsFlex] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);
  const [syncingOuraSleep, setSyncingOuraSleep] = useState(false);
  const [syncingActivities, setSyncingActivities] = useState(false);

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

  // Sidebar Tasks states
  const [sidebarTodos, setSidebarTodos] = useState<SidebarTodo[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [completedTodoIds, setCompletedTodoIds] = useState<Set<string>>(new Set());

  const fetchSidebarTodos = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('todo_items')
        .select('id, title, status')
        .eq('user_id', userId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setSidebarTodos((data as SidebarTodo[]) || []);
    } catch (e) {
      console.error('Error fetching sidebar todos:', e);
    }
  }, [userId]);

  const handleToggleTodo = async (id: string) => {
    try {
      // Mark as completed locally to trigger strikethrough animation
      setCompletedTodoIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      // Delay removal from UI and database update to let the user see the completion state
      setTimeout(async () => {
        setSidebarTodos((prev) => prev.filter((t) => t.id !== id));
        setCompletedTodoIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        await setTodoStatus({ id }, 'done');
      }, 1000);
    } catch (e) {
      console.error('Error completing todo:', e);
      fetchSidebarTodos();
    }
  };

  const handleQuickAddTodo = async () => {
    if (!userId || !newTodoTitle.trim()) return;
    const title = newTodoTitle.trim();
    setNewTodoTitle('');
    try {
      const created = await createTodoItem(userId, { title });
      setSidebarTodos((prev) => [created as SidebarTodo, ...prev]);
    } catch (e) {
      console.error('Error creating quick todo:', e);
    }
  };

  useEffect(() => {
    fetchSidebarTodos();
  }, [fetchSidebarTodos]);

  // Sum event durations for the current week per category
  const categoryWeeklyTotals = useMemo(() => {
    const totals: Record<string, number> = {
      work: 0,
      health: 0,
      personal: 0,
      sport: 0,
      study: 0,
    };
    events.forEach((ev) => {
      if (!ev.start_time || !ev.end_time || !ev.category) return;
      
      // Exclude sleep from the active budget calculations
      const isSleep = ev.summary?.toLowerCase()?.includes('sen') || ev.summary?.toLowerCase()?.includes('sleep');
      if (isSleep) return;

      const cat = ev.category.toLowerCase();
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
    let rangeStart = '';
    let rangeEnd = '';
    if (calView === 'dzien' || calView === 'tydzien') {
      rangeStart = weekStart;
      rangeEnd = addDays(weekStart, 7);
    } else {
      // agenda: next 14 days
      rangeStart = today;
      rangeEnd = addDays(today, 14);
    }
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
  }, [userId, calView, selectedDay, weekStart, today]);

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

  const handleAISchedule = async () => {
    if (sidebarTodos.length === 0) {
      setToastMessage('Brak zadań w skrzynce Inbox do zaplanowania.');
      return;
    }
    setIsScheduling(true);
    try {
      const dayEvents = eventsForDay(selectedDay);
      let busyIntervals = dayEvents.map(ev => {
        const start = parseTime(ev.start_time || '');
        const end = parseTime(ev.end_time || '');
        return { start, end };
      }).sort((a, b) => a.start - b.start);

      // Focus Time Defense: check 8:00 - 10:00 (480 to 600 min)
      if (focusTimeDefense) {
        const overlapsFocus = busyIntervals.some(i => (i.start < 600 && i.end > 480));
        if (!overlapsFocus) {
          const startISO = `${selectedDay}T08:00:00${WARSAW_OFFSET}`;
          const endISO = `${selectedDay}T10:00:00${WARSAW_OFFSET}`;
          await createEvent({
            summary: 'Focus Time 🛡️',
            start: startISO,
            end: endISO,
            category: 'work'
          });
          busyIntervals.push({ start: 480, end: 600 });
          busyIntervals.sort((a, b) => a.start - b.start);
        }
      }

      // Schedule inbox tasks
      let currentPointer = 540; // Start at 9:00 AM (540 mins)
      const workEnd = 1080; // End at 6:00 PM (1080 mins)
      const pad = (n: number) => String(n).padStart(2, '0');

      for (const todo of sidebarTodos) {
        if (currentPointer >= workEnd) break;
        const duration = 60; // 1 hour per task
        let foundSlot = false;

        while (currentPointer + duration <= workEnd && !foundSlot) {
          const slotStart = currentPointer;
          const slotEnd = slotStart + duration;
          const collision = busyIntervals.some(i => (i.start < slotEnd && i.end > slotStart));

          if (!collision) {
            const startH = Math.floor(slotStart / 60);
            const startM = slotStart % 60;
            const endH = Math.floor(slotEnd / 60);
            const endM = slotEnd % 60;

            const startISO = `${selectedDay}T${pad(startH)}:${pad(startM)}:00${WARSAW_OFFSET}`;
            const endISO = `${selectedDay}T${pad(endH)}:${pad(endM)}:00${WARSAW_OFFSET}`;

            await createEvent({
              summary: `✨ [AI] ${todo.title}`,
              start: startISO,
              end: endISO,
              category: 'work'
            });

            await setTodoStatus({ id: todo.id }, 'done');

            let bufferMins = decompressionBuffer ? 15 : 0;
            busyIntervals.push({ start: slotStart, end: slotEnd + bufferMins });
            busyIntervals.sort((a, b) => a.start - b.start);

            currentPointer = slotEnd + bufferMins;
            foundSlot = true;
          } else {
            currentPointer += 15; // Scan next 15-minute alignment
          }
        }
      }

      await fetchEvents();
      await fetchSidebarTodos();
      setToastMessage('Zadania zostały pomyślnie zaplanowane przez AI! ✨');
    } catch (e) {
      console.error('Error during AI scheduling:', e);
      setToastMessage('Wystąpił błąd podczas planowania.');
    } finally {
      setIsScheduling(false);
    }
  };

  const handleSyncOuraSleep = async () => {
    if (!userId) return;
    setSyncingOuraSleep(true);
    setToastMessage('Pobieram dane snu z Oura... 🔄');
    try {
      // Fetch Oura daily summaries
      const { data: ouraRows, error: ouraErr } = await supabase
        .from('oura_daily_summary')
        .select('date, bedtime_timestamp, total_sleep_hours')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(14);

      if (ouraErr) throw ouraErr;
      if (!ouraRows || ouraRows.length === 0) {
        setToastMessage('Brak danych snu w oura_daily_summary! ❌');
        setSyncingOuraSleep(false);
        return;
      }

      // Fetch current calendar events for the active range
      const fromISO = addDays(selectedDay, -7) + 'T00:00:00Z';
      const toISO = addDays(selectedDay, 7) + 'T23:59:59Z';
      const { data: currentEvents, error: eventsErr } = await supabase
        .from('vanguard_calendar')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', fromISO)
        .lt('start_time', toISO);

      if (eventsErr) throw eventsErr;

      let updatedCount = 0;
      let createdCount = 0;

      for (const row of ouraRows) {
        if (!row.bedtime_timestamp || !row.total_sleep_hours) continue;

        // Oura stores bedtime_timestamp in UTC/Warsaw timezone context
        const startISO = new Date(row.bedtime_timestamp).toISOString();
        const endISO = new Date(
          new Date(row.bedtime_timestamp).getTime() + row.total_sleep_hours * 3600 * 1000
        ).toISOString();

        // Oura date represents the morning of wake up (e.g. "2026-07-04" for sleep ending July 4th morning)
        const wakeDateStr = row.date;

        // Find existing "Sen" / "Sleep" event that ends on this date
        const existingEvent = currentEvents?.find((ev) => {
          const isSen = ev.summary?.toLowerCase() === 'sen' || ev.summary?.toLowerCase()?.includes('sen ') || ev.summary?.toLowerCase() === 'sleep';
          if (!isSen) return false;
          const evEndDateStr = ev.end_time?.split('T')[0];
          return evEndDateStr === wakeDateStr;
        });

        if (existingEvent) {
          await updateEvent({
            id: existingEvent.event_id || existingEvent.id,
            summary: 'Sen 🛌',
            start: startISO,
            end: endISO,
            category: 'health',
          });
          updatedCount++;
        } else {
          await createEvent({
            summary: 'Sen 🛌',
            start: startISO,
            end: endISO,
            category: 'health',
          });
          createdCount++;
        }
      }

      if (updatedCount === 0 && createdCount === 0) {
        setToastMessage('Dane snu Oura są już aktualne! 🛌✨');
      } else {
        setToastMessage(`Zsynchronizowano sen: zaktualizowano ${updatedCount}, dodano ${createdCount}! 🛌✨`);
      }
      await fetchEvents();
    } catch (err) {
      console.error('Error syncing Oura sleep:', err);
      setToastMessage('Nie udało się zsynchronizować snu z Oura.');
    } finally {
      setSyncingOuraSleep(false);
    }
  };

  const handleSyncActivities = async () => {
    if (!userId) return;
    setSyncingActivities(true);
    setToastMessage('Pobieram aktywności... 🔄');
    try {
      // 1. Fetch workout sessions with exercise logs
      const { data: sessions, error: sessionErr } = await supabase
        .from('workout_sessions')
        .select('*, exercise_logs(exercise_name)')
        .eq('user_id', userId)
        .order('workout_day', { ascending: false })
        .limit(30);

      if (sessionErr) throw sessionErr;

      // 2. Fetch Strava activities
      const { data: strava, error: stravaErr } = await supabase
        .from('strava_activities_clean')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false })
        .limit(30);

      if (stravaErr) throw stravaErr;

      // 3. Fetch current calendar events for range
      const fromISO = addDays(selectedDay, -10) + 'T00:00:00Z';
      const toISO = addDays(selectedDay, 10) + 'T23:59:59Z';
      const { data: currentEvents, error: eventsErr } = await supabase
        .from('vanguard_calendar')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', fromISO)
        .lt('start_time', toISO);

      if (eventsErr) throw eventsErr;

      let createdCount = 0;
      let skippedCount = 0;

      const eventExists = (startTime: string, summarySub: string) => {
        const startSec = new Date(startTime).getTime();
        return currentEvents?.some((ev) => {
          const startEvSec = new Date(ev.start_time || '').getTime();
          const matchTime = Math.abs(startSec - startEvSec) < 5 * 60 * 1000; // 5 mins threshold
          const matchSummary = ev.summary?.toLowerCase()?.includes(summarySub.toLowerCase());
          return matchTime && matchSummary;
        });
      };

      // Sync Gym & Sauna
      if (sessions) {
        for (const session of sessions) {
          if (!session.start_time) continue;

          const isSauna = session.exercise_logs?.some(
            (el: any) => el.exercise_name?.toLowerCase() === 'sauna'
          );

          const summary = isSauna ? 'Sauna 🧖' : 'Siłownia 🏋️';
          const category = isSauna ? 'health' : 'sport';
          const startISO = new Date(session.start_time).toISOString();

          let duration = session.duration_minutes || 60;
          if (session.end_time && session.start_time) {
            const diffMs = new Date(session.end_time).getTime() - new Date(session.start_time).getTime();
            if (diffMs > 0 && diffMs < 5 * 3600 * 1000) {
              duration = diffMs / (60 * 1000);
            }
          }

          const endISO = new Date(new Date(startISO).getTime() + duration * 60 * 1000).toISOString();

          if (eventExists(startISO, isSauna ? 'sauna' : 'siłownia')) {
            skippedCount++;
            continue;
          }

          await createEvent({
            summary,
            start: startISO,
            end: endISO,
            category,
          });
          createdCount++;
        }
      }

      // Sync Strava runs
      if (strava) {
        for (const act of strava) {
          if (!act.start_date) continue;

          const summary = `Bieg 🏃 (${act.name || 'Strava'})`;
          const startISO = new Date(act.start_date).toISOString();
          const durationSec = act.elapsed_time || 3600;
          const endISO = new Date(new Date(startISO).getTime() + durationSec * 1000).toISOString();

          if (eventExists(startISO, 'bieg')) {
            skippedCount++;
            continue;
          }

          await createEvent({
            summary,
            start: startISO,
            end: endISO,
            category: 'sport',
          });
          createdCount++;
        }
      }

      if (createdCount === 0) {
        setToastMessage('Wszystkie aktywności są już aktualne! 🏃🏋️🧖');
      } else {
        setToastMessage(`Zsynchronizowano aktywności: dodano ${createdCount} nowych wpisów! 🏃🏋️🧖`);
      }
      await fetchEvents();
    } catch (err) {
      console.error('Error syncing activities:', err);
      setToastMessage('Nie udało się zsynchronizować aktywności.');
    } finally {
      setSyncingActivities(false);
    }
  };

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

  const renderEventBlock = (ev: CalRow, colWidth: string) => {
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
        className={`absolute left-0.5 right-0.5 rounded-[6px] border-l-[3.5px] border-y border-r border-border-custom/10 ${tooShort ? 'px-1 py-0.5 flex items-center justify-center' : 'px-2 py-1'} overflow-hidden cursor-move hover:scale-[1.015] hover:shadow-md hover:brightness-105 active:scale-[0.985] active:brightness-95 transition-all duration-200 hover:z-20 select-none ${eventColor(ev)}`}
        style={{ top, height, width: colWidth }}
        title={ev.summary || ''}
      >
        <div className="flex items-center gap-1 min-w-0 w-full justify-center">
          {isAIScheduled && !tooShort && <Sparkles size={10} className="shrink-0 text-current animate-pulse opacity-90" />}
          {isFocusTime && !tooShort && <Shield size={10} className="shrink-0 text-current opacity-90" />}
          <p className={`text-current ${tooShort ? 'text-[8px]' : 'text-[10.5px]'} font-bold leading-none truncate text-center`}>
            {displaySummary}
          </p>
        </div>
        {!tooShort && (
          <p className="text-current/75 text-[8.5px] font-bold leading-tight mt-0.5">
            {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
          </p>
        )}
        
        {/* Drag Resize Handle (Bottom Edge) */}
        <div
          onMouseDown={(e) => handleEventMouseDown(ev, e, 'resize')}
          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize hover:bg-black/10 dark:hover:bg-white/10 z-30"
        />
      </div>
    );
  }

  const renderTimeGutter = () => {
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

  const renderDayColumn = (day: string, colClass = '') => {
    const dayEvents = eventsForDay(day);
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
                const endMin = startMin + 60; // default to 1 hour duration

                const pad = (n: number) => String(n).padStart(2, '0');
                const startH = Math.floor(startMin / 60);
                const startM = startMin % 60;
                const endH = Math.floor(endMin / 60);
                const endM = endMin % 60;

                const startISO = `${day}T${pad(startH)}:${pad(startM)}:00${WARSAW_OFFSET}`;
                const endISO = `${day}T${pad(Math.min(endH, 23))}:${pad(endM)}:00${WARSAW_OFFSET}`;

                setSaving(true);
                await createEvent({
                  summary: todo.title,
                  start: startISO,
                  end: endISO,
                  category: 'work'
                });

                // Complete the task from the inbox (shows strikethrough animation first)
                handleToggleTodo(todo.id);
                setToastMessage(`Zaplanowano zadanie: "${todo.title}"! 📅`);
                await fetchEvents();
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
        <div className="flex border-b border-border-custom/20" style={{ paddingLeft: 36 }}>
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
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: null, label: 'Brak', color: 'border-border-custom bg-surface-solid text-text-muted', dot: 'bg-slate-400' },
                { key: 'work', label: 'Praca', color: 'border-blue-500/20 bg-blue-500/8 text-blue-500', dot: 'bg-blue-500' },
                { key: 'health', label: 'Zdrowie', color: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-500', dot: 'bg-emerald-500' },
                { key: 'personal', label: 'Osobiste', color: 'border-violet-500/20 bg-violet-500/8 text-violet-500', dot: 'bg-violet-500' },
                { key: 'sport', label: 'Sport', color: 'border-orange-500/20 bg-orange-500/8 text-orange-500', dot: 'bg-orange-500' },
                { key: 'study', label: 'Nauka', color: 'border-sky-500/20 bg-sky-500/8 text-sky-500', dot: 'bg-sky-500' },
              ].map((cat) => {
                const isSelected = quickCategory === cat.key;
                const baseColors = cat.color.split(' ');
                return (
                  <button
                    key={cat.key || 'none'}
                    type="button"
                    onClick={() => setQuickCategory(cat.key)}
                    className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
                      isSelected
                        ? cat.key
                          ? `${baseColors[0]} ${baseColors[1].replace('/8', '/20')} text-text-primary font-black shadow-sm`
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
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: null, label: 'Brak', color: 'border-border-custom bg-surface-solid text-text-muted', dot: 'bg-slate-400' },
                { key: 'work', label: 'Praca', color: 'border-blue-500/20 bg-blue-500/8 text-blue-500', dot: 'bg-blue-500' },
                { key: 'health', label: 'Zdrowie', color: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-500', dot: 'bg-emerald-500' },
                { key: 'personal', label: 'Osobiste', color: 'border-violet-500/20 bg-violet-500/8 text-violet-500', dot: 'bg-violet-500' },
                { key: 'sport', label: 'Sport', color: 'border-orange-500/20 bg-orange-500/8 text-orange-500', dot: 'bg-orange-500' },
                { key: 'study', label: 'Nauka', color: 'border-sky-500/20 bg-sky-500/8 text-sky-500', dot: 'bg-sky-500' },
              ].map((cat) => {
                const isSelected = editCategory === cat.key;
                const baseColors = cat.color.split(' ');
                return (
                  <button
                    key={cat.key || 'none'}
                    type="button"
                    onClick={() => setEditCategory(cat.key)}
                    className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
                      isSelected
                        ? cat.key
                          ? `${baseColors[0]} ${baseColors[1].replace('/8', '/20')} text-text-primary font-black shadow-sm`
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
        const categories = ['work', 'health', 'personal', 'sport', 'study'];
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
              { key: 'work', label: 'Praca (work)', placeholderMin: 'brak', placeholderMax: 'np. 40' },
              { key: 'health', label: 'Zdrowie (health)', placeholderMin: 'np. 3', placeholderMax: 'brak' },
              { key: 'personal', label: 'Relacje (personal)', placeholderMin: 'np. 4', placeholderMax: 'brak' },
              { key: 'sport', label: 'Sport (sport)', placeholderMin: 'np. 5', placeholderMax: 'brak' },
              { key: 'study', label: 'Nauka (study)', placeholderMin: 'np. 3', placeholderMax: 'brak' },
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

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col">
                  <span className="text-[11.5px] font-bold text-text-primary group-hover:text-primary transition-colors">Elastyczne Nawyki</span>
                  <span className="text-[9px] text-text-muted">Dynamiczna relokacja rutyn</span>
                </div>
                <input
                  type="checkbox"
                  checked={smartHabitsFlex}
                  onChange={(e) => setSmartHabitsFlex(e.target.checked)}
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Budżety czasu (Tydzień)</span>
              <button
                onClick={() => {
                  const mins: Record<string, string> = {};
                  const maxs: Record<string, string> = {};
                  ['work', 'health', 'personal', 'sport', 'study'].forEach((cat) => {
                    const b = budgets.find((item) => item.category === cat);
                    mins[cat] = b?.min_hours !== null && b?.min_hours !== undefined ? String(b.min_hours) : '';
                    maxs[cat] = b?.max_hours !== null && b?.max_hours !== undefined ? String(b.max_hours) : '';
                  });
                  setBudgetMinInputs(mins);
                  setBudgetMaxInputs(maxs);
                  setShowBudgetConfig(true);
                }}
                className="text-[10px] text-primary font-black hover:underline"
              >
                Konfiguruj
              </button>
            </div>
            <div className="space-y-2">
              {[
                { key: 'work', label: 'Praca', color: 'bg-blue-500', dot: 'bg-blue-500' },
                { key: 'health', label: 'Zdrowie', color: 'bg-emerald-500', dot: 'bg-emerald-500' },
                { key: 'personal', label: 'Relacje', color: 'bg-violet-500', dot: 'bg-violet-500' },
                { key: 'sport', label: 'Sport', color: 'bg-orange-500', dot: 'bg-orange-500' },
                { key: 'study', label: 'Nauka', color: 'bg-sky-500', dot: 'bg-sky-500' },
              ].map((cat) => {
                const spent = categoryWeeklyTotals[cat.key] || 0;
                const b = budgets.find((item) => item.category === cat.key);
                const minVal = b?.min_hours;
                const maxVal = b?.max_hours;

                let pct = 0;
                let statusText = '';
                let barColor = cat.color;

                if (minVal !== null && minVal !== undefined && minVal > 0) {
                  pct = Math.min(100, (spent / minVal) * 100);
                  statusText = `${spent.toFixed(1)}h / min ${minVal}h`;
                  if (spent >= minVal) {
                    barColor = 'bg-emerald-500 dark:bg-emerald-400';
                  } else {
                    barColor = 'bg-amber-500 dark:bg-amber-400';
                  }
                } else if (maxVal !== null && maxVal !== undefined && maxVal > 0) {
                  pct = Math.min(100, (spent / maxVal) * 100);
                  statusText = `${spent.toFixed(1)}h / max ${maxVal}h`;
                  if (spent > maxVal) {
                    barColor = 'bg-rose-500 dark:bg-rose-400';
                  } else {
                    barColor = cat.color;
                  }
                } else {
                  statusText = `${spent.toFixed(1)}h`;
                  pct = 0;
                }

                return (
                  <div key={cat.key} className="space-y-1 p-2.5 bg-surface-solid/5 dark:bg-white/[0.015] border border-border-custom/30 rounded-xl">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                        <span className="text-text-primary">{cat.label}</span>
                      </div>
                      <span className="text-text-muted">{statusText}</span>
                    </div>
                    {(minVal || maxVal) ? (
                      <div className="w-full h-1 bg-border-custom/40 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    ) : (
                      <div className="text-[9px] text-text-muted/40 italic mt-0.5">Brak limitu</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: Tasks (Notion Calendar Style) */}
          <div className="space-y-3 pt-4 border-t border-border-custom/40">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Zadania (Inbox)</span>
            
            {/* Quick add task input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Dodaj szybkie zadanie..."
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAddTodo(); }}
                className="w-full bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl pl-3 pr-8 py-2 text-[12px] font-semibold text-text-primary outline-none focus:border-primary/50 transition-all placeholder:text-text-muted/30"
              />
              <button
                onClick={handleQuickAddTodo}
                disabled={!newTodoTitle.trim()}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80 disabled:opacity-30"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
              {sidebarTodos.length === 0 ? (
                <p className="text-[11px] text-text-muted/40 italic text-center py-4">Brak aktywnych zadań</p>
              ) : (
                sidebarTodos.map((todo) => {
                  const isCompleted = completedTodoIds.has(todo.id);
                  return (
                    <div
                      key={todo.id}
                      draggable="true"
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', JSON.stringify({ id: todo.id, title: todo.title }));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      className={`flex items-start gap-2.5 p-2.5 bg-slate-50 dark:bg-white/[0.015] border border-border-custom/30 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-all cursor-grab active:cursor-grabbing group hover:scale-[1.01] active:scale-[0.99] select-none ${isCompleted ? 'opacity-50 border-emerald-500/20 bg-emerald-500/[0.02]' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={() => handleToggleTodo(todo.id)}
                        className="mt-0.5 w-3.5 h-3.5 border-border-custom/80 rounded bg-transparent checked:bg-emerald-500 checked:border-emerald-500 transition-all cursor-pointer accent-emerald-500 shrink-0"
                      />
                      <span className={`text-[12px] font-semibold flex-1 break-words transition-all duration-300 ${isCompleted ? 'line-through text-text-muted/50' : 'text-text-primary group-hover:text-primary'}`}>
                        {todo.title}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
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
              ['work', 'health', 'personal', 'sport', 'study'].forEach((cat) => {
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
            <div className="px-4 pb-3.5 pt-1 grid grid-cols-2 gap-3.5">
              {[
                { key: 'work', label: 'Praca', color: 'bg-blue-500', text: 'text-blue-500' },
                { key: 'health', label: 'Zdrowie', color: 'bg-emerald-500', text: 'text-emerald-500' },
                { key: 'personal', label: 'Relacje', color: 'bg-violet-500', text: 'text-violet-500' },
                { key: 'sport', label: 'Sport', color: 'bg-orange-500', text: 'text-orange-500' },
                { key: 'study', label: 'Nauka', color: 'bg-sky-500', text: 'text-sky-500' },
              ].map((cat) => {
                const spent = categoryWeeklyTotals[cat.key] || 0;
                const b = budgets.find((item) => item.category === cat.key);
                const minVal = b?.min_hours;
                const maxVal = b?.max_hours;

                let pct = 0;
                let statusText = '';
                let barColor = cat.color;

                if (minVal !== null && minVal !== undefined && minVal > 0) {
                  pct = Math.min(100, (spent / minVal) * 100);
                  statusText = `${spent.toFixed(1)}h / min ${minVal}h`;
                  if (spent >= minVal) {
                    barColor = 'bg-emerald-500 dark:bg-emerald-400';
                  } else {
                    barColor = 'bg-amber-500 dark:bg-amber-400';
                  }
                } else if (maxVal !== null && maxVal !== undefined && maxVal > 0) {
                  pct = Math.min(100, (spent / maxVal) * 100);
                  statusText = `${spent.toFixed(1)}h / max ${maxVal}h`;
                  if (spent > maxVal) {
                    barColor = 'bg-rose-500 dark:bg-rose-400';
                  } else {
                    barColor = cat.color;
                  }
                } else {
                  statusText = `${spent.toFixed(1)}h`;
                  pct = 0;
                }

                return (
                  <div key={cat.key} className="space-y-1.5 p-2 bg-slate-50 dark:bg-white/[0.015] border border-border-custom/50 rounded-xl">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-text-primary">{cat.label}</span>
                      <span className="text-text-muted">{statusText}</span>
                    </div>
                    {(minVal || maxVal) ? (
                      <div className="w-full h-1.5 bg-border-custom/40 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    ) : (
                      <div className="text-[9px] text-text-muted/40 italic">Brak limitu</div>
                    )}
                  </div>
                );
              })}
            </div>
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
