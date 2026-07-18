import React from 'react';
import { CalendarDays, Check, Trash2 } from 'lucide-react';
import { combineDateTimeWarsawISO } from '../../../lib/date';
import Button from '../../ui/Button';
import { ControlInput, ControlTextarea } from '../../ui/ControlPrimitives';
import Modal from '../../ui/Modal';
import { useCalendar } from '../context/CalendarContext';
import { TaskDurationPicker, TaskPlacement, TaskRecurrencePicker } from './CalendarTodoControls';

export default function CalendarTodoModal() {
  const {
    calData: { editingTodo, setEditingTodo, editingTodoTitle, setEditingTodoTitle, saving, setToastMessage },
    calTodos: { completedTodoIds, handleToggleTodo },
    closeEditTodoModal,
    saveTodoChanges,
    deleteTodo,
  } = useCalendar();

  if (!editingTodo) return null;

  const isTimed = Boolean(editingTodo.scheduled_time);
  const isDone = editingTodo.status === 'done' || completedTodoIds.has(editingTodo.id);
  const timeValue = editingTodo.scheduled_time?.slice(11, 16) || '09:00';
  const setPlacement = (timed: boolean) => {
    setEditingTodo({
      ...editingTodo,
      scheduled_time: timed && editingTodo.due_date
        ? combineDateTimeWarsawISO(editingTodo.due_date, timeValue)
        : null,
      duration_minutes: timed ? editingTodo.duration_minutes || 60 : editingTodo.duration_minutes,
    });
  };

  return (
    <Modal
      isOpen
      onClose={closeEditTodoModal}
      title="Edytuj zadanie"
      subtitle={isTimed ? 'ZADANIE W PLANIE DNIA' : 'ZADANIE CAŁODNIOWE'}
      size="md"
    >
      <div className="mt-5 space-y-5">
        <ControlInput
          autoFocus
          value={editingTodoTitle}
          onChange={(event) => setEditingTodoTitle(event.target.value)}
          placeholder="Co chcesz zrobić?"
          className="min-h-12 w-full rounded-xl border border-border-custom bg-surface-solid px-4 text-base font-bold text-text-primary outline-none focus:border-primary/50"
        />

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
            <CalendarDays size={15} /> Umiejscowienie
          </div>
          <TaskPlacement isTimed={isTimed} onChange={setPlacement} />

          <div className={`grid gap-2 ${isTimed ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <ControlInput
              type="date"
              aria-label="Data zadania"
              value={editingTodo.due_date || ''}
              onChange={(event) => {
                const dueDate = event.target.value || null;
                setEditingTodo({
                  ...editingTodo,
                  due_date: dueDate,
                  scheduled_time: isTimed && dueDate ? combineDateTimeWarsawISO(dueDate, timeValue) : null,
                });
              }}
              className="min-h-11 rounded-xl border border-border-custom bg-surface-solid px-3 text-sm font-semibold text-text-primary outline-none focus:border-primary/50"
            />
            {isTimed && (
              <ControlInput
                type="time"
                aria-label="Godzina zadania"
                value={timeValue}
                onChange={(event) => setEditingTodo({
                  ...editingTodo,
                  scheduled_time: editingTodo.due_date
                    ? combineDateTimeWarsawISO(editingTodo.due_date, event.target.value)
                    : null,
                })}
                className="min-h-11 rounded-xl border border-border-custom bg-surface-solid px-3 text-sm font-semibold text-text-primary outline-none focus:border-primary/50"
              />
            )}
          </div>
        </section>

        {isTimed && <TaskDurationPicker value={editingTodo.duration_minutes || 60} onChange={(duration_minutes) => setEditingTodo({ ...editingTodo, duration_minutes })} />}

        <TaskRecurrencePicker value={editingTodo.recurrence || ''} onChange={(recurrence) => setEditingTodo({ ...editingTodo, recurrence })} />

        <ControlTextarea
          value={editingTodo.notes || ''}
          onChange={(event) => setEditingTodo({ ...editingTodo, notes: event.target.value })}
          placeholder="Notatka (opcjonalnie)"
          className="min-h-24 w-full resize-y rounded-xl border border-border-custom bg-surface-solid px-4 py-3 text-sm text-text-primary outline-none focus:border-primary/50"
        />

        <div className="flex flex-col-reverse gap-2 border-t border-border-custom/50 pt-4 sm:flex-row">
          <Button variant="ghost" icon={<Trash2 size={16} />} onClick={deleteTodo} className="min-h-11 text-danger sm:mr-auto">
            Usuń
          </Button>
          <Button
            variant="outline"
            icon={<Check size={16} />}
            onClick={async () => {
              await handleToggleTodo(editingTodo.id);
              setToastMessage(isDone ? 'Zadanie jest znowu aktywne.' : 'Zadanie ukończone.');
              closeEditTodoModal();
            }}
            className="min-h-11"
          >
            {isDone ? 'Przywróć' : 'Ukończ'}
          </Button>
          <Button
            onClick={saveTodoChanges}
            loading={saving}
            disabled={!editingTodoTitle.trim() || !editingTodo.due_date}
            className="min-h-11 sm:min-w-28"
          >
            Zapisz
          </Button>
        </div>
      </div>
    </Modal>
  );
}
