import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearActionHistory,
  redoLastAction,
  registerReversibleAction,
  subscribeActionHistory,
  undoLastAction,
} from './actionHistory';

describe('actionHistory', () => {
  beforeEach(clearActionHistory);

  it('undoes and redoes the latest reversible action', async () => {
    const undo = vi.fn();
    const redo = vi.fn();
    registerReversibleAction({ label: 'Zmiana terminu', undo, redo });

    expect(await undoLastAction()).toBe(true);
    expect(undo).toHaveBeenCalledOnce();
    expect(await redoLastAction()).toBe(true);
    expect(redo).toHaveBeenCalledOnce();
  });

  it('publishes labels and clears redo after a new action', async () => {
    const snapshots: Array<{ undoLabel: string | null; redoLabel: string | null }> = [];
    const unsubscribe = subscribeActionHistory(({ undoLabel, redoLabel }) => {
      snapshots.push({ undoLabel, redoLabel });
    });

    registerReversibleAction({ label: 'Pierwsza', undo: vi.fn(), redo: vi.fn() });
    await undoLastAction();
    registerReversibleAction({ label: 'Druga', undo: vi.fn() });

    expect(snapshots.at(-1)).toEqual({ undoLabel: 'Druga', redoLabel: null });
    unsubscribe();
  });
});

