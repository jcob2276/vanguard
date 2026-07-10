import React from 'react';
import { useCalendar } from '../context/CalendarContext';
import { ChevronLeft, Check, Sparkles } from 'lucide-react';
import MiniCalendar from '../MiniCalendar';
import SolarDayWidget from '../SolarDayWidget';
import CalendarBudgetPanel from '../CalendarBudgetPanel';
import CalendarSidebarTodos from '../CalendarSidebarTodos';
import { LIFE_SPHERES } from '../../../lib/projects/lifeSpheres';
import { weekMon } from '../calendarHelpers';

interface CalendarSidebarProps {
  onBack: () => void;
  onNavigateTo?: (dest: string) => void;
}

export default function CalendarSidebar({ onBack, onNavigateTo }: CalendarSidebarProps) {
  const {
    calData: {
      selectedDay,
      setSelectedDay,
      setWeekStart,
      setBudgetMinInputs,
      setBudgetMaxInputs,
      setShowBudgetConfig,
    },
    calTodos: {
      inboxTodos,
      newTodoTitle,
      setNewTodoTitle,
      handleQuickAddTodo,
      handleToggleTodo,
      completedTodoIds,
      goalChipFor,
    },
    timeBudgets: {
      budgets,
    },
    categoryWeeklyTotals,
    categoryPrevWeeklyTotals,
  } = useCalendar();

  return (
    <div className="w-[280px] shrink-0 border-r border-border-custom/50 flex flex-col bg-surface/10 select-none">
      {/* Back Navigation header */}
      <div className="h-[60px] shrink-0 border-b border-border-custom/20 flex items-center px-4 gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors shrink-0 cursor-pointer"
        >
          <ChevronLeft size={16} /> Powrót
        </button>

        <div className="flex-1" />

        {/* Shortcuts */}
        <button
          onClick={() => onNavigateTo?.('todo')}
          title="Zadania"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20 cursor-pointer"
        >
          <Check size={13} /> Todo
        </button>
        <button
          onClick={() => onNavigateTo?.('keep')}
          title="Notatki"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20 cursor-pointer"
        >
          <Sparkles size={13} /> Notatki
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        <MiniCalendar
          selectedDay={selectedDay}
          onSelectDay={(day) => {
            setSelectedDay(day);
            setWeekStart(weekMon(day));
          }}
        />

        <SolarDayWidget dateStr={selectedDay} />

        <CalendarBudgetPanel
          categoryWeeklyTotals={categoryWeeklyTotals}
          categoryPrevWeeklyTotals={categoryPrevWeeklyTotals}
          budgets={budgets}
          onConfigure={() => {
            const mins: Record<string, string> = {};
            const maxs: Record<string, string> = {};
            LIFE_SPHERES.map((s) => s.id).forEach((cat) => {
              const b = budgets.find((item) => item.category === cat);
              mins[cat] = b?.min_hours !== null && b?.min_hours !== undefined ? String(b.min_hours) : '';
              maxs[cat] = b?.max_hours !== null && b?.max_hours !== undefined ? String(b.max_hours) : '';
            });
            setBudgetMinInputs(mins);
            setBudgetMaxInputs(maxs);
            setShowBudgetConfig(true);
          }}
        />

        <CalendarSidebarTodos
          sidebarTodos={inboxTodos}
          newTodoTitle={newTodoTitle}
          setNewTodoTitle={setNewTodoTitle}
          handleQuickAddTodo={handleQuickAddTodo}
          handleToggleTodo={handleToggleTodo}
          completedTodoIds={completedTodoIds}
          goalChipFor={goalChipFor}
        />
      </div>
    </div>
  );
}
