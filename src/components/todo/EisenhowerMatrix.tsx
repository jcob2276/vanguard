import { Pressable } from '../ui/ControlPrimitives';
import { useState } from 'react';
import { updateTodoItem } from '../../lib/todo/todo';
import type { TodoItemUpdate } from '../../lib/todo/todo';

interface Item {
  id: string;
  title: string;
  priority: string;
  is_important: boolean;
  due_date: string | null;
  status: string;
  duration_minutes: number | null;
}

interface Props {
  items: Item[];
  setItems: (fn: (prev: Item[]) => Item[]) => void;
}

const QUADRANTS = [
  {
    key: 'q1',
    label: 'Zrób teraz',
    sub: 'Pilne + Ważne',
    urgent: true,
    important: true,
    color: 'border-danger/30 bg-danger/5',
    badge: 'bg-danger/15 text-danger',
    dot: 'bg-danger',
  },
  {
    key: 'q2',
    label: 'Zaplanuj',
    sub: 'Niepilne + Ważne',
    urgent: false,
    important: true,
    color: 'border-info/30 bg-info/5',
    badge: 'bg-info/15 text-info',
    dot: 'bg-info',
  },
  {
    key: 'q3',
    label: 'Deleguj',
    sub: 'Pilne + Nieważne',
    urgent: true,
    important: false,
    color: 'border-warning/30 bg-warning/5',
    badge: 'bg-warning/15 text-warning',
    dot: 'bg-warning',
  },
  {
    key: 'q4',
    label: 'Eliminuj',
    sub: 'Niepilne + Nieważne',
    urgent: false,
    important: false,
    color: 'border-border-custom bg-surface/30',
    badge: 'bg-surface-solid text-text-muted',
    dot: 'bg-text-muted',
  },
];

function isUrgent(item: Item) {
  return item.priority === 'urgent';
}

function quadrantOf(item: Item) {
  const urgent = isUrgent(item);
  const important = item.is_important;
  if (urgent && important) return 'q1';
  if (!urgent && important) return 'q2';
  if (urgent && !important) return 'q3';
  return 'q4';
}

export default function EisenhowerMatrix({ items, setItems }: Props) {
  const [dragOverQ, setDragOverQ] = useState<string | null>(null);
  const open = items.filter((i) => i.status === 'open');

  function moveToQuadrant(item: Item, q: typeof QUADRANTS[0]) {
    const newPriority = q.urgent ? 'urgent' : item.priority === 'urgent' ? 'high' : item.priority;
    const newImportant = q.important;
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, priority: newPriority, is_important: newImportant } : i,
      ),
    );
    const patch: TodoItemUpdate = { priority: newPriority, is_important: newImportant };
    updateTodoItem(item.id, patch).catch(() => {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, priority: item.priority, is_important: item.is_important } : i)),
      );
    });
  }

  return (
    <div className="p-4 pb-24">
      <div className="grid grid-cols-2 gap-3 max-w-[var(--ds-maxw-700px)] mx-auto">
        {QUADRANTS.map((q) => {
          const qItems = open.filter((i) => quadrantOf(i) === q.key);
          return (
            <div
              key={q.key}
              className={`rounded-2xl border p-3 min-h-[var(--ds-h-180px)] transition-all duration-[var(--motion-medium)] ${q.color} ${dragOverQ === q.key ? 'scale-[var(--ds-arbitrary-1-01)] border-primary/50 shadow-md ring-2 ring-primary/10' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverQ(q.key);
              }}
              onDragLeave={() => setDragOverQ(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverQ(null);
                const id = e.dataTransfer.getData('text/plain');
                const item = items.find((i) => i.id === id);
                if (item) moveToQuadrant(item, q);
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-black text-text-primary tracking-tight">{q.label}</p>
                  <p className="text-2xs text-text-muted font-medium mt-0.5">{q.sub}</p>
                </div>
                {qItems.length > 0 && (
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${q.badge}`}>
                    {qItems.length}
                  </span>
                )}
              </div>

              {/* Tasks */}
              <div className="space-y-1.5">
                {qItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
                    className="group flex items-start gap-2 rounded-xl bg-background/60 border border-border-custom/40 px-3 py-2 cursor-grab active:cursor-grabbing hover:border-border-custom transition-all"
                  >
                    <span className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${q.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-text-primary leading-snug line-clamp-2">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {item.due_date && (
                          <span className="text-2xs text-text-muted">{item.due_date}</span>
                        )}
                        {item.duration_minutes && (
                          <span className="text-2xs text-warning font-semibold">
                            {item.duration_minutes < 60
                              ? `${item.duration_minutes}min`
                              : `${Math.floor(item.duration_minutes / 60)}h${item.duration_minutes % 60 ? item.duration_minutes % 60 + 'min' : ''}`}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Quick move buttons */}
                    <div className="flex md:hidden md:group-hover:flex flex-row md:flex-col gap-1 items-center justify-center shrink-0 ml-1">
                      {QUADRANTS.filter((qq) => qq.key !== q.key).map((qq) => (
                        <Pressable
                          key={qq.key}
                          onClick={(e) => { e.stopPropagation(); moveToQuadrant(item, qq); }}
                          className={`text-xs w-5 h-5 flex items-center justify-center rounded-full font-black shadow-sm active:scale-90 transition-transform ${qq.badge}`}
                          title={`Przenieś do: ${qq.label}`}
                        >
                          {qq.label.charAt(0)}
                        </Pressable>
                      ))}
                    </div>
                  </div>
                ))}

                {qItems.length === 0 && (
                  <p className="text-xs text-text-muted/50 text-center py-4">Przeciągnij tu zadanie</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
