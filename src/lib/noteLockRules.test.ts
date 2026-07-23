import { describe, expect, it } from 'vitest';
import { getNoteLockBlockReason } from './noteLockRules';
import type { Note } from './notesApi';

const note = {
  tags: [],
  attachment_names: [],
} as unknown as Note;

describe('getNoteLockBlockReason', () => {
  it('allows plain notes, images and document scans', () => {
    expect(getNoteLockBlockReason(note)).toBeNull();
    expect(getNoteLockBlockReason({ ...note, attachment_names: ['photo.jpg', 'skan-123.pdf'] })).toBeNull();
  });

  it('blocks tags, audio, PDF and document attachments like Apple Notes', () => {
    expect(getNoteLockBlockReason({ ...note, tags: ['private'] })).toMatch(/tag/i);
    expect(getNoteLockBlockReason({ ...note, attachment_names: ['voice.webm'] })).toMatch(/załącznik/i);
    expect(getNoteLockBlockReason({ ...note, attachment_names: ['invoice.pdf'] })).toMatch(/załącznik/i);
  });
});
