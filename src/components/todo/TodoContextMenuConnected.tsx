/**
 * @component TodoContextMenuConnected
 * @role Warstwa handlerów menu kontekstowego (delete/duplicate/priority/due date/section) — spina TodoContext.
 * @composes ContextMenu (prezentacja)
 * @usedBy Todo
 */
import { useTodoContext } from './context/TodoContext';
import ContextMenu from './ContextMenu';
import { applyOptimisticPatch } from './todoOptimistic';
import { confirmDialog } from '../../lib/notify';
import { createTodoItem, deleteTodoItem, updateTodoItem } from '../../lib/todo/todo';

export default function TodoContextMenuConnected() {
  const {
    contextMenu, setContextMenu, today, sections, userId,
    setItems, setError, setEditingId, setEditingTitle,
  } = useTodoContext();

  if (!contextMenu) return null;

  return (
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      item={contextMenu.item}
      today={today}
      sections={sections}
      onClose={() => setContextMenu(null)}
      onDelete={() => {
        const cm = contextMenu;
        setContextMenu(null);
        void confirmDialog(`Czy na pewno chcesz usunąć na stałe zadanie "${cm.item.title}"? Tego nie można cofnąć.`).then((ok) => {
          if (ok) {
            setItems(prev => prev.filter(i => i.id !== cm.item.id));
            deleteTodoItem(cm.item.id).catch((err) => {
              setError(err instanceof Error ? err.message : String(err));
              setItems(prev => [...prev, cm.item]);
            });
          }
        });
      }}
      onSetDueDate={(dateStr) => {
        const cm = contextMenu;
        setContextMenu(null);
        const patch = { due_date: dateStr, ai_bucket: dateStr ? cm.item.ai_bucket : null };
        applyOptimisticPatch(setItems, cm.item, patch, () => updateTodoItem(cm.item.id, { due_date: dateStr, ...(dateStr ? {} : { ai_bucket: null }) }), setError);
      }}
      onMoveSection={(sId: string | null) => {
        const cm = contextMenu;
        setContextMenu(null);
        applyOptimisticPatch(setItems, cm.item, { section_id: sId }, () => updateTodoItem(cm.item.id, { section_id: sId }), setError);
      }}
      onEditStart={() => {
        const cm = contextMenu;
        setContextMenu(null);
        setEditingId(cm.item.id);
        setEditingTitle(cm.item.title);
      }}
      onSetPriority={(priority) => {
        const cm = contextMenu;
        setContextMenu(null);
        applyOptimisticPatch(setItems, cm.item, { priority }, () => updateTodoItem(cm.item.id, { priority }), setError);
      }}
      onDuplicate={() => {
        const cm = contextMenu;
        setContextMenu(null);
        createTodoItem(userId, {
          title: `${cm.item.title} (Kopia)`,
          notes: cm.item.notes || undefined,
          priority: cm.item.priority,
          due_date: cm.item.due_date || undefined,
          section_id: cm.item.section_id || undefined,
          recurrence: cm.item.recurrence || undefined,
          tagsText: (cm.item.tags || []).join(', '),
        }).then((newItem) => {
          setItems(prev => [...prev, newItem]);
        }).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
        });
      }}
    />
  );
}
