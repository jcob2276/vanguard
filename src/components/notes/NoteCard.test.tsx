// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NoteCard from './NoteCard';
import type { Note } from './keepUtils';

describe('NoteCard', () => {
  it('does not turn the selected grid card into a legacy editing overlay', () => {
    const note = {
      id: 'note-1',
      user_id: 'user-1',
      title: 'Notatka próbna',
      content: '<p>Treść</p>',
      tags: [],
      color: 'green',
      is_pinned: false,
      is_archived: false,
      is_locked: false,
      deleted_at: null,
      folder_id: null,
      locked_payload: null,
      lock_salt: null,
      lock_iv: null,
      created_at: '2026-07-16T10:00:00Z',
      updated_at: '2026-07-16T10:00:00Z',
    } satisfies Note;

    render(
      <NoteCard
        note={note}
        onDelete={vi.fn()}
        onTogglePin={vi.fn()}
        onUpdate={vi.fn()}
        busy={false}
        isEditing
        onOpen={vi.fn()}
        onDragStart={vi.fn()}
        onDragEnter={vi.fn()}
        onDragEnd={vi.fn()}
        onDragOver={vi.fn()}
        isDragOver={false}
      />,
    );

    expect(screen.getByText('Notatka próbna').closest('.keep-card')).not.toHaveClass('editing');
  });
});
