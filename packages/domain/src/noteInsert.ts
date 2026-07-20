import { firstLineTitle } from './notes.ts';

export interface BuildNoteInsertInput {
  user_id: string;
  content: string;
  title?: string | null;
  tags?: string[] | null;
  is_pinned?: boolean | null;
  is_archived?: boolean | null;
  color?: string | null;
}

/** Shared insert payload for vanguard_notes (app + Telegram). */
export function buildNoteInsertRow(input: BuildNoteInsertInput): Record<string, unknown> {
  const content = input.content.trim();
  if (!content) throw new Error('Pusta notatka.');

  const title = (input.title?.trim() || firstLineTitle(content) || 'Notatka').slice(0, 200);

  const row: Record<string, unknown> = {
    user_id: input.user_id,
    title,
    content,
    tags: Array.isArray(input.tags) ? input.tags : [],
  };

  if (input.is_pinned != null) row.is_pinned = input.is_pinned;
  if (input.is_archived != null) row.is_archived = input.is_archived;
  if (input.color != null) row.color = input.color;

  return row;
}
