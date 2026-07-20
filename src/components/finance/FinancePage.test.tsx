import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import FinancePage from './FinancePage';

vi.mock('../../store/useStore', () => ({
  useStore: (sel: (s: { session: null }) => unknown) => sel({ session: null }),
}));

vi.mock('./useFinancePageData', () => ({
  useFinancePageData: () => ({
    bundleQuery: { isLoading: false, error: null },
    coinPricesQuery: { data: undefined, isFetching: false },
    data: undefined,
    metrics: null,
  }),
}));

vi.mock('../../lib/financeApi', () => ({
  useFinanceMutations: () => ({}),
}));

describe('FinancePage', () => {
  it('shows login gate without session', () => {
    render(
      <MemoryRouter>
        <FinancePage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Zaloguj się/)).toBeInTheDocument();
  });
});
