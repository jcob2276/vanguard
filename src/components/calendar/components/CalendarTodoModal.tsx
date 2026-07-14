import React from 'react';
import { useCalendar } from '../context/CalendarContext';
import { Check, Trash2 } from 'lucide-react';
import { combineDateTimeWarsawISO } from '../../../lib/date';
import { updateTodoItem } from '../../../lib/todo/todo';
import { addDays } from '../calendarHelpers';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { Card } from '../../ui/Card';

export default function CalendarTodoModal() {
  const {
    today,
    calData: { editingTodo, setEditingTodo, editingTodoTitle, setEditingTodoTitle, setToastMessage },
    calTodos: { completedTodoIds, handleToggleTodo, fetchAllTodos },
    closeEditTodoModal,
    saveTodoTitle,
    deleteTodo,
  } = useCalendar();

  if (!editingTodo) return null;

  return (
    <Modal isOpen={!!editingTodo} onClose={closeEditTodoModal} title="Edytuj zadanie" size="sm">
      <input
        autoFocus
        value={editingTodoTitle}
        onChange={(e) => setEditingTodoTitle(e.target.value)}
        onBlur={saveTodoTitle}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-full rounded-xl border border-border-custom/60 bg-surface-solid px-3 py-2 text-sm font-semibold text-text-primary outline-none focus:border-primary/40"
      />

      <div className="space-y-2">
        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Data i Czas</label>
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
            className="bg-surface-solid border border-border-custom/60 rounded-xl px-2 py-2.5 text-sm font-semibold text-text-primary outline-none focus:border-primary/50 transition-all cursor-pointer"
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
            className="bg-surface-solid border border-border-custom/60 rounded-xl px-2 py-2.5 text-sm font-semibold text-text-primary outline-none focus:border-primary/50 transition-all cursor-pointer"
          />
        </div>
      </div>

      <Button
        variant={completedTodoIds.has(editingTodo.id) ? 'outline' : 'primary'}
        icon={<Check size={14} />}
        onClick={async () => {
          await handleToggleTodo(editingTodo.id);
          const isDone = !completedTodoIds.has(editingTodo.id);
          setToastMessage(isDone ? `Ukończono: "${editingTodo.title}" ✅` : `Cofnięto ukończenie: "${editingTodo.title}"`);
          closeEditTodoModal();
        }}
        className={`w-full py-3 text-sm uppercase ${completedTodoIds.has(editingTodo.id) ? 'text-warning border-warning/20 hover:bg-warning/15' : ''}`}
      >
        {completedTodoIds.has(editingTodo.id) ? 'Oznacz jako nieukończone' : 'Oznacz jako ukończone'}
      </Button>

      {!completedTodoIds.has(editingTodo.id) && (
        <Card variant="glass" padding="0.875rem" className="space-y-2.5">
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider">Przełóż na jutro</label>
          <textarea
            placeholder="Dlaczego nie udało się zrobić tego zadania? (opcjonalnie)"
            value={editingTodo.notes || ''}
            onChange={(e) => setEditingTodo({ ...editingTodo, notes: e.target.value })}
            className="w-full min-h-[60px] rounded-lg border border-border-custom bg-background px-2.5 py-2 text-xs font-medium text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40 resize-y"
          />
          <Button
            variant="tonal"
            onClick={async () => {
              const currentDateStr = editingTodo.due_date || today;
              const tomorrowStr = addDays(currentDateStr, 1);
              let newScheduledTime = null;
              if (editingTodo.scheduled_time) {
                const timePart = editingTodo.scheduled_time.slice(11, 16);
                newScheduledTime = combineDateTimeWarsawISO(tomorrowStr, timePart);
              }
              await updateTodoItem(editingTodo.id, { due_date: tomorrowStr, scheduled_time: newScheduledTime, notes: editingTodo.notes?.trim() || null });
              await fetchAllTodos();
              setToastMessage(`Przełożono na jutro: "${editingTodo.title}" ➡️`);
              closeEditTodoModal();
            }}
            className="w-full py-2 text-xs uppercase"
          >
            Przełóż na jutro
          </Button>
        </Card>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={deleteTodo} icon={<Trash2 size={13} />} className="flex-1 py-2.5 text-sm text-danger border-danger/20 bg-danger/5 hover:bg-danger/10">
          Usuń
        </Button>
      </div>
    </Modal>
  );
}
