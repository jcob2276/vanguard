import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InsightCard } from './InsightCard';

vi.mock('../cards/CardFactory', () => ({
  CardFactory: () => <div>Treść karty</div>,
}));

describe('InsightCard context actions', () => {
  afterEach(() => vi.useRealTimers());

  it('opens actions in the canonical dialog after a long press', () => {
    vi.useFakeTimers();
    render(
      <InsightCard
        card={{
          id: 'insight-1',
          templateId: 'text',
          title: 'Wniosek',
          widgetData: {},
          isPinned: false,
          sortOrder: 0,
        }}
        onPin={vi.fn()}
      />,
    );

    fireEvent.mouseDown(screen.getByText('Treść karty'));
    act(() => vi.advanceTimersByTime(550));

    expect(screen.getByRole('dialog', { name: 'Akcje wniosku' })).toBeInTheDocument();
  });
});
