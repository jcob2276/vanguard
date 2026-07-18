import { describe, expect, it } from 'vitest';
import { sourceNoteId } from './captureBridge';

describe('sourceNoteId', () => {
  it('reads only a valid note source marker', () => {
    expect(sourceNoteId('Opis\n\nsource:note:123e4567-e89b-12d3-a456-426614174000'))
      .toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(sourceNoteId('source:link:123e4567-e89b-12d3-a456-426614174000')).toBeNull();
  });
});
