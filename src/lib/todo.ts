import { supabase } from './supabase';

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

export async function listTodoSections(userId) {
  return unwrap(
    await supabase
      .from('todo_sections')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  );
}

export async function listTodoItems(userId) {
  return unwrap(
    await supabase
      .from('todo_items')
      .select('*')
      .eq('user_id', userId)
      .order('status', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
  );
}

export async function createTodoSection(userId, name, sortOrder = 999) {
  return unwrap(
    await supabase
      .from('todo_sections')
      .insert({ user_id: userId, name: name.trim(), sort_order: sortOrder })
      .select()
      .single(),
  );
}

export async function createTodoItem(userId, fields) {
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

export async function updateTodoItem(id, patch) {
  return unwrap(
    await supabase
      .from('todo_items')
      .update(patch)
      .eq('id', id)
      .select()
      .single(),
  );
}

export async function setTodoStatus(item, status) {
  return updateTodoItem(item.id, {
    status,
    completed_at: status === 'done' ? new Date().toISOString() : null,
  });
}

export async function archiveTodoSection(id) {
  return unwrap(
    await supabase
      .from('todo_sections')
      .update({ is_archived: true })
      .eq('id', id)
      .select()
      .single(),
  );
}
