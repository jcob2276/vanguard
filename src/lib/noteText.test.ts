// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { canonicalizeNoteContent, deriveNoteMetadata, getPlainText } from './noteText';

describe('noteText', () => {
  it('uses the first non-empty document line as the title', () => {
    expect(deriveNoteMetadata('<p><br></p><h1>Plan tygodnia</h1><p>Treść</p>').title)
      .toBe('Plan tygodnia');
  });

  it('derives unique inline tags only after they are activated with whitespace', () => {
    expect(deriveNoteMetadata('<p>#praca Plan #ważne </p><p>#praca #jeszcze-nie</p>').tags)
      .toEqual(['praca', 'ważne', 'jeszcze-nie']);
    expect(deriveNoteMetadata('<span>Niedokończony #szkic</span>').tags).toEqual([]);
  });

  it('returns a fallback title for a document without text', () => {
    expect(deriveNoteMetadata('<p><br></p>').title).toBe('');
    expect(getPlainText('<p><br></p>')).toBe('');
  });

  it('prepends a legacy separate title once and leaves canonical content unchanged', () => {
    const canonical = canonicalizeNoteContent('Plan <ważny>', '<p>Treść</p>');
    expect(canonical).toBe('<h1>Plan &lt;ważny&gt;</h1><p>Treść</p>');
    expect(canonicalizeNoteContent('Plan <ważny>', canonical)).toBe(canonical);
  });
});
