import { supabase } from '../supabase';
import { unwrap } from '../supabaseUtils';
import type { TodoSectionRow } from './todo';
import {
  updateTodoItem,
  createTodoItem,
  findTodoInSection,
  isUniqueTodoTitleError,
} from './todo';

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

async function claimSectionTodo(
  userId: string,
  sectionId: string,
  title: string,
  placement: {
    section_id: string;
    category: string | null;
    project_id?: string;
  },
  preferredTodoId: string | null,
): Promise<string> {
  const reopen = { status: 'open' as const, completed_at: null };
  const patch = { title, ...placement, ...reopen };

  const occupant = await findTodoInSection(userId, sectionId, title);
  if (occupant) {
    await updateTodoItem(occupant, patch);
    return occupant;
  }

  if (preferredTodoId) {
    try {
      await updateTodoItem(preferredTodoId, patch);
      return preferredTodoId;
    } catch (err: unknown) {
      if (!isUniqueTodoTitleError(err)) throw err;
      const again = await findTodoInSection(userId, sectionId, title);
      if (!again) throw err;
      await updateTodoItem(again, patch);
      return again;
    }
  }

  try {
    const item = await createTodoItem(userId, { title, ...placement });
    return item.id;
  } catch (err: unknown) {
    if (!isUniqueTodoTitleError(err)) throw err;
    const again = await findTodoInSection(userId, sectionId, title);
    if (!again) throw err;
    await updateTodoItem(again, patch);
    return again;
  }
}

/** Makes every Power List slot a real Todo item in its canonical destination. */
export async function materializeDailyWinTodos(
  userId: string,
  slots: DailyWinTodoSlot[],
): Promise<string[]> {
  const sections = await ensureDailyWinSections(userId);
  const ids: string[] = [];

  // Sequential: avoids racing two slots into the same (section, title).
  for (let index = 0; index < slots.length; index++) {
    const slot = slots[index];
    const sectionId = sections[index]?.id ?? null;
    const title = slot.title.trim();
    const category = index === 0 ? 'cialo' : index === 1 ? 'duch' : index === 2 ? 'konto' : null;
    const placementBase = {
      category,
      ...(slot.projectId ? { project_id: slot.projectId } : {}),
    };

    if (sectionId) {
      ids.push(await claimSectionTodo(
        userId,
        sectionId,
        title,
        { section_id: sectionId, ...placementBase },
        slot.todoId,
      ));
      continue;
    }

    // Slots 4–5 (Własne): no pillar section — null section_id allows duplicate titles in PG.
    if (slot.todoId) {
      await updateTodoItem(slot.todoId, {
        ...placementBase,
        section_id: null,
        status: 'open',
        completed_at: null,
      });
      ids.push(slot.todoId);
    } else {
      const item = await createTodoItem(userId, { title, ...placementBase });
      ids.push(item.id);
    }
  }

  return ids;
}
