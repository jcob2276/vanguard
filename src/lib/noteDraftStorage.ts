import type { Note } from './notesApi';

export type EmergencyNoteDraft = Pick<
  Note,
  'title' | 'content' | 'color' | 'tags' | 'folder_id'
>;

const draftKey = (noteId: string) => `vanguard_note_draft:${noteId}`;

export function saveEmergencyNoteDraft(noteId: string, draft: EmergencyNoteDraft): void {
  try {
    localStorage.setItem(draftKey(noteId), JSON.stringify(draft));
  } catch {
    // The editor still keeps the draft in memory when storage is unavailable.
  }
}

export function removeEmergencyNoteDraft(noteId: string): void {
  try {
    localStorage.removeItem(draftKey(noteId));
  } catch {
    // Storage cleanup is best effort.
  }
}
