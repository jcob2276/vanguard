import { useCallback } from 'react';
import { useTodoContext } from './context/TodoContext';
import TodoCard from './TodoCard';
import { supabase } from '../../lib/supabase';
import { updateTodoItem, setTodoStatus } from '../../lib/todo/todo';
import { applyOptimisticPatch } from './todoOptimistic';
import type { Database } from '../../lib/database.types';

type TodoItemRow = Database['public']['Tables']['todo_items']['Row'];

interface TodoCardConnectedProps {
  item: TodoItemRow;
  inToday?: boolean;
  hideSectionChip?: boolean;
}

function useTodoCardHandlers(item: TodoItemRow) {
  const {
    today,
    setItems,
    setError,
  } = useTodoContext();

  const onSetPriority = useCallback((pid: string) => {
    if (pid === item.priority) return;
    applyOptimisticPatch(setItems, item, { priority: pid }, () => updateTodoItem(item.id, { priority: pid }), setError);
  }, [item, setItems, setError]);

  const onMoveSection = useCallback((sId: string | null) => {
    if (sId === item.section_id) return;
    applyOptimisticPatch(setItems, item, { section_id: sId }, () => updateTodoItem(item.id, { section_id: sId }), setError);
  }, [item, setItems, setError]);

  const onMoveToToday = useCallback(() => {
    const patch = { due_date: today, ai_bucket: 'today', ai_classified_at: new Date().toISOString() };
    applyOptimisticPatch(setItems, item, patch, () => updateTodoItem(item.id, patch), setError);
  }, [item, today, setItems, setError]);

  const onSetDueDate = useCallback((date: string | null) => {
    const patch = { due_date: date, ai_bucket: null };
    applyOptimisticPatch(setItems, item, patch, () => updateTodoItem(item.id, patch as Partial<TodoItemRow>), setError);
  }, [item, setItems, setError]);

  const onSetRecurrence = useCallback((r: string | null) => {
    const patch = { recurrence: r || null };
    applyOptimisticPatch(setItems, item, patch, () => updateTodoItem(item.id, { recurrence: r || undefined }), setError);
  }, [item, setItems, setError]);

  const onSetReminder = useCallback((isoDatetime: string) => {
    const patch = { reminder_at: isoDatetime, reminder_sent: false };
    applyOptimisticPatch(setItems, item, patch, () => updateTodoItem(item.id, patch as Partial<TodoItemRow>), setError);
  }, [item, setItems, setError]);

  const onSetTags = useCallback((tags: string[]) => {
    applyOptimisticPatch(setItems, item, { tags }, () => updateTodoItem(item.id, { tags } as Partial<TodoItemRow>), setError);
  }, [item, setItems, setError]);

  const onSetSphere = useCallback((sphere: string | null) => {
    applyOptimisticPatch(setItems, item, { category: sphere }, () => updateTodoItem(item.id, { category: sphere } as Partial<TodoItemRow>), setError);
  }, [item, setItems, setError]);

  const onSetTitle = useCallback((newTitle: string) => {
    applyOptimisticPatch(setItems, item, { title: newTitle }, () => updateTodoItem(item.id, { title: newTitle } as Partial<TodoItemRow>), setError);
  }, [item, setItems, setError]);

  const onSetNotes = useCallback((newNotes: string | null) => {
    const patch = { notes: newNotes };
    applyOptimisticPatch(setItems, item, patch, () => updateTodoItem(item.id, { notes: newNotes || null } as Partial<TodoItemRow>), setError);
  }, [item, setItems, setError]);

  return {
    onSetPriority,
    onMoveSection,
    onMoveToToday,
    onSetDueDate,
    onSetRecurrence,
    onSetReminder,
    onSetTags,
    onSetSphere,
    onSetTitle,
    onSetNotes,
  };
}

export default function TodoCardConnected({
  item,
  inToday = false,
  hideSectionChip = false,
}: TodoCardConnectedProps) {
  const {
    today,
    userId,
    expandedId,
    toggleExpand,
    linkedPlanIds,
    sections,
    editingId,
    editingTitle,
    setEditingId,
    setEditingTitle,
    saveEditTitle,
    sectionById,
    sectionGoalMap,
    sectionDreamMap,
    handleDragStart,
    draggingItem,
    showContextMenu,
    handleComplete,
    getChildren,
    addChildTask,
    setItems,
    setError,
  } = useTodoContext();

  const handlers = useTodoCardHandlers(item);

  const onDrop = useCallback(() => {
    applyOptimisticPatch(setItems, item, { status: 'dropped' }, () => setTodoStatus(item, 'dropped'), setError);
  }, [item, setItems, setError]);

  const onCancelReminder = useCallback(() => {
    const patch = { reminder_at: null, reminder_sent: false };
    applyOptimisticPatch(setItems, item, patch, () => updateTodoItem(item.id, patch as Partial<TodoItemRow>), setError);
  }, [item, setItems, setError]);

  const onAiBreakdown = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke(
      'vanguard-oracle?action=task-breakdown',
      {
        body: { itemId: item.id, userId, title: item.title, notes: item.notes },
      }
    );
    if (error) throw error;
    return (data?.subtasks as string[]) ?? [];
  }, [item, userId]);

  const onAddChildTask = useCallback((title: string) => addChildTask(item, title), [item, addChildTask]);

  return (
    <TodoCard
      key={item.id}
      item={item}
      busy={false}
      today={today}
      expanded={expandedId === item.id}
      onToggleExpand={toggleExpand}
      onToggle={() => handleComplete(item)}
      isLinkedToPlan={linkedPlanIds.has(item.id)}
      sections={sections}
      isEditing={editingId === item.id}
      editingTitle={editingTitle}
      onEditStart={(t: string) => {
        setEditingId(item.id);
        setEditingTitle(t);
      }}
      onEditChange={setEditingTitle}
      onEditSave={() => saveEditTitle(item)}
      sectionName={!hideSectionChip && item.section_id ? sectionById[item.section_id]?.name : null}
      sectionGoalKey={item.section_id ? sectionGoalMap[item.section_id] ?? null : null}
      dreamTitle={item.section_id ? sectionDreamMap[item.section_id] ?? null : null}
      onDragStart={handleDragStart}
      isDragging={draggingItem?.id === item.id}
      onShowContextMenu={showContextMenu}
      onMoveToToday={!inToday ? handlers.onMoveToToday : undefined}
      childTasks={getChildren(item.id)}
      onToggleChildTask={(child: TodoItemRow) => handleComplete(child)}
      onSetPriority={handlers.onSetPriority}
      onDrop={onDrop}
      onMoveSection={handlers.onMoveSection}
      onSetDueDate={handlers.onSetDueDate}
      onSetRecurrence={handlers.onSetRecurrence}
      onSetReminder={handlers.onSetReminder}
      onCancelReminder={onCancelReminder}
      onSetTags={handlers.onSetTags}
      onSetSphere={handlers.onSetSphere}
      onAiBreakdown={onAiBreakdown}
      onSetTitle={handlers.onSetTitle}
      onSetNotes={handlers.onSetNotes}
      onAddChildTask={onAddChildTask}
    />
  );
}
