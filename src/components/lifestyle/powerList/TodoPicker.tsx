import { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
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
              key={item.key}
              onClick={() => {
                onSelect(item);
                onClose();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-solid active:scale-[0.98]"
            >
              {item.badge ? (
                <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-primary">
                  <BookOpen size={8} /> {item.badge}
                </span>
              ) : (
                <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[item.priority] || 'bg-blue-500'}`} />
              )}
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
