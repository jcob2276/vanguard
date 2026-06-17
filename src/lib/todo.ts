import { supabase } from './supabase';
import type { Database } from './database.types';

type TodoItemRow = Database['public']['Tables']['todo_items']['Row'];
type TodoItemUpdate = Database['public']['Tables']['todo_items']['Update'];
type TodoSectionRow = Database['public']['Tables']['todo_sections']['Row'];

function unwrap<T>({ data, error }: { data: T | null; error: any }): T {
  if (error) throw new Error(error.message);
  if (!data) throw new Error('No data returned');
  return data;
}

function unwrapList<T>({ data, error }: { data: T[] | null; error: any }): T[] {
  if (error) throw new Error(error.message);
  return data || [];
}

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
  recurrence?: string;
  section_id?: string;
}

export async function createTodoItem(userId: string, fields: CreateTodoItemFields): Promise<TodoItemRow> {
  const tags = String(fields.tagsText || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return unwrap(
    await supabase
      .from('todo_items')
      .insert({
        user_id: userId,
        section_id: fields.section_id || null,
        title: fields.title.trim(),
        notes: fields.notes?.trim() || null,
        priority: fields.priority || 'normal',
        tags,
        due_date: fields.due_date || null,
        recurrence: fields.recurrence || null,
      })
      .select()
      .single(),
  );
}

export async function updateTodoItem(id: string, patch: TodoItemUpdate): Promise<TodoItemRow> {
  return unwrap(
    await supabase
      .from('todo_items')
      .update(patch)
      .eq('id', id)
      .select()
      .single(),
  );
}

export async function setTodoStatus(item: { id: string }, status: string): Promise<TodoItemRow> {
  return updateTodoItem(item.id, {
    status,
    completed_at: status === 'done' ? new Date().toISOString() : null,
  });
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
  return unwrap(
    await supabase
      .from('todo_sections')
      .update({ is_archived: true })
      .eq('id', id)
      .select()
      .single(),
  );
}
