const BLOCK_END = /<\/(?:address|article|aside|blockquote|div|h[1-6]|header|li|main|p|pre|section|tr)>/gi;
const BREAK = /<br\s*\/?>/gi;

function decodeHtml(value: string): string {
  if (typeof document === 'undefined') {
    return value
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  }
  const element = document.createElement('textarea');
  element.innerHTML = value;
  return element.value;
}

function getDocumentText(html: string): string {
  return decodeHtml(
    html
      .replace(BREAK, '\n')
      .replace(BLOCK_END, '\n')
      .replace(/<[^>]*>/g, ''),
  ).replace(/\r\n?/g, '\n');
}

export function getPlainText(html: string): string {
  return getDocumentText(html).replace(/\s+/g, ' ').trim();
}

export function deriveNoteMetadata(html: string): { title: string; tags: string[] } {
  const text = getDocumentText(html);
  const title = text.split('\n').map(line => line.trim()).find(Boolean) ?? '';
  const tags: string[] = [];
  const seen = new Set<string>();
  const matches = text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)(?=\s)/gu);

  for (const match of matches) {
    const tag = match[1].toLocaleLowerCase('pl-PL');
    if (!seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }

  return { title, tags };
}

export function canonicalizeNoteContent(title: string, content: string): string {
  const legacyTitle = title.trim();
  if (!legacyTitle || deriveNoteMetadata(content).title === legacyTitle) return content;
  const escapedTitle = legacyTitle
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return `<h1>${escapedTitle}</h1>${content}`;
}
