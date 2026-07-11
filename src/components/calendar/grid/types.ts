export interface CalendarGridEventBlockProps {
  ev: any;
  left: string;
  width: string;
  handleEventMouseDown: (ev: any, e: React.MouseEvent<HTMLDivElement>, action: 'move' | 'resize') => void;
}

export interface CalendarGridTodoBlockProps {
  todo: any;
  goalChipFor: (sectionId: string | null) => any;
  completedTodoIds: Set<string>;
  handleToggleTodo: (id: string) => void;
  setEditingTodo: (todo: any) => void;
  setEditingTodoTitle: (title: string) => void;
  setToastMessage: (msg: string) => void;
}

export interface CalendarGridTimeGutterProps {
  dayKey?: string;
  weather?: any;
}

export interface CalendarGridColumnProps {
  day: string;
  colClass?: string;
  today: string;
  nowMin: number;
  dayEvents: any[];
  dayTodos: any[];
  dragSelect: {
    day: string;
    startMin: number;
    currentMin: number;
  } | null;
  goalChipFor: (sectionId: string | null) => any;
  completedTodoIds: Set<string>;
  handleColumnMouseDown: (day: string, e: React.MouseEvent<any>) => void;
  handleColumnMouseMove: (day: string, e: React.MouseEvent<any>) => void;
  handleEventMouseDown: (ev: any, e: React.MouseEvent<HTMLDivElement>, action: 'move' | 'resize') => void;
  handleToggleTodo: (id: string) => void;
  setEditingTodo: (todo: any) => void;
  setEditingTodoTitle: (title: string) => void;
  setToastMessage: (msg: string) => void;
  setSaving: (saving: boolean) => void;
  scheduleTodoAt: (todo: any, day: string, startMin: number, duration: number) => Promise<any>;
}

export interface CalendarGridAllDayTodosProps {
  days: string[];
  untimedByDay: any[][];
  goalChipFor: (sectionId: string | null) => any;
  completedTodoIds: Set<string>;
  handleToggleTodo: (id: string) => void;
  setEditingTodo: (todo: any) => void;
  setEditingTodoTitle: (title: string) => void;
  setToastMessage: (msg: string) => void;
}
