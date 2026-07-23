import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note } from './keepUtils';
import { useNoteDraftAutosave } from './useNoteDraftAutosave';

const makeNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1',
  user_id: 'user-1',
  title: 'Title',
  content: '<p>Body</p>',
  color: 'default',
  is_pinned: false,
  is_archived: false,
  tags: ['work'],
  created_at: '2026-07-23T08:00:00.000Z',
  updated_at: '2026-07-23T08:00:00.000Z',
  deleted_at: null,
  folder_id: null,
  is_locked: false,
  locked_payload: null,
  lock_salt: null,
  lock_iv: null,
  ...overrides,
});

describe('useNoteDraftAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('saves a changed draft after the debounce delay', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useNoteDraftAutosave({
      note: makeNote(),
      onSave,
      delay: 1_000,
    }));

    act(() => result.current.setContent('<h1>Updated title</h1><p>Body #work </p>'));
    act(() => vi.advanceTimersByTime(999));
    expect(onSave).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onSave).toHaveBeenCalledWith('note-1', {
      title: 'Updated title',
      content: '<h1>Updated title</h1><p>Body #work </p>',
      color: 'default',
      folder_id: null,
      tags: ['work'],
    });
    expect(result.current.saveStatus).toBe('saved');
  });

  it('flushes the old draft before switching notes', () => {
    const onSave = vi.fn();
    const first = makeNote();
    const second = makeNote({ id: 'note-2', title: 'Second', tags: [] });
    const { result, rerender } = renderHook(
      ({ note }) => useNoteDraftAutosave({ note, onSave, delay: 1_000 }),
      { initialProps: { note: first } },
    );

    act(() => result.current.setContent('<p>Changed</p>'));
    rerender({ note: second });

    expect(onSave).toHaveBeenCalledWith('note-1', {
      title: 'Changed',
      content: '<p>Changed</p>',
      color: 'default',
      folder_id: null,
      tags: [],
    });
    expect(result.current.title).toBe('Second');
    expect(result.current.content).toBe('<h1>Second</h1><p>Body</p>');
  });

  it('does not save an unchanged draft on unmount', () => {
    const onSave = vi.fn();
    const { unmount } = renderHook(() => useNoteDraftAutosave({
      note: makeNote(),
      onSave,
      delay: 1_000,
    }));

    unmount();

    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps a failed draft dirty and allows retrying the save', async () => {
    const onSave = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useNoteDraftAutosave({
      note: makeNote(),
      onSave,
      delay: 1_000,
    }));

    act(() => result.current.setContent('<h1>Needs retry</h1><p>Body #work </p>'));
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(result.current.saveStatus).toBe('error');
    expect(JSON.parse(localStorage.getItem('vanguard_note_draft:note-1') || 'null')).toEqual(
      expect.objectContaining({ title: 'Needs retry' }),
    );

    await act(async () => {
      result.current.retrySave();
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(result.current.saveStatus).toBe('saved');
    expect(localStorage.getItem('vanguard_note_draft:note-1')).toBeNull();
  });

  it('serializes saves and sends the newest draft after an in-flight save', async () => {
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const onSave = vi.fn()
      .mockImplementationOnce(() => new Promise<void>(resolve => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise<void>(resolve => { resolveSecond = resolve; }));
    const { result } = renderHook(() => useNoteDraftAutosave({
      note: makeNote(),
      onSave,
      delay: 1_000,
    }));

    act(() => result.current.setContent('<p>Version A</p>'));
    act(() => vi.advanceTimersByTime(1_000));
    expect(onSave).toHaveBeenCalledTimes(1);

    act(() => result.current.setContent('<p>Version B</p>'));
    act(() => vi.advanceTimersByTime(1_000));
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst();
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith('note-1', expect.objectContaining({
      content: '<p>Version B</p>',
    }));
    expect(result.current.saveStatus).toBe('saving');

    await act(async () => {
      resolveSecond();
      await Promise.resolve();
    });
    expect(result.current.saveStatus).toBe('saved');
  });
});
