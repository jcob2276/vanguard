import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, CheckSquare, Link2, Search, Target, Upload, X } from 'lucide-react';
import { listTodoItems, updateTodoItem } from '../../lib/todo';
import type { TablesUpdate } from '../../lib/database.types';

const PRIORITY_DOT = {
  low: 'bg-emerald-500',
  normal: 'bg-blue-500',
  high: 'bg-indigo-500',
  urgent: 'bg-rose-500',
};
const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };

function TodoPicker({ items, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="mt-1.5 overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-lg">
      <div className="flex items-center gap-2 border-b border-border-custom px-3 py-2">
        <Search size={11} className="shrink-0 text-text-muted" />
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder="Szukaj zadania..."
          className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-text-primary outline-none placeholder:text-text-muted/40"
        />
      </div>
      <div className="max-h-[188px] overflow-y-auto p-1.5 space-y-0.5">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-[10px] font-medium text-text-muted">Brak otwartych zadań</p>
        ) : (
          filtered.slice(0, 20).map((item) => (
            <button
              key={item.id}
              onClick={() => { onSelect(item); onClose(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-solid active:scale-[0.98]"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[item.priority] || 'bg-blue-500'}`} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text-primary">{item.title}</span>
              {item.due_date && (
                <span className="shrink-0 text-[9px] font-bold text-text-muted">{item.due_date}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function PowerList({ session, todayWin, onUpdate }) {
  const userId = session.user.id;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

  const [newTaskForm, setNewTaskForm] = useState([
    { task: '', todoId: null },
    { task: '', todoId: null },
    { task: '', todoId: null },
    { task: '', todoId: null },
    { task: '', todoId: null },
  ]);
  const [todoItems, setTodoItems] = useState([]);
  const [pickerSlot, setPickerSlot] = useState(-1);
  const [submitting, setSubmitting] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (todayWin) return;
    listTodoItems(userId)
      .then((items) => {
        const open = (items || [])
          .filter((i) => i.status === 'open')
          .sort((a, b) => {
            const aToday = a.due_date === today;
            const bToday = b.due_date === today;
            if (aToday !== bToday) return aToday ? -1 : 1;
            return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
          });
        setTodoItems(open);
      })
      .catch(() => {});
  }, [userId, today, todayWin]);

  useEffect(() => {
    if (pickerSlot < 0) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerSlot(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerSlot]);

  const updateSlot = (i, patch) => {
    setNewTaskForm((prev) => {
      const n = [...prev];
      n[i] = { ...n[i], ...patch };
      return n;
    });
  };

  async function toggleTask(index) {
    if (!todayWin) return;
    const field = `done_${index + 1}`;
    const timeField = `completed_at_${index + 1}`;
    const todoIdField = `task_${index + 1}_todo_id`;
    const newValue = !todayWin[field];
    const timestamp = newValue ? new Date().toISOString() : null;

    const allDone = [1, 2, 3, 4, 5].every((i) => {
      if (!todayWin[`task_${i}`]) return true;
      if (i === index + 1) return newValue;
      return todayWin[`done_${i}`];
    });

    const updates = { [field]: newValue, [timeField]: timestamp } as TablesUpdate<'daily_wins'>;
    if (allDone) updates.result = 'Z';
    else {
      if (todayWin.result === 'Z') updates.result = null;
      if (new Date().getHours() >= 23 && !allDone) updates.result = 'P';
    }

    const { data, error } = await supabase
      .from('daily_wins')
      .update(updates)
      .eq('id', todayWin.id)
      .select()
      .single();

    if (!error && onUpdate) onUpdate(data);

    const linkedTodoId = todayWin[todoIdField];
    if (linkedTodoId) {
      updateTodoItem(linkedTodoId, {
        status: newValue ? 'done' : 'open',
        completed_at: newValue ? new Date().toISOString() : null,
      }).catch(() => {});
    }
  }

  async function startNewDay() {
    if (submitting) return;
    if (!newTaskForm.some((t) => t.task.trim())) {
      alert('Wypełnij przynajmniej 1 zadanie!');
      return;
    }

    setSubmitting(true);
    try {
      const entry = {
        user_id: userId,
        date: today,
        task_1: newTaskForm[0].task, category_1: 'general', task_1_todo_id: newTaskForm[0].todoId,
        task_2: newTaskForm[1].task, category_2: 'general', task_2_todo_id: newTaskForm[1].todoId,
        task_3: newTaskForm[2].task, category_3: 'general', task_3_todo_id: newTaskForm[2].todoId,
        task_4: newTaskForm[3].task, category_4: 'general', task_4_todo_id: newTaskForm[3].todoId,
        task_5: newTaskForm[4].task, category_5: 'general', task_5_todo_id: newTaskForm[4].todoId,
        result: null,
      };

      const { data, error } = await supabase.from('daily_wins').insert(entry).select().single();
      if (error) {
        console.error('[startNewDay]', error);
        alert('Błąd startu dnia');
      } else if (onUpdate) {
        onUpdate(data);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h3 className="flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-wider text-text-muted">
          <Target size={13} className="text-primary" /> 5 zwycięstw
        </h3>
        {todayWin?.result === 'Z' && (
          <div className="rounded-full border border-dayC/15 bg-dayC/10 px-2.5 py-0.5 font-display text-[9px] font-bold text-dayC">
            Executed
          </div>
        )}
      </div>

      {!todayWin ? (
        <div className="space-y-5 rounded-[24px] border border-border-custom bg-surface p-5 shadow-sm">
          <div>
            <h3 className="font-display text-[14px] font-black tracking-tight text-text-primary">
              Zdefiniuj 5 zwycięstw
            </h3>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-text-secondary">
              Wpisz ręcznie lub wybierz z{' '}
              <span className="inline-flex items-center gap-1 font-bold text-primary">
                Zadań <Link2 size={10} />
              </span>
              .
            </p>
          </div>

          <div className="space-y-2.5" ref={pickerRef}>
            {newTaskForm.map((slot, i) => (
              <div key={i}>
                <div
                  className={`flex items-center gap-2 rounded-xl border bg-surface transition-colors ${
                    pickerSlot === i ? 'border-primary/40 bg-surface-solid' : 'border-border-custom'
                  }`}
                >
                  {slot.todoId ? (
                    <div className="flex min-w-0 flex-1 items-center gap-2 px-3.5 py-3">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          PRIORITY_DOT[todoItems.find((x) => x.id === slot.todoId)?.priority] || 'bg-blue-500'
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-primary">
                        {slot.task}
                      </span>
                    </div>
                  ) : (
                    <input
                      placeholder={`Zadanie ${i + 1}`}
                      value={slot.task}
                      onChange={(e) => updateSlot(i, { task: e.target.value })}
                      className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-[13px] font-medium text-text-primary outline-none placeholder:text-text-muted/40"
                    />
                  )}

                  {slot.todoId ? (
                    <button
                      onClick={() => updateSlot(i, { task: '', todoId: null })}
                      className="mr-3 shrink-0 rounded-full p-1.5 text-primary transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                      title="Usuń powiązanie"
                    >
                      <X size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setPickerSlot(pickerSlot === i ? -1 : i)}
                      className={`mr-3 shrink-0 rounded-full p-1.5 transition-colors ${
                        pickerSlot === i
                          ? 'bg-primary/15 text-primary'
                          : 'text-text-muted hover:bg-primary/10 hover:text-primary'
                      }`}
                      title="Wybierz z zadań"
                    >
                      <Link2 size={14} />
                    </button>
                  )}
                </div>

                {pickerSlot === i && (
                  <TodoPicker
                    items={todoItems}
                    onSelect={(item) => {
                      updateSlot(i, { task: item.title, todoId: item.id });
                    }}
                    onClose={() => setPickerSlot(-1)}
                  />
                )}
              </div>
            ))}
          </div>

          <button
            onClick={startNewDay}
            disabled={submitting}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-display text-[12px] font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={14} /> {submitting ? 'Zapisywanie…' : 'Zatwierdź operację'}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {[0, 1, 2, 3, 4].map((i) => {
            const task = todayWin[`task_${i + 1}`];
            const done = todayWin[`done_${i + 1}`];
            const completedAt = todayWin[`completed_at_${i + 1}`];
            const linkedTodoId = todayWin[`task_${i + 1}_todo_id`];
            if (!task) return null;

            return (
              <button
                key={i}
                onClick={() => toggleTask(i)}
                className={`group flex w-full cursor-pointer items-center justify-between rounded-[20px] border p-4 transition-all duration-200 active:scale-[0.98] ${
                  done
                    ? 'border-border-custom bg-surface/30 opacity-60 shadow-none'
                    : 'border-border-custom bg-surface shadow-sm hover:-translate-y-0.5 hover:border-primary/25 hover:bg-surface-solid hover:shadow-md'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-4 text-left">
                  <div
                    className={`flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                      done
                        ? 'border-dayC bg-dayC text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)] scale-100'
                        : 'border-border-custom bg-surface-solid text-transparent scale-95 group-hover:border-primary/40 group-active:scale-90'
                    }`}
                  >
                    <Check size={11} strokeWidth={3} className={`transition-transform duration-300 ${done ? 'scale-100' : 'scale-0'}`} />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-[13px] font-semibold tracking-normal transition-all duration-300 ${
                        done ? 'text-text-muted line-through opacity-70' : 'text-text-primary'
                      }`}
                    >
                      {task}
                    </p>
                    {done && completedAt && (
                      <p className="mt-0.5 text-[9px] font-semibold text-dayC/80">
                        Zrobione o{' '}
                        {new Date(completedAt).toLocaleTimeString('pl-PL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                </div>

                {linkedTodoId && !done && (
                  <span className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[8px] font-black text-primary">
                    <Link2 size={8} /> Zadanie
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
