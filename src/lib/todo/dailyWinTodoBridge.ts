import { supabase } from '../supabase';
import { unwrap } from '../supabaseUtils';
import type { TodoSectionRow } from './todo';
import { updateTodoItem, createTodoItem } from './todo';

const DAILY_WIN_SECTION_NAMES = ['Stan ciała', 'Stan ducha', 'Stan konta'] as const;

export interface DailyWinTodoSlot {
  title: string;
  todoId: string | null;
  projectId: string | null;
}

async function ensureDailyWinSections(userId: string): Promise<TodoSectionRow[]> {
  return Promise.all(
    DAILY_WIN_SECTION_NAMES.map(async (name, index) => unwrap<TodoSectionRow>(
      await supabase
        .from('todo_sections')
        .upsert(
          { user_id: userId, name, sort_order: index, is_archived: false },
          { onConflict: 'user_id,name' },
        )
        .select()
        .single(),
    )),
  );
}

/** Makes every Power List slot a real Todo item in its canonical destination. */
export async function materializeDailyWinTodos(
  userId: string,
  slots: DailyWinTodoSlot[],
): Promise<string[]> {
  const sections = await ensureDailyWinSections(userId);

  return Promise.all(slots.map(async (slot, index) => {
    const placement = {
      section_id: sections[index]?.id ?? null,
      category: index === 0 ? 'cialo' : index === 1 ? 'duch' : index === 2 ? 'konto' : null,
      ...(slot.projectId ? { project_id: slot.projectId } : {}),
    };

    if (slot.todoId) {
      await updateTodoItem(slot.todoId, placement);
      return slot.todoId;
    }

    const item = await createTodoItem(userId, {
      title: slot.title,
      ...placement,
    });
    return item.id;
  }));
}
