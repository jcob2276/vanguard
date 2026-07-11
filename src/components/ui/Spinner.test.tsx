// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Spinner from './Spinner';

describe('Spinner', () => {
  it('renders with default md size and a11y role', () => {
    render(<Spinner />);
    const el = screen.getByRole('status');
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('h-8');
  });

  it('applies sm size class', () => {
    render(<Spinner size="sm" />);
    expect(screen.getByRole('status').className).toContain('h-4');
  });

  it('applies lg size class', () => {
    render(<Spinner size="lg" />);
    expect(screen.getByRole('status').className).toContain('h-12');
  });
});
