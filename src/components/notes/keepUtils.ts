import { differenceInDays } from 'date-fns';
import { formatWarsawDate, getTodayWarsaw } from '../../lib/date';

export function relativeDate(iso: string): string {
  const d = new Date(iso);
  const diffDays = differenceInDays(new Date(getTodayWarsaw() + 'T00:00:00'), new Date(formatWarsawDate(d) + 'T00:00:00'));
  if (diffDays === 0) return 'dziś';
  if (diffDays === 1) return 'wczoraj';
  if (diffDays < 7) return `${diffDays} dni temu`;
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

export function formatNoteDate(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

/** Strips HTML tags — shared by NoteRow, InlineEditor, EditNoteModal for snippet/AI text. */
export function getPlainText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function sanitizeHtml(html: string): string {
  const FORBIDDEN = new Set(['script', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'style', 'base']);
  const URL_ATTRS = new Set(['href', 'src', 'srcset', 'formaction', 'srcdoc', 'xlink:href']);
  const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel'];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const walk = (el: Element) => {
    for (const child of Array.from(el.children).reverse()) {
      if (FORBIDDEN.has(child.tagName.toLowerCase())) {
        child.remove();
        continue;
      }

      for (const attr of Array.from(child.attributes)) {
        const attrName = attr.name.toLowerCase();
        if (attrName.startsWith('on')) {
          child.removeAttribute(attr.name);
        } else if (URL_ATTRS.has(attrName)) {
          // Remove spaces, tabs, and control characters (ASCII 0-31 and 127)
          const cleanVal = attr.value
            .split('')
            .filter(char => {
              const code = char.charCodeAt(0);
              return !/\s/.test(char) && code > 31 && code !== 127;
            })
            .join('');
          const colonIndex = cleanVal.indexOf(':');

          let hasScheme = false;
          if (colonIndex > -1) {
            const slashIndex = cleanVal.indexOf('/');
            const qIndex = cleanVal.indexOf('?');
            const hIndex = cleanVal.indexOf('#');
            const firstSpecial = Math.min(
              slashIndex === -1 ? Infinity : slashIndex,
              qIndex === -1 ? Infinity : qIndex,
              hIndex === -1 ? Infinity : hIndex
            );
            if (colonIndex < firstSpecial) {
              hasScheme = true;
            }
          }

          if (hasScheme) {
            const scheme = cleanVal.substring(0, colonIndex).toLowerCase();
            if (!ALLOWED_SCHEMES.includes(scheme)) {
              child.removeAttribute(attr.name);
            }
          }
        }
      }
      walk(child);
    }
  };

  walk(doc.body);
  return doc.body.innerHTML;
}

import { Note as ApiNote } from '../../lib/notesApi';
export type Note = ApiNote;

// Each color has a bg, readable text colors, border, and dot for the swatch
export const COLORS: {
  id: string;
  label: string;
  bg: string;
  border: string;
  dot: string;
  text: string;       // primary text on this bg
  textSub: string;    // secondary text on this bg
  tagBg: string;
  tagText: string;
}[] = [
  { id: 'default', label: 'Domyślny',    bg: 'var(--keep-bg-default)', border: 'var(--keep-border-default)', dot: 'var(--color-theme-hex-94a3b8)', text: 'var(--keep-text-default)', textSub: 'var(--keep-text-sub-default)', tagBg: 'var(--keep-tag-bg-default)', tagText: 'var(--keep-tag-text-default)' },
  { id: 'red',     label: 'Czerwony',    bg: 'var(--keep-bg-red)',     border: 'var(--keep-border-red)',     dot: 'var(--color-theme-hex-f87171)', text: 'var(--keep-text-red)',     textSub: 'var(--keep-text-sub-red)',     tagBg: 'var(--keep-tag-bg-red)',     tagText: 'var(--keep-tag-text-red)' },
  { id: 'orange',  label: 'Pomarańczowy',bg: 'var(--keep-bg-orange)',   border: 'var(--keep-border-orange)',  dot: 'var(--color-theme-hex-fb923c)', text: 'var(--keep-text-orange)',  textSub: 'var(--keep-text-sub-orange)',  tagBg: 'var(--keep-tag-bg-orange)',  tagText: 'var(--keep-tag-text-orange)' },
  { id: 'yellow',  label: 'Żółty',       bg: 'var(--keep-bg-yellow)',   border: 'var(--keep-border-yellow)',  dot: 'var(--color-theme-hex-facc15)', text: 'var(--keep-text-yellow)',  textSub: 'var(--keep-text-sub-yellow)',  tagBg: 'var(--keep-tag-bg-yellow)',  tagText: 'var(--keep-tag-text-yellow)' },
  { id: 'green',   label: 'Zielony',     bg: 'var(--keep-bg-green)',    border: 'var(--keep-border-green)',   dot: 'var(--color-theme-hex-4ade80)', text: 'var(--keep-text-green)',   textSub: 'var(--keep-text-sub-green)',   tagBg: 'var(--keep-tag-bg-green)',   tagText: 'var(--keep-tag-text-green)' },
  { id: 'teal',    label: 'Teal',        bg: 'var(--keep-bg-teal)',     border: 'var(--keep-border-teal)',    dot: 'var(--color-theme-hex-2dd4bf)', text: 'var(--keep-text-teal)',     textSub: 'var(--keep-text-sub-teal)',     tagBg: 'var(--keep-tag-bg-teal)',     tagText: 'var(--keep-tag-text-teal)' },
  { id: 'blue',    label: 'Niebieski',   bg: 'var(--keep-bg-blue)',     border: 'var(--keep-border-blue)',    dot: 'var(--color-theme-hex-60a5fa)', text: 'var(--keep-text-blue)',     textSub: 'var(--keep-text-sub-blue)',     tagBg: 'var(--keep-tag-bg-blue)',     tagText: 'var(--keep-tag-text-blue)' },
  { id: 'indigo',  label: 'Indygo',      bg: 'var(--keep-bg-indigo)',   border: 'var(--keep-border-indigo)',  dot: 'var(--color-info-hover)', text: 'var(--keep-text-indigo)',   textSub: 'var(--keep-text-sub-indigo)',   tagBg: 'var(--keep-tag-bg-indigo)',   tagText: 'var(--keep-tag-text-indigo)' },
  { id: 'purple',  label: 'Fioletowy',   bg: 'var(--keep-bg-purple)',   border: 'var(--keep-border-purple)',  dot: 'var(--color-theme-hex-c084fc)', text: 'var(--keep-text-purple)',   textSub: 'var(--keep-text-sub-purple)',   tagBg: 'var(--keep-tag-bg-purple)',   tagText: 'var(--keep-tag-text-purple)' },
  { id: 'pink',    label: 'Różowy',      bg: 'var(--keep-bg-pink)',     border: 'var(--keep-border-pink)',    dot: 'var(--color-theme-hex-f472b6)', text: 'var(--keep-text-pink)',     textSub: 'var(--keep-text-sub-pink)',     tagBg: 'var(--keep-tag-bg-pink)',     tagText: 'var(--keep-tag-text-pink)' },
];

export const getColor = (id: string) => COLORS.find(c => c.id === id) ?? COLORS[0];

export function highlightHtml(html: string, query: string): string {
  if (!query.trim()) return html;
  const esc = query.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(<[^>]+>)|(${esc})`, 'gi');
  return html.replace(regex, (match, p1, p2) => {
    if (p1) return p1;
    return `<mark class="bg-warning dark:bg-warning/50 text-scrim dark:text-on-accent px-0.5 rounded">${p2}</mark>`;
  });
}

