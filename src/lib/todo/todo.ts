import { supabase } from '../supabase';
import type { Database } from '../database.types';
import { unwrap, unwrapList, unwrapMaybe } from '../supabaseUtils';
import { getTodayWarsaw } from '../date';
import { isOfflineError, queueOfflineWrite } from '../offlineQueue';
import { buildTodoInsertRow, normalizeTodoSchedule } from '@vanguard/domain';

export type TodoItemRow = Database['public']['Tables']['todo_items']['Row'];
export type TodoItemUpdate = Database['public']['Tables']['todo_items']['Update'];
export type TodoSectionRow = Database['public']['Tables']['todo_sections']['Row'];
type TodoSmartListRow = Database['public']['Tables']['todo_smart_lists']['Row'];
export type TodoAttachmentRow = Database['public']['Tables']['todo_attachments']['Row'];

export async function listTodoSections(userId: string): Promise<TodoSectionRow[]> {
  return unwrapList(
    await supabase
      .from('todo_sections')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  );
}

export async function listTodoItems(userId: string): Promise<TodoItemRow[]> {
  return unwrapList(
    await supabase
      .from('todo_items')
      .select('*')
      .eq('user_id', userId)
      .order('status', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
  );
}

export async function createTodoSection(userId: string, name: string, sortOrder = 999): Promise<TodoSectionRow> {
  return unwrap(
    await supabase
      .from('todo_sections')
      .insert({ user_id: userId, name: name.trim(), sort_order: sortOrder })
      .select()
      .single(),
  );
}

interface CreateTodoItemFields {
  title: string;
  notes?: string;
  priority?: string;
  tagsText?: string;
  due_date?: string;
  deadline_date?: string;
  recurrence?: string;
  section_id?: string;
  duration_minutes?: number | null;
  scheduled_time?: string | null;
  reminder_at?: string | null;
  is_important?: boolean;
  parent_task_id?: string | null;
  category?: string | null;
  project_id?: string | null;
  is_milestone?: boolean;
  sort_order?: number | null;
}

/** Find any todo occupying (user_id, section_id, title) — unique constraint includes done/dropped. */
export async function findTodoInSection(
  userId: string,
  sectionId: string,
  title: string,
): Promise<string | null> {
  const trimmed = title.trim();
  if (!trimmed) return null;

  const row = await unwrapMaybe<{ id: string }>(
    await supabase
      .from('todo_items')
      .select('id')
      .eq('user_id', userId)
      .eq('section_id', sectionId)
      .eq('title', trimmed)
      .maybeSingle(),
  );
  return row?.id ?? null;
}

export function isUniqueTodoTitleError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('todo_items_user_id_section_id_title_key');
}

export async function createTodoItem(userId: string, fields: CreateTodoItemFields): Promise<TodoItemRow> {
  const payload = buildTodoInsertRow({
    user_id: userId,
    title: fields.title,
    notes: fields.notes,
    priority: fields.priority,
    tagsText: fields.tagsText,
    due_date: fields.due_date,
    deadline_date: fields.deadline_date,
    recurrence: fields.recurrence,
    section_id: fields.section_id,
    duration_minutes: fields.duration_minutes,
    scheduled_time: fields.scheduled_time,
    reminder_at: fields.reminder_at,
    is_important: fields.is_important,
    parent_task_id: fields.parent_task_id,
    category: fields.category,
    project_id: fields.project_id,
    is_milestone: fields.is_milestone,
    sort_order: fields.sort_order,
  });

  try {
    return unwrap(
      await supabase
        .from('todo_items')
        .insert(payload as never)
        .select()
        .single(),
    );
  } catch (err: unknown) {
    if (isOfflineError(err)) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const fullPayload = {
        id,
        ...payload,
        recurrence_origin_id: null,
        created_at: now,
        updated_at: now,
        completed_at: null,
        ai_bucket: null,
        ai_classified_at: null,
        sort_order: fields.sort_order ?? 999,
      } as TodoItemRow;
      await queueOfflineWrite('table:insert:todo_items', { payload: fullPayload }, 'Dodanie zadania');
      return fullPayload;
    }
    throw err;
  }
}

export async function updateTodoItem(id: string, patch: TodoItemUpdate): Promise<TodoItemRow | void> {
  const safePatch = normalizeTodoSchedule(patch);
  try {
    const { data, error } = await supabase
      .from('todo_items')
      .update(safePatch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    // data may be null if RLS suppresses the returned row — that's fine, the update still happened
    return data ?? undefined;
  } catch (err: unknown) {
    if (isOfflineError(err)) {
      await queueOfflineWrite('table:update:todo_items', { match: { id }, payload: safePatch }, 'Edycja zadania');
      return;
    }
    throw err;
  }
}

export async function setTodoStatus(item: { id: string }, status: string): Promise<TodoItemRow | void> {
  return updateTodoItem(item.id, {
    status,
    completed_at: status === 'done' ? new Date().toISOString() : null,
  });
}

export async function deleteTodoItem(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('todo_items').delete().eq('id', id);
    if (error) throw new Error(error.message);
  } catch (err: unknown) {
    if (isOfflineError(err)) {
      await queueOfflineWrite('table:delete:todo_items', { match: { id } }, 'Usunięcie zadania');
      return;
    }
    throw err;
  }
}

