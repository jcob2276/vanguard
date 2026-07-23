// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { matchesNoteSearch, sanitizeHtml } from './keepUtils';
import type { Note } from '../../lib/notesApi';

describe('sanitizeHtml', () => {
  it('allows safe HTML elements and attributes', () => {
    const input = '<p>Hello <strong>world</strong>. <a href="https://example.com">Link</a></p>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('allows relative path URLs', () => {
    const input = '<a href="/notes/123">Note</a>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('blocks forbidden tags', () => {
    const input = '<div>Safe</div><script>alert("XSS")</script><iframe></iframe>';
    expect(sanitizeHtml(input)).toBe('<div>Safe</div>');
  });

  it('blocks nested script tags', () => {
    const input = '<div><script>alert("XSS")</script><span>Safe</span></div>';
    expect(sanitizeHtml(input)).toBe('<div><span>Safe</span></div>');
  });

  it('strips javascript scheme URLs', () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    expect(sanitizeHtml(input)).toBe('<a>Click</a>');
  });

  it('strips javascript scheme with leading whitespace (Bypass 1)', () => {
    const input = '<a href="   javascript:alert(1)">Click</a>';
    expect(sanitizeHtml(input)).toBe('<a>Click</a>');
  });

  it('strips javascript scheme with control characters (Bypass 2)', () => {
    const input = '<a href="java\tscript:alert(1)">Click</a>';
    expect(sanitizeHtml(input)).toBe('<a>Click</a>');
  });

  it('strips dangerous data scheme URLs', () => {
    const input = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
    expect(sanitizeHtml(input)).toBe('<a>Click</a>');
  });

  it('strips event handlers (on* attributes)', () => {
    const input = '<img src="https://example.com/img.png" onerror="alert(1)" onload="alert(2)">';
    expect(sanitizeHtml(input)).toBe('<img src="https://example.com/img.png">');
  });

  it('filters all URL-carrying attributes (formaction, src, etc.)', () => {
    const input = '<button formaction="javascript:alert(1)">Submit</button>';
    expect(sanitizeHtml(input)).toBe('<button>Submit</button>');
  });

  it('strips nested <script> inside attribute value', () => {
    const input = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
    expect(sanitizeHtml(input)).toBe('<a>Click</a>');
  });

  it('strips iframe with srcdoc (FORBIDDEN tag)', () => {
    const input = '<iframe srcdoc="<script>alert(1)</script>"></iframe>';
    expect(sanitizeHtml(input)).toBe('');
  });

  it('strips xlink:href with javascript scheme', () => {
    const input = '<svg><use xlink:href="javascript:alert(1)"></use></svg>';
    expect(sanitizeHtml(input)).toBe('<svg><use></use></svg>');
  });

  it('allows mailto and tel schemes', () => {
    const input = '<a href="mailto:test@example.com">Email</a><a href="tel:+123456789">Call</a>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('strips style tag (FORBIDDEN)', () => {
    const input = '<div>Safe</div><style>.evil { display: none; }</style>';
    expect(sanitizeHtml(input)).toBe('<div>Safe</div>');
  });

  it('strips meta tag (FORBIDDEN)', () => {
    const input = '<div>Safe</div><meta http-equiv="refresh" content="0;url=evil.com">';
    expect(sanitizeHtml(input)).toBe('<div>Safe</div>');
  });

  it('handles deeply nested dangerous content', () => {
    const input = '<div><p><span><script>alert(1)</script></span></p></div>';
    expect(sanitizeHtml(input)).toBe('<div><p><span></span></p></div>');
  });

  it('strips object and embed tags (FORBIDDEN)', () => {
    const input = '<div>Safe</div><object data="evil.swf"></object><embed src="evil.swf">';
    expect(sanitizeHtml(input)).toBe('<div>Safe</div>');
  });
});

describe('matchesNoteSearch', () => {
  const note = {
    title: 'Plan podróży',
    content: '<p>Rezerwacja hotelu w Gdańsku</p>',
    tags: ['wakacje'],
    attachment_names: ['bilety-lotnicze.pdf'],
    attachment_text: 'numer rezerwacji ABC123',
  } as Note;

  it('searches normalized plain content and multiple terms', () => {
    expect(matchesNoteSearch(note, 'hotel gdansk')).toBe(true);
  });

  it('searches tags and attachment names', () => {
    expect(matchesNoteSearch(note, 'wakacje bilety')).toBe(true);
  });

  it('searches OCR text from scans', () => {
    expect(matchesNoteSearch(note, 'ABC123')).toBe(true);
  });

  it('requires every search term to match', () => {
    expect(matchesNoteSearch(note, 'hotel faktura')).toBe(false);
  });

  it('never searches protected fields of a locked note', () => {
    expect(matchesNoteSearch({ ...note, is_locked: true }, 'bilety')).toBe(false);
  });
});
