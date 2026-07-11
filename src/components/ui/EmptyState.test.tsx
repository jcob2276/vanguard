// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders icon and label', () => {
    render(<EmptyState icon="📝" label="Brak notatek" />);
    expect(screen.getByText('📝')).toBeInTheDocument();
    expect(screen.getByText('Brak notatek')).toBeInTheDocument();
  });

  it('does not render an action button when none is passed', () => {
    render(<EmptyState icon="📝" label="Brak notatek" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders an action button and fires onClick', () => {
    const onClick = vi.fn();
    render(<EmptyState icon="📝" label="Brak notatek" action={{ label: 'Dodaj', onClick }} />);
    const button = screen.getByRole('button', { name: 'Dodaj' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
