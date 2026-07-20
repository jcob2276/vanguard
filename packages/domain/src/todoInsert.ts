import { normalizeTodoSchedule } from './todoSchedule.ts';

export interface BuildTodoInsertInput {
  user_id: string;
  title: string;
  notes?: string | null;
  priority?: string | null;
  tags?: string[] | null;
  /** Comma-separated tags (frontend form). Ignored when `tags` is provided. */
  tagsText?: string | null;
  due_date?: string | null;
  deadline_date?: string | null;
  recurrence?: string | null;
  section_id?: string | null;
  duration_minutes?: number | null;
  scheduled_time?: string | null;
  reminder_at?: string | null;
  reminder_sent?: boolean | null;
  is_important?: boolean | null;
  parent_task_id?: string | null;
  category?: string | null;
  project_id?: string | null;
  is_milestone?: boolean | null;
  sort_order?: number | null;
  status?: string | null;
}

/** Shared insert payload for todo_items (app + Telegram). */
export function buildTodoInsertRow(input: BuildTodoInsertInput): Record<string, unknown> {
  if (input.recurrence && !input.due_date && !input.scheduled_time) {
    throw new Error('Powtarzające się zadanie wymaga daty.');
  }

  const safe = normalizeTodoSchedule({
    title: input.title,
    due_date: input.due_date ?? null,
    deadline_date: input.deadline_date ?? null,
    scheduled_time: input.scheduled_time ?? null,
    recurrence: input.recurrence ?? null,
    duration_minutes: input.duration_minutes ?? null,
  });

  const tags = Array.isArray(input.tags)
    ? input.tags.filter((t) => typeof t === 'string' && t.trim().length > 0)
    : String(input.tagsText || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

  const row: Record<string, unknown> = {
    user_id: input.user_id,
    section_id: input.section_id || null,
    title: safe.title,
    notes: input.notes?.trim() || null,
    priority: input.priority || 'normal',
    tags,
    due_date: safe.due_date || null,
    deadline_date: safe.deadline_date || null,
    recurrence: safe.recurrence || null,
    duration_minutes: safe.duration_minutes ?? null,
    scheduled_time: safe.scheduled_time ?? null,
    reminder_at: input.reminder_at ?? null,
    reminder_sent: input.reminder_sent ?? false,
    is_important: input.is_important ?? false,
    parent_task_id: input.parent_task_id ?? null,
    category: input.category ?? null,
    project_id: input.project_id ?? null,
    is_milestone: input.is_milestone ?? false,
    status: input.status || 'open',
  };

  if (input.sort_order != null) {
    row.sort_order = input.sort_order;
  }

  return row;
}
