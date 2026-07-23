import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { promptDialog } from '../../lib/notify';
import PromptDialog from './PromptDialog';

describe('PromptDialog', () => {
  it('resolves with the entered value', async () => {
    render(<PromptDialog />);
    const result = promptDialog('Adres');
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'https://example.com' } });
    fireEvent.click(screen.getByText('OK'));
    await expect(result).resolves.toBe('https://example.com');
  });
});
