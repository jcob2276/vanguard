// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Skeleton from './Skeleton';

describe('Skeleton', () => {
  it('renders text variant with 3 default lines', () => {
    const { container } = render(<Skeleton />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBe(3);
  });

  it('renders correct number of lines for text variant', () => {
    const { container } = render(<Skeleton lines={5} />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBe(5);
  });

  it('renders avatar variant with avatar and text placeholders', () => {
    const { container } = render(<Skeleton variant="avatar" />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBe(3);
    const avatar = container.querySelector('.rounded-full');
    expect(avatar).toBeTruthy();
  });

  it('renders card variant with title and content lines', () => {
    const { container } = render(<Skeleton variant="card" lines={2} />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBe(3);
    const card = container.querySelector('.rounded-\\[var\\(--radius-lg\\)\\]');
    expect(card).toBeTruthy();
  });
});
