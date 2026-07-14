import React from 'react';
import { Plus, GripVertical } from 'lucide-react';
import { GOAL_ICON } from '../todo/todoUtils';
import type { CalendarTodo } from './hooks/useCalendarTodos';
import { PILLARS, PILLAR_META } from '../../lib/projects/pillars';
import Button from '../ui/Button';

type SidebarTodo = CalendarTodo;

// Lighter chip opacity than PILLAR_META's canonical 10/30 — bg/border are literal Tailwind
// classes on purpose (dynamically-built `bg-${color}-...` strings aren't picked up by
// Tailwind's static scanner and would silently render unstyled). `text` reuses PILLAR_META
// so at least the color identity can't drift out of sync with the canonical map.
const PILLAR_CHIP_BG_BORDER: Record<string, string> = {
  cialo: 'bg-success/8 border-success/15',
  duch: 'bg-primary/8 border-primary/15',
  konto: 'bg-warning/8 border-warning/15',
};
const PILLAR_CHIP: Record<string, string> = Object.fromEntries(
  PILLARS.map((id) => [id, `${PILLAR_CHIP_BG_BORDER[id]} ${PILLAR_META[id].text}`]),
);

interface CalendarSidebarTodosProps {
  sidebarTodos: SidebarTodo[];
  newTodoTitle: string;
  setNewTodoTitle: (val: string) => void;
  handleQuickAddTodo: () => void;
  handleToggleTodo: (id: string) => void;
  completedTodoIds: Set<string>;
  goalChipFor: (sectionId: string | null) => { pillar: string; dreamTitle: string | null } | null;
}

export default function CalendarSidebarTodos({
  sidebarTodos,
  newTodoTitle,
  setNewTodoTitle,
  handleQuickAddTodo,
  completedTodoIds,
  goalChipFor,
}: CalendarSidebarTodosProps) {
  return (
    <div className="space-y-3 pt-4 border-t border-border-custom/40">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Zadania (Inbox)</span>
        <span className="text-[9px] text-text-muted/65 italic font-medium">przeciągnij na kalendarz</span>
      </div>

      {/* Quick add task input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Dodaj szybkie zadanie..."
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAddTodo(); }}
          className="w-full bg-slate-50 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl pl-3 pr-8 py-2 text-[12px] font-semibold text-text-primary outline-none focus:border-primary/50 transition-all placeholder:text-text-muted/30"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleQuickAddTodo}
          disabled={!newTodoTitle.trim()}
          icon={<Plus size={14} />}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80 disabled:opacity-30"
        />
      </div>

      <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
        {sidebarTodos.length === 0 ? (
          <p className="text-[11px] text-text-muted/40 italic text-center py-4">Brak aktywnych zadań</p>
        ) : (
          sidebarTodos.map((todo) => {
            const isCompleted = completedTodoIds.has(todo.id);
            const chip = goalChipFor(todo.section_id);
            const GoalIcon = chip ? GOAL_ICON[chip.pillar] : null;
            return (
              <div
                key={todo.id}
                draggable="true"
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', JSON.stringify({ id: todo.id, title: todo.title }));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className={`flex items-center gap-1.5 p-2 bg-surface-solid/5 dark:bg-white/[0.015] border border-border-custom/25 rounded-xl hover:bg-primary/5 hover:border-primary/30 transition-all cursor-grab active:cursor-grabbing hover:scale-[1.01] active:scale-[0.99] select-none ${isCompleted ? 'opacity-40' : ''}`}
                title="Przeciągnij na kalendarz, aby zaplanować"
              >
                {/* Drag Handle instead of Checkbox */}
                <div className="text-text-muted/40 hover:text-text-muted shrink-0 cursor-grab">
                  <GripVertical size={13} strokeWidth={2.5} />
                </div>

                <div className="min-w-0 flex-1 py-0.5 space-y-0.5">
                  <span className="block text-[11.5px] font-bold text-text-primary break-words leading-snug">
                    {todo.title}
                  </span>
                  {chip && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8.5px] font-bold leading-none ${PILLAR_CHIP[chip.pillar] || ''}`}>
                      {GoalIcon && <GoalIcon size={8} />}
                      {chip.dreamTitle && <span className="truncate max-w-[120px]">{chip.dreamTitle}</span>}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
