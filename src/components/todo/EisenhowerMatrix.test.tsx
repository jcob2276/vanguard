import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EisenhowerMatrix from './EisenhowerMatrix';

vi.mock('../../lib/todo/todo', () => ({
  updateTodoItem: vi.fn().mockResolvedValue(undefined),
}));

const makeItem = (overrides: Partial<Parameters<typeof EisenhowerMatrix>[0]['items'][0]> = {}) => ({
  id: 'item-1',
  title: 'Kupić mleko',
  priority: 'high',
  is_important: true,
  due_date: null,
  status: 'open',
  duration_minutes: null,
  ...overrides,
});

describe('EisenhowerMatrix', () => {
  it('renders items in the correct quadrant based on priority + importance', () => {
    const items = [
      makeItem({ id: '1', title: 'Q1 task', priority: 'urgent', is_important: true }),
      makeItem({ id: '2', title: 'Q2 task', priority: 'high', is_important: true }),
      makeItem({ id: '3', title: 'Q3 task', priority: 'urgent', is_important: false }),
      makeItem({ id: '4', title: 'Q4 task', priority: 'low', is_important: false }),
    ];
    render(<EisenhowerMatrix items={items} setItems={vi.fn()} />);

    expect(screen.getByText('Q1 task')).toBeInTheDocument();
    expect(screen.getByText('Q2 task')).toBeInTheDocument();
    expect(screen.getByText('Q3 task')).toBeInTheDocument();
    expect(screen.getByText('Q4 task')).toBeInTheDocument();
  });

  it('does not render items with status !== "open"', () => {
    const items = [
      makeItem({ id: '1', title: 'Done task', status: 'done' }),
      makeItem({ id: '2', title: 'Open task', status: 'open' }),
    ];
    render(<EisenhowerMatrix items={items} setItems={vi.fn()} />);

    expect(screen.queryByText('Done task')).not.toBeInTheDocument();
    expect(screen.getByText('Open task')).toBeInTheDocument();
  });

  it('shows quadrant labels', () => {
    render(<EisenhowerMatrix items={[]} setItems={vi.fn()} />);

    expect(screen.getByText('Zrób teraz')).toBeInTheDocument();
    expect(screen.getByText('Zaplanuj')).toBeInTheDocument();
    expect(screen.getByText('Deleguj')).toBeInTheDocument();
    expect(screen.getByText('Eliminuj')).toBeInTheDocument();
  });

  it('shows the task title without cryptic quick-move controls', () => {
    const item = makeItem({ id: '1', title: 'Pełna nazwa zadania', priority: 'urgent' });

    render(<EisenhowerMatrix items={[item]} setItems={vi.fn()} />);

    expect(screen.getByText('Pełna nazwa zadania')).toBeInTheDocument();
    expect(screen.queryByTitle(/Przenieś do:/)).not.toBeInTheDocument();
  });

  it('shows item count badge when quadrant has items', () => {
    const items = [
      makeItem({ id: '1', priority: 'urgent', is_important: true }),
      makeItem({ id: '2', priority: 'urgent', is_important: true }),
    ];
    render(<EisenhowerMatrix items={items} setItems={vi.fn()} />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows an empty-state label in empty quadrants', () => {
    render(<EisenhowerMatrix items={[]} setItems={vi.fn()} />);

    expect(screen.getAllByText('Brak zadań')).toHaveLength(4);
  });
});
