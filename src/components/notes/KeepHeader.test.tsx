import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import KeepHeader from './KeepHeader';

describe('KeepHeader', () => {
  it('offers Apple Notes list and gallery views', () => {
    render(
      <KeepHeader
        onBack={vi.fn()}
        viewMode="list"
        setViewMode={vi.fn()}
        search=""
        setSearch={vi.fn()}
        onExport={vi.fn()}
        exporting={false}
      />,
    );

    expect(screen.getByText('Lista')).toBeInTheDocument();
    expect(screen.getByText('Galeria')).toBeInTheDocument();
    expect(screen.queryByText('Podział')).not.toBeInTheDocument();
  });
});
