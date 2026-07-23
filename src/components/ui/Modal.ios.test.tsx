import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

describe('Modal iOS interaction contract', () => {
  it('moves focus into the dialog and restores it when closed', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = render(
      <Modal isOpen onClose={() => undefined} title="Edycja">
        <button>Akcja</button>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);

    rerender(
      <Modal isOpen={false} onClose={() => undefined} title="Edycja">
        <button>Akcja</button>
      </Modal>,
    );
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('traps tab navigation and closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Edycja">
        <button>Pierwsza</button>
        <button>Druga</button>
      </Modal>,
    );

    const close = screen.getByRole('button', { name: 'Zamknij' });
    close.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Druga' }));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
