import { supabase } from './supabase';
import { createTodoItem } from './todo';
import { unwrap } from './supabaseUtils';
import type { Note } from '../components/notes/keepUtils';

export const POCKET_CATEGORIES = ['Kariera', 'Zdrowie', 'Technologia', 'Biznes', 'Inne'] as const;

export interface LinkCaptureFields {
  id?: string;
  url: string;
  title: string;
  description?: string | null;
  takeaways?: string[] | null;
  notes?: string | null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlToPlainText(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent?.replace(/\s+/g, ' ').trim() || '';
}

export function formatLinkTodoNotes(link: LinkCaptureFields): string {
  const lines = [link.url];
  if (link.takeaways?.length) {
    lines.push('', 'Wnioski:', ...link.takeaways.map((t) => `• ${t}`));
  }
  if (link.description?.trim()) lines.push('', link.description.trim());
  if (link.notes?.trim()) lines.push('', link.notes.trim());
  if (link.id) lines.push('', `source:link:${link.id}`);
  return lines.join('\n').trim();
}

export function buildLinkNoteContent(link: LinkCaptureFields): string {
  const parts = [
    `<p><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.title || link.url)}</a></p>`,
  ];
  if (link.takeaways?.length) {
    parts.push(`<ul>${link.takeaways.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`);
  }
  if (link.description?.trim()) {
    parts.push(`<p>${escapeHtml(link.description.trim())}</p>`);
  }
  if (link.notes?.trim()) {
    parts.push(`<p><em>${escapeHtml(link.notes.trim())}</em></p>`);
  }
  return parts.join('');
}

export async function convertNoteToTodoItem(
  userId: string,
  note: Pick<Note, 'id' | 'title' | 'content'>,
  archive = true,
) {
  const plain = htmlToPlainText(note.content);
  const title = note.title?.trim() || plain.slice(0, 60) || 'Notatka';
  const notes = plain ? `${plain}\n\nsource:note:${note.id}` : `source:note:${note.id}`;
  const item = await createTodoItem(userId, { title, notes });
  if (archive) {
    await supabase
      .from('vanguard_notes')
      .update({ is_archived: true, is_pinned: false })
      .eq('id', note.id)
      .eq('user_id', userId);
  }
  return item;
}

export async function convertLinkToTodoItem(userId: string, link: LinkCaptureFields) {
  const item = await createTodoItem(userId, {
    title: link.title?.trim() || link.url,
    notes: formatLinkTodoNotes(link),
  });
  if (link.id) {
    await supabase
      .from('vanguard_links')
      .update({ status: 'read', updated_at: new Date().toISOString() })
      .eq('id', link.id)
      .eq('user_id', userId);
  }
  return item;
}

export async function convertLinkToKeepNote(userId: string, link: LinkCaptureFields) {
  const note = unwrap(
    await supabase
      .from('vanguard_notes')
      .insert({
        user_id: userId,
        title: link.title?.trim() || link.url,
        content: buildLinkNoteContent(link),
        color: 'default',
        is_pinned: false,
        is_archived: false,
        tags: link.id ? [`link:${link.id}`] : [],
      })
      .select()
      .single(),
  );
  if (link.id) {
    await supabase
      .from('vanguard_links')
      .update({ status: 'read', updated_at: new Date().toISOString() })
      .eq('id', link.id)
      .eq('user_id', userId);
  }
  return note;
}

export function extractUncheckedKeepItems(html: string): string[] {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const items: string[] = [];
  doc.querySelectorAll('.keep-todo-item').forEach((el) => {
    const checkbox = el.querySelector('.keep-todo-checkbox');
    const text = el.querySelector('.keep-todo-text')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (!text || checkbox?.classList.contains('checked')) return;
    items.push(text);
  });
  return items;
}

export async function exportNoteChecklistsToTodos(
  userId: string,
  note: Pick<Note, 'id' | 'title' | 'content'>,
) {
  const titles = extractUncheckedKeepItems(note.content);
  if (!titles.length) throw new Error('Brak niezaznaczonych punktów na liście');
  const created = [];
  for (const title of titles) {
    created.push(await createTodoItem(userId, { title, notes: `source:note:${note.id}` }));
  }
  return created;
}
