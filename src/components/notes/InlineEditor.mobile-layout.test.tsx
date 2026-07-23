// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Note } from './keepUtils';
import InlineEditor from './InlineEditor';

vi.mock('../../store/useStore', () => ({ useUserId: () => 'user-1' }));
vi.mock('./RichEditor', () => ({
  default: () => <div data-testid="rich-editor">Długa treść notatki</div>,
}));
vi.mock('./NoteAttachments', () => ({
  default: () => <section data-testid="note-attachments">Załączniki</section>,
}));
vi.mock('./NoteEditorMoreMenu', () => ({ default: () => null }));
vi.mock('./NoteSaveIndicator', () => ({ default: () => null }));
vi.mock('./useNoteDraftAutosave', () => ({
  useNoteDraftAutosave: ({ note }: { note: Note }) => ({
    content: note.content,
    color: note.color,
    folder_id: note.folder_id,
    saveStatus: 'saved',
    flush: vi.fn(),
    flushAndWait: vi.fn(),
    retrySave: vi.fn(),
    setContent: vi.fn(),
    setColor: vi.fn(),
    setFolderId: vi.fn(),
  }),
}));

const note = {
  id: 'note-1',
  user_id: 'user-1',
  title: 'Notatka',
  content: '<p>Długa treść notatki</p>',
  tags: [],
  color: 'default',
  is_pinned: false,
  is_archived: false,
  is_locked: false,
  deleted_at: null,
  folder_id: null,
  locked_payload: null,
  lock_salt: null,
  lock_iv: null,
  created_at: '2026-07-23T10:00:00Z',
  updated_at: '2026-07-23T10:00:00Z',
} satisfies Note;

describe('InlineEditor mobile layout', () => {
  it('lets long editor content determine its own flow height before attachments', () => {
    render(
      <InlineEditor
        note={note}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onTogglePin={vi.fn()}
        busy={false}
        isMobile
      />,
    );

    const contentFlow = screen.getByTestId('rich-editor').parentElement;

    expect(contentFlow).toHaveClass('flex-none');
    expect(contentFlow).not.toHaveClass('flex-1');
    expect(screen.getByTestId('note-attachments')).toBeInTheDocument();
  });
});
