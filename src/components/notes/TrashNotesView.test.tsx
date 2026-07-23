import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Note } from '../../lib/notesApi';
import TrashNotesView from './TrashNotesView';

const trashedNote: Note = {
  id: 'note-1',
  user_id: 'user-1',
  title: 'Usunięta notatka',
  content: '<p>Treść</p>',
  color: 'default',
  is_pinned: false,
  is_archived: false,
  tags: [],
  created_at: '2026-07-23T08:00:00.000Z',
  updated_at: '2026-07-23T09:00:00.000Z',
  deleted_at: '2026-07-23T10:00:00.000Z',
  folder_id: null,
  is_locked: false,
  locked_payload: null,
  lock_salt: null,
  lock_iv: null,
};

describe('TrashNotesView', () => {
  it('shows an empty state', () => {
    render(<TrashNotesView notes={[]} loading={false} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />);
    expect(screen.getByText('Kosz jest pusty')).toBeInTheDocument();
  });

  it('allows restoring a trashed note', () => {
    const onRestore = vi.fn().mockResolvedValue(undefined);
    render(
      <TrashNotesView
        notes={[trashedNote]}
        loading={false}
        onRestore={onRestore}
        onPermanentDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle('Przywróć notatkę'));
    expect(onRestore).toHaveBeenCalledWith('note-1');
  });
});
