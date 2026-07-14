import React from 'react';
import { useCalendar } from '../context/CalendarContext';
import { ChevronLeft, Check, Sparkles } from 'lucide-react';
import MiniCalendar from '../MiniCalendar';
import SolarDayWidget from '../SolarDayWidget';
import CalendarBudgetPanel from '../CalendarBudgetPanel';
import CalendarSidebarTodos from '../CalendarSidebarTodos';
import { LIFE_SPHERES } from '../../../lib/projects/lifeSpheres';
import { weekMon } from '../calendarHelpers';
import Button from '../../ui/Button';

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
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          icon={<ChevronLeft size={16} />}
          className="text-xs font-black uppercase tracking-wider text-text-muted hover:text-text-primary shrink-0"
        >
          Powrót
        </Button>

        <div className="flex-1" />

        {/* Shortcuts */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigateTo?.('todo')}
          title="Zadania"
          icon={<Check size={13} />}
          className="text-xs font-black uppercase tracking-wider text-text-muted hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20"
        >
          Todo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigateTo?.('keep')}
          title="Notatki"
          icon={<Sparkles size={13} />}
          className="text-xs font-black uppercase tracking-wider text-text-muted hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20"
        >
          Notatki
        </Button>
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
