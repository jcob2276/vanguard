import { Pressable, ControlInput } from '../../ui/ControlPrimitives';
import { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import Badge from '../../ui/Badge';
import { PRIORITY_DOT } from './powerListConstants';

import { type TodoItemRow } from '../../../lib/todo/todo';

interface TodoPickerProps {
  items: TodoItemRow[];
  onSelect: (item: TodoItemRow) => void;
  onClose: () => void;
}

export default function TodoPicker({ items, onSelect, onClose }: TodoPickerProps) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="mt-1.5 overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-lg">
      <div className="flex items-center gap-2 border-b border-border-custom px-3 py-2">
        <Search size={11} className="shrink-0 text-text-muted" />
        <ControlInput
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder="Szukaj zadania..."
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:text-text-muted/40"
        />
      </div>
      <div className="max-h-[var(--ds-h-188px)] overflow-y-auto p-1.5 space-y-0.5">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs font-medium text-text-muted">Brak otwartych zadań</p>
        ) : (
          filtered.slice(0, 20).map((item) => (
            <Pressable
              key={item.id}
              onClick={() => {
                onSelect(item);
                onClose();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-solid active:scale-[var(--ds-arbitrary-0-98)]"
            >
              {item.category ? (
                <Badge variant="tag" className="shrink-0">
                  <BookOpen size={8} /> {item.category}
                </Badge>
              ) : (
                <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[item.priority] || 'bg-info'}`} />
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">{item.title}</span>
              {item.due_date && (
                <span className="shrink-0 text-2xs font-bold text-text-muted">{item.due_date}</span>
              )}
            </Pressable>
          ))
        )}
      </div>
    </div>
  );
}