export async function renameTodoSection(id: string, name: string): Promise<TodoSectionRow> {
  return unwrap(
    await supabase
      .from('todo_sections')
      .update({ name: name.trim() })
      .eq('id', id)
      .select()
      .single(),
  );
}

export async function archiveTodoSection(id: string): Promise<TodoSectionRow> {
  // Sections are never unarchived anywhere in the UI, so this is effectively a
  // delete — reassign its tasks to the inbox first, otherwise they keep
  // pointing at a section_id that no longer appears in any list and silently
  // vanish from the whole app (not shown as inbox, not shown anywhere).
  const { error: reassignErr } = await supabase
    .from('todo_items')
    .update({ section_id: null })
    .eq('section_id', id);
  if (reassignErr) throw new Error(reassignErr.message);

  return unwrap(
    await supabase
      .from('todo_sections')
      .update({ is_archived: true })
      .eq('id', id)
      .select()
      .single(),
  );
}

// ── Smart Lists (saved searches) ──
export async function listSmartLists(userId: string): Promise<TodoSmartListRow[]> {
  return unwrapList(
    await supabase
      .from('todo_smart_lists')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  );
}

export async function createSmartList(userId: string, name: string, query: string, icon = '🔍'): Promise<TodoSmartListRow> {
  return unwrap(
    await supabase
      .from('todo_smart_lists')
      .insert({ user_id: userId, name: name.trim(), query: query.trim(), icon })
      .select()
      .single(),
  );
}

export async function deleteSmartList(id: string): Promise<void> {
  const { error } = await supabase.from('todo_smart_lists').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Attachments ──
export async function listAttachments(todoItemId: string): Promise<TodoAttachmentRow[]> {
  return unwrapList(
    await supabase
      .from('todo_attachments')
      .select('*')
      .eq('todo_item_id', todoItemId)
      .order('created_at', { ascending: true }),
  );
}

export async function uploadAttachment(userId: string, todoItemId: string, file: File): Promise<TodoAttachmentRow> {
  const path = `${userId}/${todoItemId}/${Date.now()}_${file.name}`;
  const { error: upErr } = await supabase.storage.from('todo-attachments').upload(path, file);
  if (upErr) throw new Error(upErr.message);
  const { data: { publicUrl } } = supabase.storage.from('todo-attachments').getPublicUrl(path);

  return unwrap(
    await supabase
      .from('todo_attachments')
      .insert({
        todo_item_id: todoItemId,
        user_id: userId,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        mime_type: file.type || null,
      })
      .select()
      .single(),
  );
}

export async function deleteAttachment(attachment: Pick<TodoAttachmentRow, 'id' | 'file_url'>): Promise<void> {
  const marker = '/todo-attachments/';
  const idx = attachment.file_url.indexOf(marker);
  if (idx !== -1) {
    const path = attachment.file_url.slice(idx + marker.length);
    await supabase.storage.from('todo-attachments').remove([path]);
  }
  const { error } = await supabase.from('todo_attachments').delete().eq('id', attachment.id);
  if (error) throw new Error(error.message);
}

// ── Weekly Task Review (Sunday inbox/section triage in WeeklyReviewModal) ──
// Distinct from the goal/KPI "Refleksja tygodnia" in the Tydzień tab (goalSpine.mutations.completeWeeklyReview).
const TASK_REVIEW_SOURCE = 'todo';
const TASK_REVIEW_KIND = 'weekly_review';

/** Warsaw date (YYYY-MM-DD) of the last completed weekly task review, or null if never done. */
export async function fetchLatestTaskReviewDate(userId: string): Promise<string | null> {
  const data = await unwrapMaybe<{ metadata: Record<string, unknown> }>(
    await supabase
      .from('vanguard_stream')
      .select('metadata')
      .eq('user_id', userId)
      .eq('source', TASK_REVIEW_SOURCE)
      .eq('metadata->>kind', TASK_REVIEW_KIND)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  const metadata = data?.metadata as Record<string, unknown> | null;
  return typeof metadata?.date === 'string' ? metadata.date : null;
}

/** Canonical write path for weekly task review completion — keep in sync with fetchLatestTaskReviewDate. */
export async function logTaskReviewCompleted(userId: string, note: string): Promise<void> {
  const date = getTodayWarsaw();
  const { error } = await supabase.from('vanguard_stream').insert({
    user_id: userId,
    source: TASK_REVIEW_SOURCE,
    content: `Tygodniowy Przegląd Zadań zakończony: ${note}`,
    metadata: { kind: TASK_REVIEW_KIND, date, note },
  });
  if (error) throw new Error(error.message);
}

export async function deleteTodoSection(sectionId: string): Promise<void> {
  const { error } = await supabase
    .from('todo_sections')
    .delete()
    .eq('id', sectionId);
  if (error) throw error;
}
