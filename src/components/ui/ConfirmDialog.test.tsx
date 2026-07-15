// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ConfirmDialog from './ConfirmDialog';
import { confirmDialog } from '../../lib/notify';

describe('ConfirmDialog', () => {
  it('renders nothing when no confirmation is pending', () => {
    render(<ConfirmDialog />);
    expect(screen.queryByText(/.+/)).not.toBeInTheDocument();
  });

  it('shows the message and resolves true on OK', async () => {
    render(<ConfirmDialog />);
    let resultPromise!: Promise<boolean>;
    act(() => {
      resultPromise = confirmDialog('Na pewno usunąć?');
    });
    await waitFor(() => expect(screen.getByText('Na pewno usunąć?')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await expect(resultPromise).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByText('Na pewno usunąć?')).not.toBeInTheDocument());
  });

  it('resolves false on Anuluj', async () => {
    render(<ConfirmDialog />);
    let resultPromise!: Promise<boolean>;
    act(() => {
      resultPromise = confirmDialog('Usunąć projekt?');
    });
    await waitFor(() => expect(screen.getByText('Usunąć projekt?')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
    await expect(resultPromise).resolves.toBe(false);
  });
});

