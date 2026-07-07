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
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  CloudSun,
  CloudMoon,
  Wind,
  Thermometer,
  Repeat,
  ListChecks,
  AlignLeft,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';

import { useCalendarWrite, type CalendarEvent } from '../../hooks/useCalendarWrite';
import { useTimeBudgets } from '../../hooks/useTimeBudgets';
import { useCalendarTodos, type CalendarTodo } from '../../hooks/useCalendarTodos';
import { warsawDayBoundsISO, combineDateTimeWarsawISO } from '../../lib/date';
import { LIFE_SPHERES, LEGACY_CATEGORY_TO_SPHERE } from '../../lib/lifeSpheres';
import { GOAL_ICON } from '../todo/todoUtils';
import { updateTodoItem, deleteTodoItem } from '../../lib/todo';

import {
  getWarsawOffset,
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
import { Session } from '@supabase/supabase-js';

interface Props {
  session: Session;
  onBack: () => void;
  onSyncCalendar: () => void;
  onResyncCalendar?: () => Promise<void> | void;
  isSyncing: boolean;
  onNavigateTo?: (dest: string) => void;
}

type CalView = 'dzien' | 'tydzien' | 'agenda';

interface QuickCreateState {
  date: string;
  startMin: number; // minutes from midnight
}

export default function CalendarView({ session, onBack, onSyncCalendar, onResyncCalendar, isSyncing, onNavigateTo }: Props) {
  const userId = session?.user?.id as string | undefined;
  const accessToken = session?.access_token as string | undefined;

  const today = todayStr();
  const [calView, setCalView] = useState<CalView>('dzien');
  const [selectedDay, setSelectedDay] = useState(today);
  const [weekStart, setWeekStart] = useState(() => weekMon(today));

  // Visible date range — shared by the calendar-event fetch and the todo-scheduling fetch
  const visibleRange = useMemo(() => {
    if (calView === 'dzien' || calView === 'tydzien') {
      return { rangeStart: weekStart, rangeEnd: addDays(weekStart, 7) };
    }
    return { rangeStart: today, rangeEnd: addDays(today, 14) }; // agenda: next 14 days
  }, [calView, weekStart, today]);

  const [events, setEvents] = useState<CalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickCreate, setQuickCreate] = useState<QuickCreateState | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDuration, setQuickDuration] = useState(60);
  const [quickCategory, setQuickCategory] = useState<string | null>(null);
  const [quickType, setQuickType] = useState<'event' | 'task'>('event');
  const [quickDescription, setQuickDescription] = useState('');
  const [quickRecurrence, setQuickRecurrence] = useState<'' | 'daily' | 'weekly' | 'monthly' | 'custom'>('');
  const [quickCustomDays, setQuickCustomDays] = useState<string[]>([]);
  const [quickRecurrenceEndDate, setQuickRecurrenceEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit scheduled todo state
  const [editingTodo, setEditingTodo] = useState<CalendarTodo | null>(null);
  const [editingTodoTitle, setEditingTodoTitle] = useState('');

  // Edit event state
  const [selectedEvent, setSelectedEvent] = useState<CalRow | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editRecurrence, setEditRecurrence] = useState<'' | 'daily' | 'weekly' | 'monthly' | 'custom'>('');
  const [editCustomDays, setEditCustomDays] = useState<string[]>([]);
  const [editRecurrenceEndDate, setEditRecurrenceEndDate] = useState('');
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

  // Sidebar Collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('vanguard_calendar_sidebar_collapsed') === 'true';
    } catch (err: unknown) {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('vanguard_calendar_sidebar_collapsed', String(next));
      } catch (err: unknown) {
      console.error('[Background Error]', err);
    }
      return next;
    });
  };

  // Weather integration

  const { userSettings, fetchUserSettings } = useStore();
  
  interface DailyForecastItem {
    date: string;
    weatherCode: number;
    tempMax: number;
    tempMin: number;
  }

  interface HourlyForecastItem {
    hour: number; // 0-23
    temp: number;
    weatherCode: number;
    precipProb: number;
  }

  interface WeatherState {
    current: {
      temp: number;
      feelsLike: number;
      humidity: number;
      windSpeed: number;
      description: string;
      iconCode: string;
      name: string;
      isOWM: boolean;
    } | null;
    daily: Record<string, DailyForecastItem>;
    hourly: Record<string, HourlyForecastItem[]>; // keyed by date string YYYY-MM-DD
    error: boolean;
  }

  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    if (!userSettings) {
      fetchUserSettings();
    }
  }, [userSettings, fetchUserSettings]);

  useEffect(() => {
    const lat = userSettings?.home_lat ?? 49.6950; // Default to Świerzowa Polska if null
    const lng = userSettings?.home_lng ?? 21.7225;
    const start = visibleRange.rangeStart;
    const end = visibleRange.rangeEnd;
    const apiKey = import.meta.env.VITE_OPENWEATHERMAP_API_KEY;

    let isMounted = true;

    async function fetchWeather() {
      try {
        let currentData = null;

        // 1. Try fetching current weather from OpenWeatherMap (gives live radar/rain data)
        if (apiKey) {
          try {
            const owmRes = await fetch(
              `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=pl`
            );
            if (owmRes.ok) {
              const owmData = await owmRes.json();
              currentData = {
                temp: Math.round(owmData.main.temp),
                feelsLike: Math.round(owmData.main.feels_like),
                humidity: owmData.main.humidity,
                windSpeed: Math.round(owmData.wind.speed * 3.6), // convert m/s to km/h
                description: owmData.weather[0]?.description || '',
                iconCode: owmData.weather[0]?.icon || '',
                name: getCityName(lat, lng),
                isOWM: true
              };
            }
          } catch (err: unknown) {
      console.error('[Background Error]', err);
    }
        }

        // 2. Fetch Open-Meteo for daily forecast (and current as fallback)
        const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&start_date=${start}&end_date=${end}&daily=weather_code,temperature_2m_max,temperature_2m_min&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&timezone=Europe/Warsaw`;
        const res = await fetch(openMeteoUrl);
        if (!res.ok) throw new Error('Failed to fetch Open-Meteo');
        const data = await res.json();

        // 3. Fetch hourly forecast for today + tomorrow (only 2 days, very small payload)
        const todayDate = today;
        const tomorrowDate = addDays(today, 1);
        const hourlyUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&start_date=${todayDate}&end_date=${tomorrowDate}&hourly=temperature_2m,weather_code,precipitation_probability&timezone=Europe/Warsaw`;
        const hourlyRes = await fetch(hourlyUrl);
        let hourlyData: Record<string, HourlyForecastItem[]> = {};
        if (hourlyRes.ok) {
          const hd = await hourlyRes.json();
          if (hd.hourly && hd.hourly.time) {
            for (let i = 0; i < hd.hourly.time.length; i++) {
              // time format: "2026-07-07T06:00"
              const isoStr: string = hd.hourly.time[i];
              const dateKey = isoStr.slice(0, 10);
              const hour = parseInt(isoStr.slice(11, 13), 10);
              if (!hourlyData[dateKey]) hourlyData[dateKey] = [];
              hourlyData[dateKey].push({
                hour,
                temp: Math.round(hd.hourly.temperature_2m[i]),
                weatherCode: hd.hourly.weather_code[i],
                precipProb: hd.hourly.precipitation_probability[i] ?? 0,
              });
            }
          }
        }
        
        if (isMounted) {
          // Fallback current weather to Open-Meteo if OWM wasn't successful
          if (!currentData && data.current) {
            currentData = {
              temp: Math.round(data.current.temperature_2m),
              feelsLike: Math.round(data.current.apparent_temperature),
              humidity: data.current.relative_humidity_2m,
              windSpeed: Math.round(data.current.wind_speed_10m),
              description: getWMOWeatherDescription(data.current.weather_code),
              iconCode: String(data.current.weather_code) + (data.current.is_day ? 'd' : 'n'),
              name: getCityName(lat, lng),
              isOWM: false
            };
          }

          const daily: Record<string, DailyForecastItem> = {};
          if (data.daily && data.daily.time) {
            for (let i = 0; i < data.daily.time.length; i++) {
              const dStr = data.daily.time[i];
              daily[dStr] = {
                date: dStr,
                weatherCode: data.daily.weather_code[i],
                tempMax: Math.round(data.daily.temperature_2m_max[i]),
                tempMin: Math.round(data.daily.temperature_2m_min[i])
              };
            }
          }

          setWeather({
            current: currentData,
            daily,
            hourly: hourlyData,
            error: false
          });
          setWeatherLoading(false);
        }
      } catch (err: unknown) {
        console.error('Error fetching weather:', err);
        if (isMounted) {
          setWeather(prev => (prev ? { ...prev, error: true } : {
            current: null,
            daily: {},
            hourly: {},
            error: true
          }));
          setWeatherLoading(false);
        }
      }
    }

    fetchWeather();
    
    // Refresh weather every 15 minutes
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [userSettings?.home_lat, userSettings?.home_lng, visibleRange.rangeStart, visibleRange.rangeEnd]);

  const getCityName = (lat: number, lng: number) => {
    if (Math.abs(lat - 49.6950) < 0.005 && Math.abs(lng - 21.7225) < 0.005) {
      return 'Świerzowa Polska';
    }
    if (Math.abs(lat - 49.68886) < 0.05 && Math.abs(lng - 21.76466) < 0.05) {
      return 'Krosno';
    }
    if (Math.abs(lat - 52.2297) < 0.05 && Math.abs(lng - 21.0122) < 0.05) {
      return 'Warszawa';
    }
    return 'Moja lokalizacja';
  };

  const getWMOWeatherDescription = (code: number) => {
    switch (code) {
      case 0: return 'Jasno';
      case 1:
      case 2: return 'Zachmurzenie częściowe';
      case 3: return 'Pochmurno';
      case 45:
      case 48: return 'Mgła';
      case 51:
      case 53:
      case 55: return 'Mżawka';
      case 61:
      case 63:
      case 65: return 'Deszcz';
      case 71:
      case 73:
      case 75: return 'Śnieg';
      case 80:
      case 81:
      case 82: return 'Przelotny deszcz';
      case 95:
      case 96:
      case 99: return 'Burza';
      default: return 'Umiarkowane zachmurzenie';
    }
  };

  const getOWMWeatherIcon = (iconCode: string, size = 15) => {
    const isNight = iconCode.endsWith('n');
    const code = iconCode.substring(0, 2);

    switch (code) {
      case '01':
        return isNight ? <Moon size={size} className="text-indigo-300 animate-pulse" /> : <Sun size={size} className="text-amber-400" />;
      case '02':
        return isNight ? <CloudMoon size={size} className="text-slate-300" /> : <CloudSun size={size} className="text-amber-300" />;
      case '03':
      case '04':
        return <Cloud size={size} className="text-slate-400" />;
      case '09':
        return <CloudDrizzle size={size} className="text-sky-400" />;
      case '10':
        return <CloudRain size={size} className="text-blue-400" />;
      case '11':
        return <CloudLightning size={size} className="text-amber-500 animate-pulse" />;
      case '13':
        return <CloudSnow size={size} className="text-sky-200" />;
      case '50':
        return <Wind size={size} className="text-zinc-400" />;
      default:
        return <Cloud size={size} className="text-slate-400" />;
    }
  };

  const getWMOWeatherIcon = (code: number, size = 12, isNight = false) => {
    switch (code) {
      case 0:
        return isNight ? <Moon size={size} className="text-indigo-300 animate-pulse" /> : <Sun size={size} className="text-amber-400" />;
      case 1:
      case 2:
        return isNight ? <CloudMoon size={size} className="text-slate-300" /> : <CloudSun size={size} className="text-amber-300" />;
      case 3:
        return <Cloud size={size} className="text-slate-400" />;
      case 45:
      case 48:
        return <Wind size={size} className="text-zinc-400" />;
      case 51:
      case 53:
      case 55:
        return <CloudDrizzle size={size} className="text-sky-300" />;
      case 61:
      case 63:
      case 65:
        return <CloudRain size={size} className="text-blue-400" />;
      case 71:
      case 73:
      case 75:
        return <CloudSnow size={size} className="text-sky-200" />;
      case 80:
      case 81:
      case 82:
        return <CloudRain size={size} className="text-sky-400" />;
      case 95:
      case 96:
      case 99:
        return <CloudLightning size={size} className="text-amber-500 animate-pulse" />;
      default:
        return <Cloud size={size} className="text-slate-400" />;
    }
  };

  const renderWeatherWidget = () => {
    if (weatherLoading) {
      return (
        <div className="flex items-center gap-1.5 rounded-full border border-border-custom/50 bg-surface/30 px-3 py-1 text-[11px] font-bold text-text-muted animate-pulse">
          <div className="w-3.5 h-3.5 rounded-full bg-text-muted/30" />
          <div className="w-8 h-3.5 rounded bg-text-muted/30" />
        </div>
      );
    }
    
    if (!weather || weather.error || !weather.current) {
      return (
        <div className="flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/5 px-3 py-1 text-[11px] font-bold text-red-500/80">
          <Cloud size={14} />
          <span>Brak pogody</span>
        </div>
      );
    }

    const current = weather.current;

    return (
      <div className="flex items-center gap-1.5 rounded-full border border-border-custom/50 bg-surface/30 px-3 py-1 text-[11.5px] font-bold text-text-primary transition-all duration-300 hover:bg-surface/50 relative group cursor-pointer shadow-sm">
        <div className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12 flex items-center">
          {current.isOWM 
            ? getOWMWeatherIcon(current.iconCode, 15) 
            : getWMOWeatherIcon(parseInt(current.iconCode), 15, current.iconCode.endsWith('n'))
          }
        </div>
        <span>{current.temp}°C</span>

        {/* Tooltip */}
        <div className="absolute top-full mt-2 right-0 z-[100] w-52 rounded-xl border border-border-custom bg-surface p-3.5 shadow-xl opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 ease-out text-left">
          <div className="text-[10px] font-black text-text-muted mb-0.5 uppercase tracking-wider">Pogoda teraz</div>
          <div className="text-[14px] font-black text-text-primary mb-0.5 flex items-center justify-between">
            <span>{current.name}</span>
            <span className="text-primary">{current.temp}°C</span>
          </div>
          <div className="text-[11.5px] font-bold text-text-secondary mb-2 capitalize">{current.description}</div>
          
          <div className="border-t border-border-custom/40 my-2" />
          
          <div className="space-y-1.5 text-[10px] font-semibold text-text-muted">
            <div className="flex justify-between">
              <span>Odczuwalna:</span>
              <span className="text-text-primary">{current.feelsLike}°C</span>
            </div>
            <div className="flex justify-between">
              <span>Wilgotność:</span>
              <span className="text-text-primary">{current.humidity}%</span>
            </div>
            <div className="flex justify-between">
              <span>Wiatr:</span>
              <span className="text-text-primary">{current.windSpeed} km/h</span>
            </div>
          </div>
        </div>
      </div>
    );
  };



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
    createScheduledTodo,
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
      } catch (err: unknown) {
      console.error('[Background Error]', err);
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
    } catch (err: unknown) {
      console.error('[Background Error]', err);
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
        setQuickType('event');
        setQuickDescription('');
        setQuickRecurrence('');
        setQuickCustomDays([]);
        setQuickRecurrenceEndDate('');
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
    setQuickType('event');
    setQuickDescription('');
    setQuickRecurrence('');
    setQuickCustomDays([]);
    setQuickRecurrenceEndDate('');
  }

  // RRULE UNTIL wants a UTC date-time (YYYYMMDDTHHMMSSZ) — anchor it to end-of-day Warsaw time
  // so the last occurrence on the picked date still fires before the series stops.
  const formatRRuleUntil = (dateStr: string): string => {
    const local = new Date(`${dateStr}T23:59:59${getWarsawOffset(dateStr)}`);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${local.getUTCFullYear()}${pad(local.getUTCMonth() + 1)}${pad(local.getUTCDate())}T${pad(local.getUTCHours())}${pad(local.getUTCMinutes())}${pad(local.getUTCSeconds())}Z`;
  };

  const buildRecurrenceRule = (
    recurrence: '' | 'daily' | 'weekly' | 'monthly' | 'custom',
    customDays: string[],
    endDate: string,
  ): string[] | undefined => {
    if (!recurrence) return undefined;
    let rule: string;
    if (recurrence === 'custom') {
      if (!customDays.length) return undefined;
      rule = `FREQ=WEEKLY;BYDAY=${customDays.join(',')}`;
    } else {
      rule = { daily: 'FREQ=DAILY', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY' }[recurrence];
    }
    if (endDate) rule += `;UNTIL=${formatRRuleUntil(endDate)}`;
    return [`RRULE:${rule}`];
  };

  const handleQuickSave = async () => {
    if (!quickCreate || !quickTitle.trim()) return;
    setSaving(true);
    const { date, startMin } = quickCreate;

    if (quickType === 'task') {
      try {
        await createScheduledTodo({
          title: quickTitle.trim(),
          day: date,
          startMin,
          durationMinutes: quickDuration,
          notes: quickDescription.trim() || undefined,
          recurrence: (quickRecurrence === 'custom' ? undefined : quickRecurrence) || undefined,
        });
        setQuickCreate(null);
      } catch (err: unknown) {
      console.error('[Background Error]', err);
    } finally {
        setSaving(false);
      }
      return;
    }

    const endMin = startMin + quickDuration;
    const [y, m, d] = date.split('-');
    const startH = Math.floor(startMin / 60);
    const startM = startMin % 60;
    const endH = Math.floor(endMin / 60);
    const endM = endMin % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    const start = `${y}-${m}-${d}T${pad(startH)}:${pad(startM)}:00${getWarsawOffset(`${y}-${m}-${d}`)}`;
    const end = `${y}-${m}-${d}T${pad(Math.min(endH, 23))}:${pad(endM)}:00${getWarsawOffset(`${y}-${m}-${d}`)}`;
    const recurrence = buildRecurrenceRule(quickRecurrence, quickCustomDays, quickRecurrenceEndDate);
    const ev: CalendarEvent = {
      summary: quickTitle.trim(),
      start,
      end,
      category: quickCategory || undefined,
      description: quickDescription.trim() || undefined,
      recurrence,
    };
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
      if (recurrence?.length && onResyncCalendar) {
        // Same as handleEditSave: pull the expanded recurring series back from
        // Google so later days show the future occurrences too, not just this one.
        await onResyncCalendar();
        await fetchEvents();
      }
    } catch (err: unknown) {
      console.error('[Background Error]', err);
    } finally {
      setSaving(false);
    }
  }

  const handleEventClick = (ev: CalRow) => {
    if (!ev.start_time || !ev.end_time) return;
    setSelectedEvent(ev);
    setEditTitle(ev.summary || '');
    setEditCategory(ev.category || null);
    setEditRecurrence('');
    setEditCustomDays([]);
    setEditRecurrenceEndDate('');

    try {
      const startParts = getWarsawParts(ev.start_time);
      const endParts = getWarsawParts(ev.end_time);
      
      setEditDate(startParts.dateStr);
      setEditStart(startParts.timeStr);
      setEditEnd(endParts.timeStr);
    } catch (err: unknown) {
      console.error('Failed to parse event click time:', err);
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
    
    const start = `${editDate}T${editStart}:00${getWarsawOffset(editDate)}`;
    let endDateStr = editDate;
    
    // If end time is chronologically before start time, it crosses midnight (ends the next day)
    if (editEnd < editStart) {
      endDateStr = addDays(editDate, 1);
    }
    
    const end = `${endDateStr}T${editEnd}:00${getWarsawOffset(endDateStr)}`;
    // For recurring events GCal stores instance IDs as baseId_timestamp — strip the suffix
    // so we update the entire series, not just one occurrence.
    const rawId = selectedEvent.event_id || selectedEvent.id;
    const evId = rawId.includes('_') ? rawId.split('_')[0] : rawId;
    const recurrenceRule = buildRecurrenceRule(editRecurrence, editCustomDays, editRecurrenceEndDate);
    console.log('[handleEditSave] evId:', evId, 'recurrence:', recurrenceRule, 'editRecurrence:', editRecurrence, 'customDays:', editCustomDays, 'endDate:', editRecurrenceEndDate);
    const ev: CalendarEvent & { id: string } = {
      id: evId,
      summary: editTitle.trim(),
      start,
      end,
      category: editCategory || undefined,
      recurrence: recurrenceRule,
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
      if (ev.recurrence?.length) {
        // Recurrence is written straight to Google Calendar, but our local
        // vanguard_calendar mirror only holds this one row — future occurrences
        // won't appear until a real data resync pulls the expanded series back.
        // Without this, "Zapisz zmiany" looks like it silently did nothing.
        setToastMessage('Powtarzanie ustawione — synchronizuję kalendarz…');
        if (onResyncCalendar) {
          await onResyncCalendar();
          await fetchEvents();
          setToastMessage('Kalendarz zsynchronizowany 🔁');
        }
      } else {
        setToastMessage('Zapisano zmiany ✅');
      }
    } catch (err: unknown) {
      console.error('edit event error:', err);
      setToastMessage(`Błąd: ${err instanceof Error ? err.message : 'nieznany błąd'}`);
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
    } catch (err: unknown) {
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
          const newStartISO = `${eventDate}T${pad(Math.floor(newStartMin / 60))}:${pad(newStartMin % 60)}:00${getWarsawOffset(eventDate)}`;
          const newEndISO = `${eventDate}T${pad(Math.floor(newEndMin / 60))}:${pad(newEndMin % 60)}:00${getWarsawOffset(eventDate)}`;

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
      const startISO = `${eventDate}T${pad(Math.floor(finalStartMin / 60))}:${pad(finalStartMin % 60)}:00${getWarsawOffset(eventDate)}`;
      const endISO = `${eventDate}T${pad(Math.floor(finalEndMin / 60))}:${pad(finalEndMin % 60)}:00${getWarsawOffset(eventDate)}`;

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
      } catch (err: unknown) {
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
    
    // Hide events completely outside the visible grid
    if (endMin <= HOUR_START * 60 || startMin >= HOUR_END * 60) {
      return null;
    }

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
        className={`absolute rounded-md shadow-sm ${tooShort ? 'px-1 py-0.5 flex items-center justify-start' : 'px-1.5 py-1'} overflow-hidden cursor-move hover:shadow-md hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] active:brightness-95 transition-all duration-150 hover:z-20 select-none ${eventColor(ev)}`}
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

  const renderTimeGutter = (dayKey?: string) => {
    const tomorrow = addDays(today, 1);
    const showHourlyWeather = dayKey === today || dayKey === tomorrow;
    const hourlyForDay = showHourlyWeather && weather?.hourly?.[dayKey!] ? weather.hourly[dayKey!] : null;

    // build a quick lookup: hour -> HourlyForecastItem
    const hourlyByHour: Record<number, { temp: number; weatherCode: number; precipProb: number }> = {};
    if (hourlyForDay) {
      for (const h of hourlyForDay) {
        hourlyByHour[h.hour] = { temp: h.temp, weatherCode: h.weatherCode, precipProb: h.precipProb };
      }
    }

    // Widen the gutter when hourly weather is shown
    const gutterWidth = showHourlyWeather ? 72 : 44;

    return (
      <div className="flex flex-col shrink-0 relative" style={{ width: gutterWidth }}>
        {Array.from({ length: HOURS + 1 }, (_, i) => {
          const absoluteHour = HOUR_START + i;
          const hw = hourlyByHour[absoluteHour];
          return (
            <div
              key={i}
              className="absolute right-0 flex items-center justify-end"
              style={{ 
                top: i * PX_PER_HOUR, 
                transform: 'translateY(-50%)',
                height: 20,
                width: gutterWidth,
              }}
            >
              {hw && showHourlyWeather && (
                <div
                  className="flex items-center gap-0.5 mr-1"
                  title={`${getWMOWeatherDescription(hw.weatherCode)}${hw.precipProb > 0 ? ` · opady ${hw.precipProb}%` : ''}`}
                >
                  {getWMOWeatherIcon(hw.weatherCode, 9, absoluteHour < 6 || absoluteHour >= 20)}
                  <span
                    className={`text-[8.5px] font-black leading-none tabular-nums ${
                      hw.precipProb >= 50 ? 'text-sky-400' : 'text-text-muted/70'
                    }`}
                  >
                    {hw.temp}°
                  </span>
                </div>
              )}
              <span className="text-[10.5px] font-black text-text-secondary/80 text-right pr-2">
                {String(absoluteHour).padStart(2, '0')}:00
              </span>
            </div>
          );
        })}
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
    const isCompleting = todo.status === 'done' || completedTodoIds.has(todo.id);
    return (
      <div
        key={`todo-${todo.id}`}
        title={`${todo.title}${chip?.dreamTitle ? ` · ${chip.dreamTitle}` : ''} (przeciągnij, aby zmienić godzinę · kliknij, aby edytować)`}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData('text/plain', JSON.stringify({ id: todo.id, title: todo.title, duration_minutes: todo.duration_minutes }));
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={(e) => {
          e.stopPropagation();
          setEditingTodo(todo);
          setEditingTodoTitle(todo.title);
        }}
        className={`absolute rounded-md border border-dashed border-primary/50 bg-primary/10 hover:bg-primary/20 hover:scale-[1.01] hover:shadow-md px-1 py-0.5 overflow-hidden transition-all duration-150 z-10 cursor-grab active:cursor-grabbing ${isCompleting ? 'opacity-50' : ''}`}
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
            className={`relative after:absolute after:-inset-2 mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm border flex items-center justify-center transition-colors ${isCompleting ? 'bg-emerald-500 border-emerald-500' : 'border-primary/50 hover:bg-primary/20'}`}
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
            className="absolute left-0 right-0 border-t border-b border-border-custom/10 cursor-pointer hover:bg-primary/5 transition-colors"
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
                // calendar_event and silently completing the task. Re-dragging an already
                // scheduled block preserves its existing duration instead of resetting to 60min.
                await scheduleTodoAt(todo, day, startMin, todo.duration_minutes ?? 60);
                setToastMessage(`Zaplanowano zadanie: "${todo.title}" 📅`);
              } catch (err: unknown) {
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

  // Shared recurrence picker for the quick-create and edit-event modals — presets, an optional
  // "Niestandardowe" day-of-week picker, and an optional end date, all mapped to a Google Calendar RRULE.
  const renderRecurrencePicker = (
    recurrence: '' | 'daily' | 'weekly' | 'monthly' | 'custom',
    setRecurrence: (r: '' | 'daily' | 'weekly' | 'monthly' | 'custom') => void,
    customDays: string[],
    setCustomDays: React.Dispatch<React.SetStateAction<string[]>>,
    endDate: string,
    setEndDate: (d: string) => void,
    minDate: string,
    allowCustom: boolean = true,
    showEndDate: boolean = true,
  ) => (
    <div className="space-y-2">
      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
        <Repeat size={11} /> Powtarzanie
      </label>
      <div className="flex flex-wrap gap-1.5">
        {(allowCustom
          ? (['', 'daily', 'weekly', 'monthly', 'custom'] as const)
          : (['', 'daily', 'weekly', 'monthly'] as const)
        ).map((r) => (
          <button
            key={r || 'none'}
            type="button"
            onClick={() => setRecurrence(r)}
            className={`flex-1 min-w-[70px] text-[10.5px] font-bold py-2 rounded-xl border transition-all ${recurrence === r ? 'bg-primary/10 text-primary border-primary/30 font-black' : 'border-border-custom/60 text-text-muted hover:text-text-primary bg-surface-solid/20'}`}
          >
            {r === '' ? 'Nie powtarza się' : r === 'daily' ? 'Codziennie' : r === 'weekly' ? 'Co tydzień' : r === 'monthly' ? 'Co miesiąc' : 'Niestandardowe'}
          </button>
        ))}
      </div>
      {recurrence === 'custom' && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            { key: 'MO', label: 'Pon' },
            { key: 'TU', label: 'Wt' },
            { key: 'WE', label: 'Śr' },
            { key: 'TH', label: 'Czw' },
            { key: 'FR', label: 'Pt' },
            { key: 'SA', label: 'Sob' },
            { key: 'SU', label: 'Ndz' },
          ].map((day) => {
            const isSelected = customDays.includes(day.key);
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setCustomDays((prev) =>
                  isSelected ? prev.filter((k) => k !== day.key) : [...prev, day.key],
                )}
                className={`w-10 text-[10.5px] font-bold py-1.5 rounded-lg border transition-all ${isSelected ? 'bg-primary/10 text-primary border-primary/30 font-black' : 'border-border-custom/60 text-text-muted hover:text-text-primary bg-surface-solid/20'}`}
              >
                {day.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setCustomDays(['MO', 'TU', 'WE', 'TH', 'FR'])}
            className="text-[10px] font-bold text-primary px-2 py-1.5 hover:underline"
          >
            Dni robocze
          </button>
        </div>
      )}
      {showEndDate && recurrence !== '' && (
        <div className="flex items-center gap-2.5 pt-1">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider shrink-0">Kończy się:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={minDate}
            placeholder="Nigdy"
            className="flex-1 bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-2.5 py-1.5 text-[12px] font-semibold text-text-primary outline-none focus:border-primary/50 transition-all cursor-pointer"
          />
          {endDate && (
            <button
              type="button"
              onClick={() => setEndDate('')}
              className="shrink-0 text-text-muted/50 hover:text-rose-400 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}
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
              const isCompleting = todo.status === 'done' || completedTodoIds.has(todo.id);
              return (
                <div
                  key={todo.id}
                  title={chip?.dreamTitle ? `${todo.title} · ${chip.dreamTitle}` : todo.title}
                  className={`flex items-center gap-1.5 truncate rounded border border-dashed border-primary/40 bg-primary/8 px-1.5 py-0.5 text-[9px] font-bold text-primary transition-colors cursor-pointer hover:bg-primary/15 ${isCompleting ? 'opacity-50' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTodo(todo);
                    setEditingTodoTitle(todo.title);
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleTodo(todo.id);
                      setToastMessage(`Ukończono: "${todo.title}" ✅`);
                    }}
                    className={`relative after:absolute after:-inset-2 h-2.5 w-2.5 shrink-0 rounded-sm border flex items-center justify-center transition-colors ${isCompleting ? 'bg-emerald-500 border-emerald-500' : 'border-primary/50 hover:bg-primary/20'}`}
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
          <div className="text-center flex flex-col items-center">
            <p className="text-[14px] font-bold text-text-primary">{monthLabel(selectedDay)}</p>
            {weather?.daily?.[selectedDay] && (
              <div className="flex items-center gap-1 mt-0.5 text-[10.5px] font-bold text-text-muted cursor-help" title={getWMOWeatherDescription(weather.daily[selectedDay].weatherCode)}>
                {getWMOWeatherIcon(weather.daily[selectedDay].weatherCode, 13)}
                <span>{weather.daily[selectedDay].tempMax}°C / {weather.daily[selectedDay].tempMin}°C</span>
              </div>
            )}
            {selectedDay !== today && (
              <button
                onClick={() => {
                  setSelectedDay(today);
                  setWeekStart(weekMon(today));
                }}
                className="text-[10px] text-primary font-semibold mt-0.5"
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
            {renderTimeGutter(selectedDay)}
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
        <div className="flex border-b border-border-custom/40" style={{ paddingLeft: 44 }}>
          {weekDays.map((day) => {
            const isToday = day === today;
            const dayForecast = weather?.daily?.[day];
            return (
              <div key={day} className="flex-1 text-center py-1.5 flex flex-col items-center justify-center relative group">
                <p className={`text-[10px] font-black uppercase tracking-wider ${isToday ? 'text-primary' : 'text-text-muted/80'}`}>
                  {new Date(day + 'T12:00:00').toLocaleDateString('pl-PL', { weekday: 'short' })}
                </p>
                {dayForecast && (
                  <div className="mt-0.5 flex flex-col items-center gap-0.5 cursor-help" title={`${getWMOWeatherDescription(dayForecast.weatherCode)}: ${dayForecast.tempMax}°C / ${dayForecast.tempMin}°C`}>
                    <div className="flex items-center justify-center transition-transform duration-200 hover:scale-110">
                      {getWMOWeatherIcon(dayForecast.weatherCode, 12)}
                    </div>
                    <span className="text-[7.5px] font-black text-text-muted leading-none">
                      {dayForecast.tempMax}°
                    </span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-center h-8 w-8">
                  {isToday ? (
                    <span className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-[13px] font-black text-white leading-none shadow-sm shadow-primary/20">
                      {parseInt(day.split('-')[2])}
                    </span>
                  ) : (
                    <span className="text-[15px] font-black text-text-primary leading-none">
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
                className={`flex-1 relative border-l border-border-custom/30 ${day === today ? 'bg-primary/[0.02]' : ''}`}
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
                  const isCompleting = todo.status === 'done' || completedTodoIds.has(todo.id);
                  return (
                    <div
                      key={todo.id}
                      className={`flex items-center gap-3 rounded-xl border border-dashed border-primary/30 px-3 py-2.5 transition-all bg-primary/[0.03] ${isCompleting ? 'opacity-50' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation(); // add propagation stop for safety
                          handleToggleTodo(todo.id);
                          setToastMessage(`Ukończono: "${todo.title}" ✅`);
                        }}
                        className={`relative after:absolute after:-inset-2 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${isCompleting ? 'bg-emerald-500 border-emerald-500' : 'border-primary/40 hover:bg-primary/10'}`}
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
            <p className="text-[13px] font-black text-text-primary uppercase tracking-wider">
              {quickType === 'task' ? 'Nowe zadanie' : 'Nowe wydarzenie'}
            </p>
            <button onClick={() => setQuickCreate(null)} className="p-1 text-text-muted hover:text-text-primary transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Type toggle */}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-border-custom/40">
            <button
              type="button"
              onClick={() => setQuickType('event')}
              className={`flex-1 flex items-center justify-center gap-1.5 text-[12px] font-bold py-2 rounded-lg transition-all ${quickType === 'event' ? 'bg-background text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >
              <Calendar size={13} /> Wydarzenie
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickType('task');
                if (quickRecurrence === 'custom') setQuickRecurrence('');
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 text-[12px] font-bold py-2 rounded-lg transition-all ${quickType === 'task' ? 'bg-background text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >
              <ListChecks size={13} /> Zadanie
            </button>
          </div>

          <input
            autoFocus
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleQuickSave(); }}
            placeholder={quickType === 'task' ? 'Tytuł zadania...' : 'Tytuł wydarzenia...'}
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

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
              <AlignLeft size={11} /> Opis
            </label>
            <textarea
              value={quickDescription}
              onChange={(e) => setQuickDescription(e.target.value)}
              placeholder="Dodaj opis..."
              rows={2}
              className="w-full bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-4 py-2.5 text-[12.5px] font-medium text-text-primary outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-text-muted/30 resize-none"
            />
          </div>

          {renderRecurrencePicker(
            quickRecurrence,
            setQuickRecurrence,
            quickCustomDays,
            setQuickCustomDays,
            quickRecurrenceEndDate,
            setQuickRecurrenceEndDate,
            date,
            quickType === 'event',
            quickType === 'event',
          )}

          {/* Category selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Kategoria</label>
            {renderCategoryPicker(quickCategory, setQuickCategory)}
          </div>

          <button
            onClick={handleQuickSave}
            disabled={saving || !quickTitle.trim() || (quickRecurrence === 'custom' && quickCustomDays.length === 0)}
            className="w-full rounded-xl bg-primary text-white py-3.5 text-[13px] font-black shadow-lg shadow-primary/10 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {saving ? 'Dodaję...' : quickType === 'task' ? 'Dodaj zadanie' : 'Dodaj wydarzenie'}
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

          {renderRecurrencePicker(
            editRecurrence,
            setEditRecurrence,
            editCustomDays,
            setEditCustomDays,
            editRecurrenceEndDate,
            setEditRecurrenceEndDate,
            editDate,
          )}

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
              disabled={saving || deleting || !editTitle.trim() || (editRecurrence === 'custom' && editCustomDays.length === 0)}
              className="flex-1 rounded-xl bg-primary text-white py-3 text-[13px] font-black shadow-lg shadow-primary/10 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {saving ? 'Zapisuję...' : 'Zapisz zmiany'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Edit scheduled todo modal ──
  const renderEditTodoModal = () => {
    if (!editingTodo) return null;
    const close = () => setEditingTodo(null);
    const saveTitle = async () => {
      const trimmed = editingTodoTitle.trim();
      if (!trimmed || trimmed === editingTodo.title) return;
      await updateTodoItem(editingTodo.id, { title: trimmed });
      await fetchAllTodos();
    };
    const handleDelete = async () => {
      await deleteTodoItem(editingTodo.id);
      await fetchAllTodos();
      close();
    };
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]" onClick={close}>
        <div
          className="w-full max-w-sm rounded-2xl bg-background border border-border-custom/80 shadow-2xl p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-black text-text-primary uppercase tracking-wider">Edytuj zadanie</p>
            <button onClick={close} className="p-1 text-text-muted hover:text-text-primary transition-colors">
              <X size={18} />
            </button>
          </div>

          <input
            autoFocus
            value={editingTodoTitle}
            onChange={(e) => setEditingTodoTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-full rounded-xl border border-border-custom/60 bg-surface-solid px-3 py-2 text-[13px] font-semibold text-text-primary outline-none focus:border-primary/40"
          />

          {/* Date & time — plain native inputs (the full popup calendar overflowed past the
              viewport bottom inside this centered modal, cutting off the time field). */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Data i Czas</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={editingTodo.due_date || ''}
                onChange={async (e) => {
                  const due_date = e.target.value || null;
                  const scheduled_time = editingTodo.scheduled_time && due_date
                    ? combineDateTimeWarsawISO(due_date, editingTodo.scheduled_time.slice(11, 16))
                    : editingTodo.scheduled_time;
                  setEditingTodo({ ...editingTodo, due_date, scheduled_time });
                  await updateTodoItem(editingTodo.id, { due_date, scheduled_time });
                  await fetchAllTodos();
                }}
                className="bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-2 py-2.5 text-[12px] font-semibold text-text-primary outline-none focus:border-primary/50 transition-all cursor-pointer"
              />
              <input
                type="time"
                value={editingTodo.scheduled_time ? editingTodo.scheduled_time.slice(11, 16) : ''}
                onChange={async (e) => {
                  const timeVal = e.target.value;
                  const scheduled_time = timeVal && editingTodo.due_date
                    ? combineDateTimeWarsawISO(editingTodo.due_date, timeVal)
                    : null;
                  setEditingTodo({ ...editingTodo, scheduled_time });
                  await updateTodoItem(editingTodo.id, { scheduled_time });
                  await fetchAllTodos();
                }}
                className="bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl px-2 py-2.5 text-[12px] font-semibold text-text-primary outline-none focus:border-primary/50 transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Complete Todo Button */}
          <button
            type="button"
            onClick={async () => {
              await handleToggleTodo(editingTodo.id);
              const isDone = !completedTodoIds.has(editingTodo.id);
              setToastMessage(isDone ? `Ukończono: "${editingTodo.title}" ✅` : `Cofnięto ukończenie: "${editingTodo.title}"`);
              close();
            }}
            className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-[12px] font-black uppercase transition-all active:scale-[0.98] ${
              completedTodoIds.has(editingTodo.id)
                ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/15 border border-amber-500/20'
                : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20'
            }`}
          >
            <Check size={14} />
            {completedTodoIds.has(editingTodo.id) ? 'Oznacz jako nieukończone' : 'Oznacz jako ukończone'}
          </button>

          {/* Postpone Section */}
          {!completedTodoIds.has(editingTodo.id) && (
            <div className="rounded-xl border border-border-custom bg-surface-solid/30 p-3.5 space-y-2.5">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Przełóż na jutro
              </label>
              
              <textarea
                placeholder="Dlaczego nie udało się zrobić tego zadania? (opcjonalnie)"
                value={editingTodo.notes || ''}
                onChange={(e) => {
                  setEditingTodo({ ...editingTodo, notes: e.target.value });
                }}
                className="w-full min-h-[60px] rounded-lg border border-border-custom bg-background px-2.5 py-2 text-[11px] font-medium text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40 resize-y"
              />

              <button
                type="button"
                onClick={async () => {
                  const currentDateStr = editingTodo.due_date || today;
                  const tomorrowStr = addDays(currentDateStr, 1);
                  
                  let newScheduledTime = null;
                  if (editingTodo.scheduled_time) {
                    const timePart = editingTodo.scheduled_time.slice(11, 16);
                    newScheduledTime = combineDateTimeWarsawISO(tomorrowStr, timePart);
                  }

                  await updateTodoItem(editingTodo.id, {
                    due_date: tomorrowStr,
                    scheduled_time: newScheduledTime,
                    notes: editingTodo.notes?.trim() || null
                  });
                  await fetchAllTodos();
                  setToastMessage(`Przełożono na jutro: "${editingTodo.title}" ➡️`);
                  close();
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/10 border border-primary/25 py-2 text-[11px] font-black uppercase text-primary hover:bg-primary/15 transition-all active:scale-[0.98]"
              >
                Przełóż na jutro
              </button>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleDelete}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/5 py-2.5 text-[12px] font-black text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 size={13} /> Usuń
            </button>
            <button
              onClick={close}
              className="flex-1 rounded-xl bg-primary text-white py-2.5 text-[13px] font-black shadow-lg shadow-primary/10 hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              Zamknij
            </button>
          </div>
        </div>
      </div>
    );
  };

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
      } catch (err: unknown) {
      console.error('[Background Error]', err);
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
      <div className={`hidden md:flex flex-col ${sidebarCollapsed ? 'w-16' : 'w-80'} border-r border-border-custom/50 bg-background/95 shrink-0 h-full overflow-hidden transition-all duration-300 ease-in-out`}>
        {/* Sidebar Header */}
        <div className={`p-4 border-b border-border-custom/50 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleSidebar} 
              className="w-6.5 h-6.5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-[12px] font-black shadow-sm shrink-0 cursor-pointer hover:bg-primary/20 active:scale-95 transition-all"
              title={sidebarCollapsed ? "Rozwiń panel" : "Zwiń panel"}
            >
              <Zap size={14} className="fill-primary text-primary" />
            </button>
            {!sidebarCollapsed && (
              <span className="text-[13px] font-black tracking-wider uppercase text-text-primary">Vanguard OS</span>
            )}
          </div>
          {!sidebarCollapsed && (
            <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] text-text-muted hover:text-text-primary transition-all cursor-pointer" title="Wróć do pulpitu">
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        {/* Quick View Switcher */}
        <div className={`px-2 py-3 border-b border-border-custom/25 bg-slate-500/5 dark:bg-white/[0.01] flex ${sidebarCollapsed ? 'flex-col items-center' : 'flex-row'} gap-1.5 shrink-0`}>
          <button
            className={`flex-1 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-black bg-primary/10 text-primary border border-primary/15 ${sidebarCollapsed ? 'p-2' : ''}`}
            title="Kalendarz"
          >
            <Calendar size={13} className="shrink-0" />
            {!sidebarCollapsed && <span>Kalendarz</span>}
          </button>
          <button
            onClick={() => onNavigateTo?.('todo')}
            className={`flex-1 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold text-text-muted hover:text-text-primary hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all border border-transparent cursor-pointer ${sidebarCollapsed ? 'p-2' : ''}`}
            title="Zadania"
          >
            <List size={13} className="shrink-0" />
            {!sidebarCollapsed && <span>Zadania</span>}
          </button>
          <button
            onClick={() => onNavigateTo?.('keep')}
            className={`flex-1 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold text-text-muted hover:text-text-primary hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all border border-transparent cursor-pointer ${sidebarCollapsed ? 'p-2' : ''}`}
            title="Notatki"
          >
            <StickyNote size={13} className="shrink-0" />
            {!sidebarCollapsed && <span>Notatki</span>}
          </button>
        </div>

        {/* Sidebar Scrollable Body */}
        {!sidebarCollapsed && (
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
                className="w-full relative flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-600 hover:from-primary/95 hover:to-violet-600/95 text-white py-2.5 text-[12px] font-black shadow-md hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96] transition-all duration-200 disabled:opacity-50 cursor-pointer"
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
            <div className="bg-emerald-500/5 dark:bg-emerald-500/[0.02] border border-emerald-500/15 rounded-2xl p-4 space-y-4 shadow-sm">
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
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 hover:scale-[1.015] active:scale-[0.985] text-emerald-500 py-2.5 text-[11px] font-black shadow-md transition-all disabled:opacity-40 cursor-pointer"
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
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 hover:bg-primary/20 hover:scale-[1.015] active:scale-[0.985] text-primary py-2.5 text-[11px] font-black shadow-md transition-all disabled:opacity-40 cursor-pointer"
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
        )}
      </div>


      {/* RIGHT MAIN VIEW */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-custom/60 bg-background/90 px-4 py-3 backdrop-blur-xl shrink-0">
          <button onClick={onBack} className="p-1.5 text-primary md:hidden">
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-[18px] font-black text-text-primary flex-1">Kalendarz</h1>
          {renderWeatherWidget()}

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

      {/* Edit scheduled todo modal */}
      {renderEditTodoModal()}

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
