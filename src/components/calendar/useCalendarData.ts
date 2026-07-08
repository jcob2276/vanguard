import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from '../../store/useStore';
import {
  useCalendarEvents,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  calendarKeys,
  type CalendarEvent,
} from '../../lib/calendarApi';
import {
  todayStr,
  weekMon,
  addDays,
  parseTime,
  getWarsawOffset,
  dateOfISO,
  nowMinutes,
  HOUR_START,
  HOUR_END,
  PX_PER_MIN,
  CalRow,
} from './calendarHelpers';


import { CalendarTodo } from '../../hooks/useCalendarTodos';

interface QuickCreateState {
  date: string;
  startMin: number;
}

export function useCalendarData(userId: string | undefined, accessToken: string | undefined) {
  const queryClient = useQueryClient();
  const today = todayStr();
  const [calView, setCalView] = useState<'dzien' | 'tydzien' | 'agenda'>('dzien');
  const [selectedDay, setSelectedDay] = useState(today);
  const [weekStart, setWeekStart] = useState(() => weekMon(today));

  // Visible date range
  const visibleRange = useMemo(() => {
    if (calView === 'dzien' || calView === 'tydzien') {
      return { rangeStart: addDays(weekStart, -7), rangeEnd: addDays(weekStart, 7) };
    }
    return { rangeStart: addDays(today, -7), rangeEnd: addDays(today, 14) };
  }, [calView, weekStart, today]);

  // Query events using our react-query DAL
  const { data: rawEvents = [], isLoading: loading } = useCalendarEvents(
    userId || '',
    visibleRange.rangeStart,
    visibleRange.rangeEnd
  );

  // Cast events to CalRow[] safely
  const events = useMemo(() => rawEvents as CalRow[], [rawEvents]);

  // Mutations
  const createEventMutation = useCreateCalendarEvent();
  const updateEventMutation = useUpdateCalendarEvent();
  const deleteEventMutation = useDeleteCalendarEvent();

  // Component states
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

  const [editingTodo, setEditingTodo] = useState<CalendarTodo | null>(null);
  const [editingTodoTitle, setEditingTodoTitle] = useState('');

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

  const [budgetPanelExpanded, setBudgetPanelExpanded] = useState(false);
  const [showBudgetConfig, setShowBudgetConfig] = useState(false);
  const [budgetMinInputs, setBudgetMinInputs] = useState<Record<string, string>>({});
  const [budgetMaxInputs, setBudgetMaxInputs] = useState<Record<string, string>>({});

  const [focusTimeDefense, setFocusTimeDefense] = useState(true);
  const [decompressionBuffer, setDecompressionBuffer] = useState(true);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('vanguard_calendar_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('vanguard_calendar_sidebar_collapsed', String(next));
      } catch (err) {
        console.error('[Background Error]', err);
      }
      return next;
    });
  };

  const { userSettings, fetchUserSettings } = useStore();

  useEffect(() => {
    if (!userSettings) {
      fetchUserSettings();
    }
  }, [userSettings, fetchUserSettings]);

  // Weather States
  const [weather, setWeather] = useState<any>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    const lat = userSettings?.home_lat ?? 49.6950;
    const lng = userSettings?.home_lng ?? 21.7225;
    const start = visibleRange.rangeStart;
    const end = visibleRange.rangeEnd;
    const apiKey = import.meta.env.VITE_OPENWEATHERMAP_API_KEY;

    let isMounted = true;

    async function fetchWeather() {
      try {
        let currentData = null;
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
                windSpeed: Math.round(owmData.wind.speed * 3.6),
                description: owmData.weather[0]?.description || '',
                iconCode: owmData.weather[0]?.icon || '',
                name: getCityName(lat, lng),
                isOWM: true,
              };
            }
          } catch (err) {
            console.error('[Background Error]', err);
          }
        }

        const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&start_date=${start}&end_date=${end}&daily=weather_code,temperature_2m_max,temperature_2m_min&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&timezone=Europe/Warsaw`;
        const res = await fetch(openMeteoUrl);
        if (!res.ok) throw new Error('Failed to fetch Open-Meteo');
        const data = await res.json();

        const todayDate = today;
        const tomorrowDate = addDays(today, 1);
        const hourlyUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&start_date=${todayDate}&end_date=${tomorrowDate}&hourly=temperature_2m,weather_code,precipitation_probability&timezone=Europe/Warsaw`;
        const hourlyRes = await fetch(hourlyUrl);
        let hourlyData: Record<string, any[]> = {};
        if (hourlyRes.ok) {
          const hd = await hourlyRes.json();
          if (hd.hourly && hd.hourly.time) {
            for (let i = 0; i < hd.hourly.time.length; i++) {
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
          if (!currentData && data.current) {
            currentData = {
              temp: Math.round(data.current.temperature_2m),
              feelsLike: Math.round(data.current.apparent_temperature),
              humidity: data.current.relative_humidity_2m,
              windSpeed: Math.round(data.current.wind_speed_10m),
              description: getWMOWeatherDescription(data.current.weather_code),
              iconCode: String(data.current.weather_code) + (data.current.is_day ? 'd' : 'n'),
              name: getCityName(lat, lng),
              isOWM: false,
            };
          }

          const daily: Record<string, any> = {};
          if (data.daily && data.daily.time) {
            for (let i = 0; i < data.daily.time.length; i++) {
              const dStr = data.daily.time[i];
              daily[dStr] = {
                date: dStr,
                weatherCode: data.daily.weather_code[i],
                tempMax: Math.round(data.daily.temperature_2m_max[i]),
                tempMin: Math.round(data.daily.temperature_2m_min[i]),
              };
            }
          }

          setWeather({
            current: currentData,
            daily,
            hourly: hourlyData,
            error: false,
          });
          setWeatherLoading(false);
        }
      } catch (err) {
        console.error('Error fetching weather:', err);
        if (isMounted) {
          setWeather({
            current: null,
            daily: {},
            hourly: {},
            error: true,
          });
          setWeatherLoading(false);
        }
      }
    }

    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [userSettings?.home_lat, userSettings?.home_lng, visibleRange.rangeStart, visibleRange.rangeEnd]);

  const getCityName = (lat: number, lng: number) => {
    if (Math.abs(lat - 49.6950) < 0.005 && Math.abs(lng - 21.7225) < 0.005) return 'Świerzowa Polska';
    if (Math.abs(lat - 49.68886) < 0.05 && Math.abs(lng - 21.76466) < 0.05) return 'Krosno';
    if (Math.abs(lat - 52.2297) < 0.05 && Math.abs(lng - 21.0122) < 0.05) return 'Warszawa';
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

  const [nowMin, setNowMin] = useState(() => nowMinutes());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMin(nowMinutes());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchEvents = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: calendarKeys.events(userId || '', visibleRange.rangeStart, visibleRange.rangeEnd),
    });
  }, [queryClient, userId, visibleRange]);

  // Dragging event sourcing handler
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
      const diffMins = Math.round((diffY / PX_PER_MIN) / 15) * 15;

      if (diffMins === lastDiffMins) return;
      lastDiffMins = diffMins;

      // Temporary local update for snappy UI feel
      queryClient.setQueryData(
        calendarKeys.events(userId || '', visibleRange.rangeStart, visibleRange.rangeEnd),
        (old: any) => {
          return (old || []).map((item: any) => {
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
          });
        }
      );
    };

    const handleMouseUp = async (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

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

      const evId = ev.event_id || ev.id;
      try {
        await updateEventMutation.mutateAsync({
          userId: userId || '',
          accessToken: accessToken || '',
          event: {
            id: evId,
            summary: ev.summary || '',
            start: startISO,
            end: endISO,
            category: ev.category || undefined,
          },
        });
        setToastMessage('Zaktualizowano czas wydarzenia! 🕒');
      } catch (err) {
        console.error('Failed to save drag/resize changes:', err);
        setToastMessage('Nie udało się zapisać zmian.');
        // Revert cache to original values on failure
        queryClient.invalidateQueries({
          queryKey: calendarKeys.events(userId || '', visibleRange.rangeStart, visibleRange.rangeEnd),
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleEventClick = (ev: CalRow) => {
    setSelectedEvent(ev);
    setEditTitle(ev.summary || '');
    setEditCategory(ev.category || null);
    if (ev.start_time) {
      setEditStart(formatTimeOfISO(ev.start_time));
      setEditDate(dateOfISO(ev.start_time));
    }
    if (ev.end_time) {
      setEditEnd(formatTimeOfISO(ev.end_time));
    }
  };

  const formatTimeOfISO = (iso: string) => {
    const parts = iso.split('T')[1]?.split(':');
    if (!parts || parts.length < 2) return '12:00';
    return `${parts[0]}:${parts[1]}`;
  };

  const executeDelete = async () => {
    if (!selectedEvent) return;
    setDeleting(true);
    const evId = selectedEvent.event_id || selectedEvent.id;
    try {
      await deleteEventMutation.mutateAsync({
        userId: userId || '',
        accessToken: accessToken || '',
        eventId: evId,
      });
      setSelectedEvent(null);
      setShowDeleteConfirm(false);
      setToastMessage('Wydarzenie zostało usunięte. 🗑️');
    } catch (err) {
      console.error('delete event error:', err);
      setToastMessage('Nie udało się usunąć wydarzenia.');
    } finally {
      setDeleting(false);
    }
  };

  const handleEditDelete = () => {
    if (!selectedEvent) return;
    setShowDeleteConfirm(true);
  };

  return {
    calView, setCalView,
    selectedDay, setSelectedDay,
    weekStart, setWeekStart,
    visibleRange,
    events,
    loading,
    quickCreate, setQuickCreate,
    quickTitle, setQuickTitle,
    quickDuration, setQuickDuration,
    quickCategory, setQuickCategory,
    quickType, setQuickType,
    quickDescription, setQuickDescription,
    quickRecurrence, setQuickRecurrence,
    quickCustomDays, setQuickCustomDays,
    quickRecurrenceEndDate, setQuickRecurrenceEndDate,
    saving, setSaving,
    editingTodo, setEditingTodo,
    editingTodoTitle, setEditingTodoTitle,
    selectedEvent, setSelectedEvent,
    editTitle, setEditTitle,
    editCategory, setEditCategory,
    editStart, setEditStart,
    editEnd, setEditEnd,
    editDate, setEditDate,
    editRecurrence, setEditRecurrence,
    editCustomDays, setEditCustomDays,
    editRecurrenceEndDate, setEditRecurrenceEndDate,
    deleting, setDeleting,
    budgetPanelExpanded, setBudgetPanelExpanded,
    showBudgetConfig, setShowBudgetConfig,
    budgetMinInputs, setBudgetMinInputs,
    budgetMaxInputs, setBudgetMaxInputs,
    focusTimeDefense, setFocusTimeDefense,
    decompressionBuffer, setDecompressionBuffer,
    showDeleteConfirm, setShowDeleteConfirm,
    toastMessage, setToastMessage,
    sidebarCollapsed, setSidebarCollapsed,
    toggleSidebar,
    weather, weatherLoading,
    nowMin,
    fetchEvents,
    handleEventMouseDown,
    handleEventClick,
    executeDelete,
    handleEditDelete,
    createEventMutation,
    updateEventMutation,
    deleteEventMutation,
  };
}
