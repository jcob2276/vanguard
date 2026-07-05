import React from 'react';
import { Plus } from 'lucide-react';
import { GOAL_ICON } from '../todo/todoUtils';
import type { CalendarTodo } from '../../hooks/useCalendarTodos';

export type SidebarTodo = CalendarTodo;

const PILLAR_CHIP: Record<string, string> = {
  cialo: 'bg-emerald-500/8 border-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  duch: 'bg-indigo-500/8 border-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  konto: 'bg-amber-500/8 border-amber-500/15 text-amber-600 dark:text-amber-400',
};

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
  handleToggleTodo,
  completedTodoIds,
  goalChipFor,
}: CalendarSidebarTodosProps) {
  return (
    <div className="space-y-3 pt-4 border-t border-border-custom/40">
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Zadania (Inbox)</span>

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
        <button
          onClick={handleQuickAddTodo}
          disabled={!newTodoTitle.trim()}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80 disabled:opacity-30"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
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
                className={`flex items-start gap-2.5 p-2.5 bg-slate-50 dark:bg-white/[0.015] border border-border-custom/30 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-all cursor-grab active:cursor-grabbing group hover:scale-[1.01] active:scale-[0.99] select-none ${isCompleted ? 'opacity-50 border-emerald-500/20 bg-emerald-500/[0.02]' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isCompleted}
                  onChange={() => handleToggleTodo(todo.id)}
                  className="mt-0.5 w-3.5 h-3.5 border-border-custom/80 rounded bg-transparent checked:bg-emerald-500 checked:border-emerald-500 transition-all cursor-pointer accent-emerald-500 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <span className={`block text-[12px] font-semibold break-words transition-all duration-300 ${isCompleted ? 'line-through text-text-muted/50' : 'text-text-primary group-hover:text-primary'}`}>
                    {todo.title}
                  </span>
                  {chip && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${PILLAR_CHIP[chip.pillar] || ''}`}>
                      {GoalIcon && <GoalIcon size={8} />}
                      {chip.dreamTitle && <span className="truncate max-w-[100px]">{chip.dreamTitle}</span>}
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
