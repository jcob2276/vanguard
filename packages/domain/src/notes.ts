/** Derive a short title from the first non-empty line of note content. */
export function firstLineTitle(content: string, max = 80): string {
  const line = content.split('\n').find((part) => part.trim().length > 0)?.trim() ?? '';
  if (line.length <= max) return line;
  return line.slice(0, max);
}
