import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useUserSettings } from '../../../hooks/useUserSettings';
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
import { parseRecurrenceRule } from '../calendarView/calendarViewHelpers';

import { useLifeObligations } from '../../../lib/lifeObligationsApi';
import { deriveAll } from '../../terminy/terminyDerived';

export interface QuickCreateState {
  date: string;
  startMin: number;
}

export function useCalendarData(userId: string | undefined, accessToken: string | undefined) {
  const queryClient = useQueryClient();
  const today = todayStr();
  const [calView, setCalView] = useState<'dzien' | '3dni' | 'tydzien' | 'miesiac'>('tydzien');
  const [selectedDay, setSelectedDay] = useState(today);
  const [weekStart, setWeekStart] = useState(() => weekMon(today));

  // Visible date range
  const visibleRange = useMemo(() => {
    if (calView === 'dzien') {
      return { rangeStart: addDays(selectedDay, -1), rangeEnd: addDays(selectedDay, 1) };
    }
    if (calView === '3dni') {
      return { rangeStart: addDays(selectedDay, -1), rangeEnd: addDays(selectedDay, 4) };
    }
    if (calView === 'tydzien') {
      return { rangeStart: addDays(weekStart, -7), rangeEnd: addDays(weekStart, 14) };
    }
    return { rangeStart: addDays(selectedDay, -15), rangeEnd: addDays(selectedDay, 45) };
  }, [calView, weekStart, selectedDay]);

  // Query events using our react-query DAL
  const { data: rawEvents = [], isLoading: loading } = useCalendarEvents(
    userId || '',
    visibleRange.rangeStart,
    visibleRange.rangeEnd
  );

  // Query Terminy (Life Obligations) and project them onto the Calendar
  const { data: obligations = [] } = useLifeObligations(userId);

  const obligationEvents = useMemo(() => {
    if (!obligations.length) return [];
    const derived = deriveAll(obligations, today);
    const result: CalRow[] = [];

    for (const d of derived) {
      const item = d.item;
      const date = d.nextDate;
      if (!date) continue;

      let prefix = '📌';
      let category = 'finanse';
      if (item.kind === 'people') {
        prefix = '🎈';
        category = 'relacje_rodzina';
      } else if (item.kind === 'vehicle') {
        prefix = '🚗';
        category = 'praca';
      } else if (item.kind === 'document') {
        prefix = '📄';
        category = 'finanse';
      }

      result.push({
        id: `obligation-${item.id}-${date}`,
        event_id: `obligation-${item.id}`,
        summary: `${prefix} ${item.title}${item.related_name ? ` (${item.related_name})` : ''}`,
        start_time: `${date}T09:00:00+02:00`,
        end_time: `${date}T10:00:00+02:00`,
        is_all_day: true,
        category,
        description: item.notes || `Ważny termin z zakładki Terminy (${item.title})`,
      });
    }

    return result;
  }, [obligations, today]);

  // Cast events to CalRow[] safely and merge obligation events
  const events = useMemo(() => {
    const raw = rawEvents as CalRow[];
    return [...raw, ...obligationEvents];
  }, [rawEvents, obligationEvents]);
  const [searchQuery, setSearchQuery] = useState('');
  const [disabledCategories, setDisabledCategories] = useState<Set<string>>(() => new Set());

  const toggleCategory = useCallback((cat: string) => {
    setDisabledCategories((prev) => {
      const next = new Set(prev);
      const key = cat.toLowerCase();
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const displayEvents = useMemo(() => {
    let result = events;
    if (disabledCategories.size > 0) {
      result = result.filter((event) => {
        const cat = (event.category || 'uncategorized').toLowerCase();
        return !disabledCategories.has(cat);
      });
    }
    const query = searchQuery.trim().toLocaleLowerCase('pl-PL');
    if (!query) return result;
    return result.filter((event) =>
      [event.summary, event.category, event.description, event.location]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('pl-PL').includes(query))
    );
  }, [events, searchQuery, disabledCategories]);

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
  const [quickLocation, setQuickLocation] = useState('');
  const [quickAllDay, setQuickAllDay] = useState(false);
  const [quickReminder, setQuickReminder] = useState<number | null>(null);
  const [quickRecurrence, setQuickRecurrence] = useState<'' | 'daily' | 'weekly' | 'monthly' | 'custom'>('');
  const [quickCustomDays, setQuickCustomDays] = useState<string[]>([]);
  const [quickRecurrenceEndDate, setQuickRecurrenceEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const closeQuickCreate = useCallback(() => {
    setQuickCreate(null);
    setQuickTitle('');
    setQuickDuration(60);
    setQuickCategory(null);
    setQuickType('event');
    setQuickDescription('');
    setQuickLocation('');
    setQuickAllDay(false);
    setQuickReminder(null);
    setQuickRecurrence('');
    setQuickCustomDays([]);
    setQuickRecurrenceEndDate('');
  }, []);

  const [editingTodo, setEditingTodo] = useState<CalendarTodo | null>(null);
  const [editingTodoTitle, setEditingTodoTitle] = useState('');

  const [selectedEvent, setSelectedEvent] = useState<CalRow | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editAllDay, setEditAllDay] = useState(false);
  const [editReminder, setEditReminder] = useState<number | null>(null);
  const [editRecurrence, setEditRecurrence] = useState<'' | 'daily' | 'weekly' | 'monthly' | 'custom'>('');
  const [editCustomDays, setEditCustomDays] = useState<string[]>([]);
  const [editRecurrenceEndDate, setEditRecurrenceEndDate] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [budgetPanelExpanded, setBudgetPanelExpanded] = useState(false);
  const [showBudgetConfig, setShowBudgetConfig] = useState(false);
  const [budgetMinInputs, setBudgetMinInputs] = useState<Record<string, string>>({});
  const [budgetMaxInputs, setBudgetMaxInputs] = useState<Record<string, string>>({});
  const [frameDaysInputs, setFrameDaysInputs] = useState<Record<string, number[]>>({});
  const [frameStartInputs, setFrameStartInputs] = useState<Record<string, string>>({});
  const [frameEndInputs, setFrameEndInputs] = useState<Record<string, string>>({});
  const [frameStrengthInputs, setFrameStrengthInputs] = useState<Record<string, 'prefer' | 'only'>>({});

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

  const { data: userSettings } = useUserSettings(userId);

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

  // Real-time updates subscription to keep calendar in sync instantly with database triggers/background sync
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('calendar-realtime-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vanguard_calendar',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchEvents();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, fetchEvents]);

  const formatTimeOfISO = (iso: string) => {
    const parts = iso.split('T')[1]?.split(':');
    if (!parts || parts.length < 2) return '12:00';
    return `${parts[0]}:${parts[1]}`;
  };

  const [viewingEvent, setViewingEvent] = useState<CalRow | null>(null);

  const openEditFromPreview = (ev: CalRow) => {
    setViewingEvent(null);
    setSelectedEvent(ev);
    setEditTitle(ev.summary || '');
    setEditCategory(ev.category || null);
    setEditDescription(ev.description || '');
    setEditLocation(ev.location || '');
    setEditAllDay(!!ev.is_all_day);
    setEditReminder(ev.reminder_minutes ?? null);
    const recurrenceState = parseRecurrenceRule(ev.recurrence);
    setEditRecurrence(recurrenceState.recurrence);
    setEditCustomDays(recurrenceState.customDays);
    setEditRecurrenceEndDate(recurrenceState.endDate);
    if (ev.start_time) {
      setEditStart(formatTimeOfISO(ev.start_time));
      setEditDate(dateOfISO(ev.start_time));
    }
    if (ev.end_time) {
      setEditEnd(formatTimeOfISO(ev.end_time));
    }
  };

  const handleEventClick = (ev: CalRow) => {
    setViewingEvent(ev);
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
    const seriesBaseId = selectedEvent.series_id || recurringSeriesBaseId(instanceId);
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
    events, displayEvents,
    searchQuery, setSearchQuery,
    disabledCategories, toggleCategory,
    loading,
    quickCreate, setQuickCreate, closeQuickCreate,
    quickTitle, setQuickTitle,
    quickDuration, setQuickDuration,
    quickCategory, setQuickCategory,
    quickType, setQuickType,
    quickDescription, setQuickDescription,
    quickLocation, setQuickLocation,
    quickAllDay, setQuickAllDay,
    quickReminder, setQuickReminder,
    quickRecurrence, setQuickRecurrence,
    quickCustomDays, setQuickCustomDays,
    quickRecurrenceEndDate, setQuickRecurrenceEndDate,
    saving, setSaving,
    editingTodo, setEditingTodo,
    editingTodoTitle, setEditingTodoTitle,
    viewingEvent, setViewingEvent, openEditFromPreview,
    selectedEvent, setSelectedEvent,
    editTitle, setEditTitle,
    editCategory, setEditCategory,
    editStart, setEditStart,
    editEnd, setEditEnd,
    editDate, setEditDate,
    editDescription, setEditDescription,
    editLocation, setEditLocation,
    editAllDay, setEditAllDay,
    editReminder, setEditReminder,
    editRecurrence, setEditRecurrence,
    editCustomDays, setEditCustomDays,
    editRecurrenceEndDate, setEditRecurrenceEndDate,
    deleting, setDeleting,
    budgetPanelExpanded, setBudgetPanelExpanded,
    showBudgetConfig, setShowBudgetConfig,
    budgetMinInputs, setBudgetMinInputs,
    budgetMaxInputs, setBudgetMaxInputs,
    frameDaysInputs, setFrameDaysInputs,
    frameStartInputs, setFrameStartInputs,
    frameEndInputs, setFrameEndInputs,
    frameStrengthInputs, setFrameStrengthInputs,
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
