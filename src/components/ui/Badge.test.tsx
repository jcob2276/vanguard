// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Badge from './Badge';

describe('Badge', () => {
  it('renders count variant with number', () => {
    render(<Badge count={5} />);
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('renders 99+ for counts over 99', () => {
    render(<Badge count={150} />);
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('returns null when count is undefined', () => {
    const { container } = render(<Badge />);
    expect(container.innerHTML).toBe('');
  });

  it('renders dot variant', () => {
    const { container } = render(<Badge variant="dot" />);
    const dot = container.querySelector('.rounded-full');
    expect(dot).toBeTruthy();
  });

  it('renders tag variant with children', () => {
    render(<Badge variant="tag">Active</Badge>);
    expect(screen.getByText('Active')).toBeTruthy();
  });
});
