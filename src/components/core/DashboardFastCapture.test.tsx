import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Search } from 'lucide-react';
import { DashboardFastCaptureMenu } from './DashboardFastCapture';

describe('DashboardFastCaptureMenu', () => {
  it('uses the canonical dialog and closes after an action', () => {
    const action = vi.fn();
    const onClose = vi.fn();
    render(
      <DashboardFastCaptureMenu
        show
        onClose={onClose}
        items={[{ label: 'Jedzenie', emoji: '🍎', color: 'red', action }]}
        tools={[{ label: 'Szukaj', icon: Search, action: vi.fn() }]}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Szybkie akcje' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Jedzenie' }));
    expect(action).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
