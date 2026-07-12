import type { CalRow } from '../calendarHelpers';
import type { CalendarTodo } from '../hooks/useCalendarTodos';
import type { WeatherState } from '../hooks/useCalendarWeather';

export type GoalChip = { pillar: string; dreamTitle: string | null } | null;

export interface CalendarGridEventBlockProps {
  ev: CalRow;
  left: string;
  width: string;
  handleEventMouseDown: (ev: CalRow, e: React.MouseEvent<HTMLDivElement>, action: 'move' | 'resize') => void;
}

export interface CalendarGridTodoBlockProps {
  todo: CalendarTodo;
  goalChipFor: (sectionId: string | null) => GoalChip;
  completedTodoIds: Set<string>;
  handleToggleTodo: (id: string) => void;
  setEditingTodo: (todo: CalendarTodo | null) => void;
  setEditingTodoTitle: (title: string) => void;
  setToastMessage: (msg: string) => void;
}

export interface CalendarGridTimeGutterProps {
  dayKey?: string;
  weather?: WeatherState | null;
}

export interface CalendarGridColumnProps {
  day: string;
  colClass?: string;
  today: string;
  nowMin: number;
  dayEvents: CalRow[];
  dayTodos: CalendarTodo[];
  dragSelect: {
    day: string;
    startMin: number;
    currentMin: number;
  } | null;
  goalChipFor: (sectionId: string | null) => GoalChip;
  completedTodoIds: Set<string>;
  handleColumnMouseDown: (day: string, e: React.MouseEvent) => void;
  handleColumnMouseMove: (day: string, e: React.MouseEvent) => void;
  handleEventMouseDown: (ev: CalRow, e: React.MouseEvent<HTMLDivElement>, action: 'move' | 'resize') => void;
  handleToggleTodo: (id: string) => void;
  setEditingTodo: (todo: CalendarTodo | null) => void;
  setEditingTodoTitle: (title: string) => void;
  setToastMessage: (msg: string) => void;
  setSaving: (saving: boolean) => void;
  scheduleTodoAt: (todo: { id: string }, day: string, startMin: number, duration: number) => Promise<unknown>;
}

export interface CalendarGridAllDayTodosProps {
  days: string[];
  untimedByDay: CalendarTodo[][];
  goalChipFor: (sectionId: string | null) => GoalChip;
  completedTodoIds: Set<string>;
  handleToggleTodo: (id: string) => void;
  setEditingTodo: (todo: CalendarTodo | null) => void;
  setEditingTodoTitle: (title: string) => void;
  setToastMessage: (msg: string) => void;
}
