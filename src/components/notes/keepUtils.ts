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

export function sanitizeHtml(html: string): string {
  const FORBIDDEN = new Set(['script', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'style', 'base']);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const walk = (el: Element) => {
    for (const child of Array.from(el.children).reverse()) {
      if (FORBIDDEN.has(child.tagName.toLowerCase())) { child.remove(); continue; }
      for (const attr of Array.from(child.attributes)) {
        if (attr.name.startsWith('on') || (attr.name === 'href' && /^javascript:/i.test(attr.value))) {
          child.removeAttribute(attr.name);
        }
      }
      walk(child);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  is_pinned: boolean;
  is_archived?: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

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
  { id: 'default', label: 'Domyślny',    bg: 'var(--keep-bg-default)', border: 'var(--keep-border-default)', dot: '#64748b', text: 'var(--keep-text-default)', textSub: 'var(--keep-text-sub-default)', tagBg: 'var(--keep-tag-bg-default)', tagText: 'var(--keep-tag-text-default)' },
  { id: 'red',     label: 'Koralowy',    bg: 'var(--keep-bg-red)',     border: 'var(--keep-border-red)',     dot: '#ef4444', text: 'var(--keep-text-red)',     textSub: 'var(--keep-text-sub-red)',     tagBg: 'var(--keep-tag-bg-red)',     tagText: 'var(--keep-tag-text-red)' },
  { id: 'orange',  label: 'Pomarańczowy',bg: 'var(--keep-bg-orange)',   border: 'var(--keep-border-orange)',  dot: '#f97316', text: 'var(--keep-text-orange)',  textSub: 'var(--keep-text-sub-orange)',  tagBg: 'var(--keep-tag-bg-orange)',  tagText: 'var(--keep-tag-text-orange)' },
  { id: 'yellow',  label: 'Żółty',       bg: 'var(--keep-bg-yellow)',   border: 'var(--keep-border-yellow)',  dot: '#f59e0b', text: 'var(--keep-text-yellow)',  textSub: 'var(--keep-text-sub-yellow)',  tagBg: 'var(--keep-tag-bg-yellow)',  tagText: 'var(--keep-tag-text-yellow)' },
  { id: 'green',   label: 'Szałwia',     bg: 'var(--keep-bg-green)',    border: 'var(--keep-border-green)',   dot: '#22c55e', text: 'var(--keep-text-green)',   textSub: 'var(--keep-text-sub-green)',   tagBg: 'var(--keep-tag-bg-green)',   tagText: 'var(--keep-tag-text-green)' },
  { id: 'teal',    label: 'Teal',        bg: 'var(--keep-bg-teal)',     border: 'var(--keep-border-teal)',    dot: '#14b8a6', text: 'var(--keep-text-teal)',     textSub: 'var(--keep-text-sub-teal)',     tagBg: 'var(--keep-tag-bg-teal)',     tagText: 'var(--keep-tag-text-teal)' },
  { id: 'blue',    label: 'Niebieski',   bg: 'var(--keep-bg-blue)',     border: 'var(--keep-border-blue)',    dot: '#3b82f6', text: 'var(--keep-text-blue)',     textSub: 'var(--keep-text-sub-blue)',     tagBg: 'var(--keep-tag-bg-blue)',     tagText: 'var(--keep-tag-text-blue)' },
  { id: 'indigo',  label: 'Indygo',      bg: 'var(--keep-bg-indigo)',   border: 'var(--keep-border-indigo)',  dot: '#6366f1', text: 'var(--keep-text-indigo)',   textSub: 'var(--keep-text-sub-indigo)',   tagBg: 'var(--keep-tag-bg-indigo)',   tagText: 'var(--keep-tag-text-indigo)' },
  { id: 'purple',  label: 'Fioletowy',   bg: 'var(--keep-bg-purple)',   border: 'var(--keep-border-purple)',  dot: '#a855f7', text: 'var(--keep-text-purple)',   textSub: 'var(--keep-text-sub-purple)',   tagBg: 'var(--keep-tag-bg-purple)',   tagText: 'var(--keep-tag-text-purple)' },
  { id: 'pink',    label: 'Różowy',      bg: 'var(--keep-bg-pink)',     border: 'var(--keep-border-pink)',    dot: '#ec4899', text: 'var(--keep-text-pink)',     textSub: 'var(--keep-text-sub-pink)',     tagBg: 'var(--keep-tag-bg-pink)',     tagText: 'var(--keep-tag-text-pink)' },
];

export const getColor = (id: string) => COLORS.find(c => c.id === id) ?? COLORS[0];

export function highlightHtml(html: string, query: string): string {
  if (!query.trim()) return html;
  const esc = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(<[^>]+>)|(${esc})`, 'gi');
  return html.replace(regex, (match, p1, p2) => {
    if (p1) return p1;
    return `<mark class="bg-yellow-300 dark:bg-yellow-600/50 text-black dark:text-white px-0.5 rounded">${p2}</mark>`;
  });
}

