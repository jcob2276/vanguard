import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import type { Note } from './notesApi';
import { buildNotesArchive, noteAsText } from './notesExport';

vi.mock('./noteAttachmentsApi', () => ({
  listUserNoteAttachments: vi.fn().mockResolvedValue([]),
  downloadNoteAttachmentFile: vi.fn(),
}));

const note: Note = {
  id: 'note-1',
  user_id: 'user-1',
  title: 'Plan podróży',
  content: '<p>Lot do Gdańska</p>',
  color: 'default',
  is_pinned: false,
  is_archived: false,
  tags: ['wakacje'],
  created_at: '2026-07-23T08:00:00.000Z',
  updated_at: '2026-07-23T09:00:00.000Z',
  deleted_at: null,
  folder_id: null,
  is_locked: false,
  locked_payload: null,
  lock_salt: null,
  lock_iv: null,
};

describe('notes export', () => {
  it('creates readable text without HTML markup', () => {
    expect(noteAsText(note)).toContain('Lot do Gdańska');
    expect(noteAsText(note)).not.toContain('<p>');
  });

  it('creates a ZIP with a manifest and note text', async () => {
    const blob = await buildNotesArchive('user-1', [note], []);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    expect(zip.file('manifest.json')).not.toBeNull();
    const noteFile = Object.keys(zip.files).find(path => path.startsWith('notes/') && path.endsWith('.txt'));
    expect(noteFile).toBeTruthy();
    await expect(zip.file(noteFile!)!.async('string')).resolves.toContain('Plan podróży');
  });
});
