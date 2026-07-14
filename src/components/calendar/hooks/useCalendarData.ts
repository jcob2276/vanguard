import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from '../../../store/useStore';
import {
  useCalendarEvents,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
} from '../../../lib/calendarApi';
import { calendarKeys } from '../../../lib/queryKeys';
import { STORAGE_KEYS } from '../../../lib/constants';
import {
  todayStr,
  weekMon,
  addDays,
  dateOfISO,
  nowMinutes,
  recurringSeriesBaseId,
  CalRow,
} from '../calendarHelpers';

import { CalendarTodo } from './useCalendarTodos';
import { useCalendarWeather } from './useCalendarWeather';
import { useCalendarEventDrag } from './useCalendarEventDrag';

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

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.CALENDAR_SIDEBAR_COLLAPSED) === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.CALENDAR_SIDEBAR_COLLAPSED, String(next));
      } catch (err) {
        console.warn('[Calendar] Failed to save sidebar collapsed state to localStorage:', err);
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

  const { weather, weatherLoading } = useCalendarWeather({
    today,
    homeLat: userSettings?.home_lat,
    homeLng: userSettings?.home_lng,
    rangeStart: visibleRange.rangeStart,
    rangeEnd: visibleRange.rangeEnd,
  });

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

  const formatTimeOfISO = (iso: string) => {
    const parts = iso.split('T')[1]?.split(':');
    if (!parts || parts.length < 2) return '12:00';
    return `${parts[0]}:${parts[1]}`;
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

  const { handleEventMouseDown } = useCalendarEventDrag({
    userId,
    accessToken,
    queryClient,
    visibleRange,
    updateEventMutation,
    onEventClick: handleEventClick,
    setToastMessage,
  });

  const executeDelete = async (scope: 'this' | 'all' = 'this') => {
    if (!selectedEvent) return;
    setDeleting(true);
    const instanceId = selectedEvent.event_id || selectedEvent.id;
    const seriesBaseId = recurringSeriesBaseId(instanceId);
    const evId = scope === 'all' && seriesBaseId ? seriesBaseId : instanceId;
    try {
      await deleteEventMutation.mutateAsync({
        userId: userId || '',
        accessToken: accessToken || '',
        eventId: evId,
        deleteScope: scope,
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
