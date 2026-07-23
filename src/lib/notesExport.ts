import JSZip from 'jszip';
import type { NoteFolder } from './noteFoldersApi';
import type { Note } from './notesApi';
import { downloadNoteAttachmentFile, listUserNoteAttachments } from './noteAttachmentsApi';
import { getPlainText } from './noteText';
import { getTodayWarsaw } from './date';

const safeName = (value: string) => (
  value.normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'notatka'
);

export const noteAsText = (note: Note, folderName?: string): string => [
  note.title || 'Bez tytułu',
  '',
  folderName ? `Folder: ${folderName}` : null,
  note.tags.length ? `Tagi: ${note.tags.join(', ')}` : null,
  `Utworzono: ${note.created_at}`,
  `Zmieniono: ${note.updated_at}`,
  '',
  getPlainText(note.content),
].filter(line => line !== null).join('\n');

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportSingleNote(note: Note, folder?: NoteFolder): void {
  const text = noteAsText(note, folder?.name);
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${safeName(note.title)}.txt`);
}

export async function buildNotesArchive(
  userId: string,
  notes: Note[],
  folders: NoteFolder[],
): Promise<Blob> {
  const zip = new JSZip();
  const folderNames = new Map(folders.map(folder => [folder.id, folder.name]));
  zip.file('manifest.json', JSON.stringify({
    exported_at: new Date().toISOString(),
    notes,
    folders,
  }, null, 2));

  for (const note of notes) {
    zip.file(
      `notes/${safeName(note.title)}-${note.id}.txt`,
      noteAsText(note, note.folder_id ? folderNames.get(note.folder_id) : undefined),
    );
  }

  const attachments = await listUserNoteAttachments(userId);
  const unlockedIds = new Set(notes.filter(note => !note.is_locked).map(note => note.id));
  for (const attachment of attachments.filter(item => unlockedIds.has(item.note_id))) {
    const file = await downloadNoteAttachmentFile(attachment.storage_path);
    zip.file(`attachments/${attachment.note_id}/${safeName(attachment.file_name)}`, file);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function exportNotesArchive(
  userId: string,
  notes: Note[],
  folders: NoteFolder[],
): Promise<void> {
  const blob = await buildNotesArchive(userId, notes, folders);
  downloadBlob(blob, `vanguard-notatki-${getTodayWarsaw()}.zip`);
}
