import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Sheet from './Sheet';

describe('Sheet iOS interaction contract', () => {
  it('renders a labelled grab handle and modal dialog', () => {
    render(
      <Sheet open onOpenChange={() => undefined} title="Opcje" side="bottom">
        Treść
      </Sheet>,
    );

    expect(screen.getByRole('dialog', { name: 'Opcje' })).toBeInTheDocument();
    expect(screen.getByLabelText('Przeciągnij, aby zamknąć')).toBeInTheDocument();
  });
});
