// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Tabs from './Tabs';

const tabs = [
  { key: 'a', label: 'Tab A' },
  { key: 'b', label: 'Tab B' },
  { key: 'c', label: 'Tab C' },
];

describe('Tabs', () => {
  it('renders all tab labels', () => {
    render(<Tabs tabs={tabs} active="a" onChange={() => {}} />);
    expect(screen.getByText('Tab A')).toBeTruthy();
    expect(screen.getByText('Tab B')).toBeTruthy();
    expect(screen.getByText('Tab C')).toBeTruthy();
  });

  it('calls onChange with the clicked tab key', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} active="a" onChange={onChange} />);
    fireEvent.click(screen.getByText('Tab B'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('applies active class to the selected tab', () => {
    render(<Tabs tabs={tabs} active="b" onChange={() => {}} />);
    const buttons = screen.getAllByRole('button');
    const activeBtn = buttons[1];
    expect(activeBtn.className).toContain('bg-background');
    expect(activeBtn.className).toContain('text-text-primary');
  });
});
