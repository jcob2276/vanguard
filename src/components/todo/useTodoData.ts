import { useMemo, useState } from 'react';
import { useUserId } from '../../store/useStore';
import { getTodayWarsaw } from '../../lib/date';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import type { Database } from '../../lib/database.types';
import { useTodoDragDrop } from './hooks/useTodoDragDrop';
import { useTodoSmartLists } from './hooks/useTodoSmartLists';
import { useTodoQuickCapture } from './hooks/useTodoQuickCapture';
import { useTodoDerivedViews } from './hooks/useTodoDerivedViews';
import { useTodoActions } from './hooks/useTodoActions';
import { useTodoQueries } from './hooks/useTodoQueries';
import { useTodoLifecycleEffects } from './hooks/useTodoLifecycleEffects';
import { useTodoUiState } from './hooks/useTodoUiState';
import { useTodoRunHelpers } from './hooks/useTodoRunHelpers';

export type TodoItemRow = Database['public']['Tables']['todo_items']['Row'];
export type TodoSectionRow = Database['public']['Tables']['todo_sections']['Row'];

export function useTodoData() {
  const userId = useUserId() as string;
  const push = usePushNotifications(userId);
  const [pushSubscribed, setPushSubscribed] = useState<boolean | null>(null);

  const today = getTodayWarsaw();

  const {
    queryClient,
    sections, sectionsLoading,
    items, itemsLoading,
    projects, dreams, smartLists, dailyWins,
    setItems, setSmartLists, fetchAll,
  } = useTodoQueries(userId, today);

  const loading = sectionsLoading || itemsLoading;

  const {
    busy, setBusy,
    error, setError,
    showDone, setShowDone,
    expandedId, setExpandedId,
    editingId, setEditingId,
    editingTitle, setEditingTitle,
    activeFilterSection, setActiveFilterSection,
    contextMenu, setContextMenu,
    collapsedSections, setCollapsedSections,
    toggleExpand, toggleSectionCollapse,
    showContextMenu,
  } = useTodoUiState();

  const linkedPlanIds = useMemo(() => {
    const winTasks = (dailyWins as { daily_win_tasks?: { todo_id: string | null }[] } | null)?.daily_win_tasks || [];
    return new Set<string>(winTasks.map((t) => t.todo_id).filter((id): id is string => Boolean(id)));
  }, [dailyWins]);

  const { run, classifyInBackground } = useTodoRunHelpers({ userId, setBusy, setError, fetchAll });

  // Delegated hooks
  const {
    searchQuery,
    setSearchQuery,
    activeSmartListId,
    setActiveSmartListId,
    activeSmartQuery,
    saveCurrentAsSmartList,
    removeSmartList,
  } = useTodoSmartLists({
    userId,
    smartLists,
    setSmartLists,
    run,
    setError,
  });

  const {
    form,
    setForm,
    isExpanded,
    setIsExpanded,
    quickCaptureRef,
    parsedInput,
    addItem,
  } = useTodoQuickCapture({
    userId,
    activeFilterSection,
    setItems,
    setError,
    classifyInBackground,
  });

  const {
    draggingItem,
    dragTarget,
    dragPosRef,
    todayZoneRef,
    inboxZoneRef,
    sectionRefs,
    handleDragStart,
  } = useTodoDragDrop({
    sections,
    collapsedSections,
    setCollapsedSections,
    setBusy,
    setError,
    fetchAll,
  });

  useTodoLifecycleEffects({
    userId, queryClient, push, setPushSubscribed, setExpandedId, setContextMenu,
  });

  // ── Derived views (pure — see hooks/useTodoDerivedViews.ts) ──
  const {
    sectionById, sectionGoalMap, sectionDreamMap,
    doneItems, getChildren,
    todayItems, inboxItems, upcomingItems, sectionsWithItems,
  } = useTodoDerivedViews({
    items, sections, projects, dreams, today, activeFilterSection, activeSmartQuery,
  });

  // ── Actions (see hooks/useTodoActions.ts) ──
  const {
    batchClassifying, batchClassify, addChildTask, saveEditTitle, handleComplete,
  } = useTodoActions({
    userId, today, items, setItems, setError, run, fetchAll,
    editingTitle, setEditingId, setEditingTitle,
  });

  return {
    userId,
    push,
    pushSubscribed, setPushSubscribed,
    sections,
    items, setItems,
    loading,
    busy, error, setError,
    showDone, setShowDone,
    expandedId, setExpandedId,
    editingId, setEditingId,
    editingTitle, setEditingTitle,
    linkedPlanIds,
    activeFilterSection, setActiveFilterSection,
    collapsedSections,
    toggleExpand,
    form, setForm,
    contextMenu, setContextMenu,
    isExpanded, setIsExpanded,
    batchClassifying,
    quickCaptureRef,
    draggingItem,
    dragTarget,
    dragPosRef,
    todayZoneRef,
    inboxZoneRef,
    sectionRefs,
    toggleSectionCollapse,
    today,
    fetchAll,
    sectionById,
    sectionGoalMap,
    sectionDreamMap,
    parsedInput,
    doneItems,
    todayItems,
    inboxItems,
    upcomingItems,
    sectionsWithItems,
    run,
    classifyInBackground,
    batchClassify,
    addItem,
    saveEditTitle,
    handleDragStart,
    showContextMenu,
    handleComplete,
    getChildren,
    addChildTask,
    smartLists,
    searchQuery, setSearchQuery,
    activeSmartListId, setActiveSmartListId,
    saveCurrentAsSmartList,
    removeSmartList,
    activeSmartQuery,
  };
}
