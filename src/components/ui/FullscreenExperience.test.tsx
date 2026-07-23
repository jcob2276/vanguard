import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FullscreenExperience from './FullscreenExperience';

describe('FullscreenExperience', () => {
  it('provides a labelled modal surface controlled by the central class', () => {
    render(
      <FullscreenExperience label="Pomiar wzroku" tone="light">
        Narzędzie
      </FullscreenExperience>,
    );

    const surface = screen.getByRole('dialog', { name: 'Pomiar wzroku' });
    expect(surface).toHaveClass('ios-fullscreen-experience');
    expect(surface).toHaveAttribute('aria-modal', 'true');
  });
});
