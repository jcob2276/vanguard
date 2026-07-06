import { format } from 'date-fns';
import { Shield, Zap, Wallet } from 'lucide-react';

export const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Codziennie',
  weekly: 'Co tydzień',
  monthly: 'Co miesiąc'
};

export function nextOccurrenceDate(baseDateStr: string | null, recurrence: string, today: string): string {
  const base = baseDateStr || today;
  const [y, m, day] = base.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  if (recurrence === 'daily') d.setUTCDate(d.getUTCDate() + 1);
  else if (recurrence === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (recurrence === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export const GOAL_ICON: Record<string, typeof Shield> = {
  cialo: Shield,
  duch: Zap,
  konto: Wallet
};

const GOAL_COLOR: Record<string, string> = {
  cialo: 'text-emerald-500/50',
  duch: 'text-indigo-500/50',
  konto: 'text-amber-500/50'
};

export const PRIORITY_ORDER = ['low', 'normal', 'high', 'urgent'];

export const PRIORITY: Record<string, { ring: string; fill: string; chip: string; label: string }> = {
  low: {
    ring: 'border-emerald-400',
    fill: 'bg-emerald-500',
    chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    label: 'Quick Win'
  },
  normal: {
    ring: 'border-sky-400',
    fill: 'bg-sky-500',
    chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    label: 'Focus'
  },
  high: {
    ring: 'border-violet-500',
    fill: 'bg-violet-500',
    chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    label: 'Deep Work'
  },
  urgent: {
    ring: 'border-rose-500',
    fill: 'bg-rose-500',
    chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    label: 'Urgent'
  }
};

const EMOJI_RE = /^(\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|️|‍\p{Extended_Pictographic})*)\s*/u;

export function splitEmoji(title: string) {
  const m = title.match(EMOJI_RE);
  return m ? { icon: m[1], label: title.slice(m[0].length) } : { icon: null, label: title };
}

export function relativeDate(dateStr: string | null | undefined, today: string) {
  if (!dateStr) return null;
  if (dateStr === today) return { text: 'Dziś', color: 'text-emerald-500' };
  const diff = Math.round(
    (new Date(dateStr + 'T12:00:00Z').getTime() - new Date(today + 'T12:00:00Z').getTime()) / 86400000
  );
  if (diff < 0) return { text: `${Math.abs(diff)}d po terminie`, color: 'text-rose-500 font-black' };
  if (diff === 1) return { text: 'Jutro', color: 'text-sky-500' };
  if (diff <= 7) return { text: `za ${diff} dni`, color: 'text-text-muted' };
  return { text: format(new Date(dateStr + 'T00:00:00'), 'd MMM'), color: 'text-text-muted' };
}

// ── Smart query language ──
// Tokens: tag:x priority:high due:today|week|overdue|none section:name text...
// Unrecognized tokens and anything left over are treated as free-text title search.
export interface SmartQueryItem {
  id: string;
  title: string;
  priority: string | null;
  tags: string[] | null;
  due_date: string | null;
  section_id: string | null;
  status: string;
}

export function matchesSmartQuery(
  query: string,
  item: SmartQueryItem,
  today: string,
  sectionNameById: Record<string, string>
): boolean {
  const tokenRe = /(\w+):(\S+)/g;
  let m: RegExpExecArray | null;
  let freeText = query;
  const conditions: Array<() => boolean> = [];

  while ((m = tokenRe.exec(query)) !== null) {
    const [full, key, value] = m;
    freeText = freeText.replace(full, ' ');
    const v = value.toLowerCase();
    switch (key.toLowerCase()) {
      case 'tag':
        conditions.push(() => (item.tags || []).some(t => t.toLowerCase() === v));
        break;
      case 'priority':
        conditions.push(() => (item.priority || 'normal').toLowerCase() === v);
        break;
      case 'section':
        conditions.push(() => (item.section_id ? sectionNameById[item.section_id] : '')?.toLowerCase().includes(v) ?? false);
        break;
      case 'status':
        conditions.push(() => item.status.toLowerCase() === v);
        break;
      case 'due':
        conditions.push(() => {
          if (v === 'none') return !item.due_date;
          if (!item.due_date) return false;
          if (v === 'today') return item.due_date === today;
          if (v === 'overdue') return item.due_date < today;
          if (v === 'week') {
            const diff = Math.round((new Date(item.due_date + 'T12:00:00Z').getTime() - new Date(today + 'T12:00:00Z').getTime()) / 86400000);
            return diff >= 0 && diff <= 7;
          }
          return true;
        });
        break;
    }
  }

  const remaining = freeText.trim().toLowerCase();
  if (remaining) conditions.push(() => item.title.toLowerCase().includes(remaining));

  return conditions.every(c => c());
}
