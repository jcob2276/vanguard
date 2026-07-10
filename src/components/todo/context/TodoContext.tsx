import { createContext, useContext } from 'react';
import type { useTodoData } from '../useTodoData';

export type TodoContextType = ReturnType<typeof useTodoData>;

export const TodoContext = createContext<TodoContextType | null>(null);

export function useTodoContext() {
  const context = useContext(TodoContext);
  if (!context) {
    throw new Error('useTodoContext must be used within a TodoProvider');
  }
  return context;
}
